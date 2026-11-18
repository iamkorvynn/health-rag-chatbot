"""Health RAG Chatbot — FastAPI backend (Sunrise Family Clinic).

Replicates the notebook pipeline (Health_RAG_Chatbot__1.ipynb) exactly:
  PyPDFLoader -> "[Source file: <name>]" prefix -> RecursiveCharacterTextSplitter
  (chunk_size=800, chunk_overlap=150) -> GoogleGenerativeAIEmbeddings
  ("models/gemini-embedding-001") -> Chroma collection "clinic"
  -> retriever k=5, similarity threshold 0.53 -> ChatGoogleGenerativeAI
  ("gemini-2.5-flash", temp 0) with the notebook's system prompt, verbatim.

Synthetic demo data only. Decision-support for doctors, NOT a diagnosis tool.

API key: resolved dynamically per request — a key entered by an admin on
the website (POST /admin/api-key, stored in SQLite) takes precedence,
GEMINI_API_KEY (or GOOGLE_API_KEY) from the environment is the fallback.
Never hardcode one, never commit one, never return the full key from any
endpoint, never log a key value. Without any key the server still runs:
/health, /patients and /upload work (the PDFs' text/metadata are
registered), but embedding and /ask need the key, so /ask returns a clear
503 until a key is set.

Auth: JWT Bearer (see /auth/login). Seeded demo accounts (bcrypt-hashed in
SQLite backend/clinic.db): admin/admin123 (admin), doctor/doctor123
(doctor), staff/staff123 (staff). Full contract: backend/API.md.
"""
import json
import os
import re
import shutil
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path

import bcrypt
import jwt
from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from langchain_community.document_loaders import PyPDFLoader
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

BASE_DIR = Path(__file__).resolve().parent          # repo/backend/
REPO_DIR = BASE_DIR.parent                          # repo/
DATA_DIR = REPO_DIR / "data"                        # seed PDFs (8 synthetic)
UPLOAD_DIR = DATA_DIR / "uploads"                   # user-uploaded PDFs
CHROMA_DIR = BASE_DIR / "chroma_db"
REGISTRY_FILE = BASE_DIR / "registry.json"          # no-key index: files+patients
DB_FILE = BASE_DIR / "clinic.db"                    # users, query log, tokens
COLLECTION = "clinic"
CHUNK_SIZE, CHUNK_OVERLAP = 800, 150
EMBED_MODEL = "models/gemini-embedding-001"
LLM_MODEL = "gemini-2.5-flash"
# Similarity threshold (cosine relevance, 0-1) tuned 2026-11-18 from live scores:
#   "What is Rahul Mehta allergic to?" -> P1001 chunks 0.589/0.566/0.551,
#   Sneha P1002 p1 0.520, Patient Directory 0.514. 0.53 keeps every P1001
#   chunk and drops the Sneha cross-citation; "capital of France" tops out
#   at 0.349 ( -> fallback); Saturday-timings chunks score 0.548-0.621.
SIMILARITY_THRESHOLD = 0.53
FALLBACK = "Sorry, I could not find that in the clinic records. Please check with the treating doctor."
GUIDE_FILE = "Clinic_Patient_Information_Guide.pdf"

# EXACT system prompt from the notebook — do not reword it.
SYSTEM_PROMPT = """You are an assistant for doctors and staff at Sunrise Family Clinic.
Answer the question using only the context given below. Dont use any outside knowledge.
Be careful to use the right patient: match the name or patient ID in the question with the source file.
If the answer is not in the context say: "Sorry, I could not find that in the clinic records. Please check with the treating doctor."
Do not diagnose or suggest new medicines or doses beyond what is written in the records.
Keep the answer short and clear.

Context:
{context}"""

LANG_NAMES = {"en": "English", "hi": "Hindi", "mr": "Marathi"}

GREETINGS = re.compile(
    r"^\s*(hi|hii+|hello|hey|hiya|yo|good\s+(morning|afternoon|evening)|"
    r"what'?s up|whats up|how are you|namaste|good day)\b[.!?]*\s*$", re.I)
PATIENT_LIST_Q = re.compile(
    r"(list|show|give|name|who are|tell me).{0,30}(all )?(my |the )?(patients|patient names)"
    r"|who are my patients|list all my patients", re.I)

TEST_QUESTIONS = [
    {"id": 1, "question": "What is Rahul Mehta allergic to?", "expected": "Penicillin"},
    {"id": 2, "question": "List all my patients", "expected": "Ananya Rao"},
    {"id": 3, "question": "What are the clinic timings on Saturday?", "expected": "9:00 AM - 1:00 PM"},
    {"id": 4, "question": "What is Sneha Kulkarni allergic to?", "expected": "Sulfa"},
    {"id": 5, "question": "What medicines does Arjun Nair take?", "expected": "Aspirin"},
    {"id": 6, "question": "What is Meera Joshi allergic to?", "expected": "Codeine"},
    {"id": 7, "question": "What condition does Kabir Singh have?", "expected": "Chronic kidney disease"},
    {"id": 8, "question": "What is Ananya Rao allergic to?", "expected": "Latex"},
    {"id": 9, "question": "What is the first consultation fee?", "expected": "Rs. 500"},
]

app = FastAPI(title="Health RAG Chatbot — Sunrise Family Clinic",
              description="Synthetic demo data only. Decision-support, not a diagnosis tool.")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"],
                   allow_headers=["*"])


def get_api_key():
    """Active Gemini key, resolved fresh on every call: a key entered by an
    admin on the website (SQLite settings) first, GEMINI_API_KEY / GOOGLE_API_KEY
    from the environment as fallback. No caching — a key change via
    POST /admin/api-key takes effect without a restart."""
    return get_manual_api_key() or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")


MANUAL_KEY_NAME = "gemini_api_key"


def get_manual_api_key():
    """Key entered by an admin via the website, or None. Never logged."""
    try:
        with db_conn() as conn:
            row = conn.execute("SELECT value FROM settings WHERE key = ?",
                               (MANUAL_KEY_NAME,)).fetchone()
    except Exception:
        return None
    return row["value"] if row else None


def set_manual_api_key(key: str, username: str):
    with db_conn() as conn:
        conn.execute(
            "INSERT INTO settings (key, value, updated_by, updated_at) VALUES (?, ?, ?, ?)"
            " ON CONFLICT(key) DO UPDATE SET value = excluded.value,"
            " updated_by = excluded.updated_by, updated_at = excluded.updated_at",
            (MANUAL_KEY_NAME, key, username, datetime.now(timezone.utc).isoformat()))
        conn.execute("INSERT INTO settings_log (timestamp, username, action) VALUES (?, ?, ?)",
                     (datetime.now(timezone.utc).isoformat(), username, "api_key_set"))
        conn.commit()


def clear_manual_api_key(username: str):
    with db_conn() as conn:
        conn.execute("DELETE FROM settings WHERE key = ?", (MANUAL_KEY_NAME,))
        conn.execute("INSERT INTO settings_log (timestamp, username, action) VALUES (?, ?, ?)",
                     (datetime.now(timezone.utc).isoformat(), username, "api_key_removed"))
        conn.commit()


def api_key_status():
    """Masked status of the active key. The full key is NEVER returned."""
    manual = get_manual_api_key()
    env = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if manual:
        return {"configured": True, "source": "manual", "masked": manual[-4:]}
    if env:
        return {"configured": True, "source": "env", "masked": env[-4:]}
    return {"configured": False, "source": "none", "masked": None}


# ---------- SQLite: users, query log, token queue ----------

def db_conn():
    conn = sqlite3.connect(str(DB_FILE))
    conn.row_factory = sqlite3.Row
    return conn


SEED_USERS = [("admin", "admin123", "admin"),
              ("doctor", "doctor123", "doctor"),
              ("staff", "staff123", "staff")]


def init_db():
    """Create tables + seed the three demo accounts (idempotent)."""
    with db_conn() as conn:
        conn.execute("""CREATE TABLE IF NOT EXISTS users (
            username TEXT PRIMARY KEY, password_hash TEXT NOT NULL, role TEXT NOT NULL)""")
        conn.execute("""CREATE TABLE IF NOT EXISTS queries (
            id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT NOT NULL,
            username TEXT NOT NULL, question TEXT NOT NULL, answer TEXT NOT NULL,
            sources TEXT NOT NULL DEFAULT '[]', fallback INTEGER NOT NULL DEFAULT 0,
            language TEXT NOT NULL DEFAULT 'en')""")
        conn.execute("""CREATE TABLE IF NOT EXISTS tokens (
            number INTEGER PRIMARY KEY, name TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'waiting',
            created_at TEXT NOT NULL)""")
        conn.execute("""CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY, value TEXT NOT NULL,
            updated_by TEXT NOT NULL, updated_at TEXT NOT NULL)""")
        conn.execute("""CREATE TABLE IF NOT EXISTS settings_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT NOT NULL,
            username TEXT NOT NULL, action TEXT NOT NULL)""")
        for username, password, role in SEED_USERS:
            row = conn.execute("SELECT 1 FROM users WHERE username = ?",
                               (username,)).fetchone()
            if not row:
                conn.execute(
                    "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
                    (username, bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode(),
                     role))
        conn.commit()


def log_query(username, question, answer, sources, fallback, language):
    with db_conn() as conn:
        conn.execute(
            "INSERT INTO queries (timestamp, username, question, answer, sources, fallback, language)"
            " VALUES (?, ?, ?, ?, ?, ?, ?)",
            (datetime.now(timezone.utc).isoformat(), username, question, answer,
             json.dumps(sources), 1 if fallback else 0, language))
        conn.commit()


def query_rows(limit=None):
    with db_conn() as conn:
        sql = "SELECT * FROM queries ORDER BY id DESC"
        if limit:
            sql += f" LIMIT {int(limit)}"
        rows = conn.execute(sql).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d["fallback"] = bool(d["fallback"])
        try:
            d["sources"] = json.loads(d["sources"])
        except Exception:
            d["sources"] = []
        out.append(d)
    return out


init_db()


# ---------- JWT auth ----------

JWT_SECRET = os.environ.get("JWT_SECRET", "health-rag-demo-secret-change-me")
JWT_ALG = "HS256"
JWT_EXP_HOURS = 12


def create_token(username, role):
    now = datetime.now(timezone.utc)
    return jwt.encode({"sub": username, "role": role,
                       "exp": now + timedelta(hours=JWT_EXP_HOURS), "iat": now},
                      JWT_SECRET, algorithm=JWT_ALG)


def get_current_user(authorization: str | None = Header(default=None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing or invalid Authorization header (Bearer token required).")
    try:
        payload = jwt.decode(authorization[7:], JWT_SECRET, algorithms=[JWT_ALG])
        username, role = payload.get("sub"), payload.get("role")
    except Exception:
        raise HTTPException(401, "Invalid or expired token.")
    if not username or not role:
        raise HTTPException(401, "Invalid token.")
    return {"username": username, "role": role}


def require_admin(user: dict = Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(403, "Admin role required.")
    return user


def require_staff_or_admin(user: dict = Depends(get_current_user)):
    if user["role"] not in ("staff", "admin"):
        raise HTTPException(403, "Staff or admin role required.")
    return user


# ---------- file / patient registry (works WITHOUT a key) ----------

def parse_patient(filename: str, text: str = ""):
    """Patient_P1001_Rahul_Mehta.pdf -> {"id": "P1001", "name": "Rahul Mehta"}."""
    m = re.match(r"Patient_(P\d+)_([A-Za-z]+(?:_[A-Za-z]+)*)\.pdf$", filename)
    if m:
        return {"id": m.group(1), "name": m.group(2).replace("_", " "), "file": filename}
    m = re.search(r"Patient ID\s*(P\d+)", text)
    if m:
        return {"id": m.group(1), "name": filename.replace(".pdf", "").replace("_", " "),
                "file": filename}
    return None


def ocr_pdf_text(path: Path) -> str:
    """OCR a PDF with pytesseract + pdf2image (poppler). Returns plain text."""
    from pdf2image import convert_from_path
    import pytesseract
    images = convert_from_path(str(path), dpi=200)
    return "\n".join(pytesseract.image_to_string(img) for img in images)


def ocr_text_for(path: Path, extracted: str) -> str:
    """If a PDF yields almost no extractable text, OCR it (sidecar-cached)."""
    if len(extracted.strip()) >= 50:
        return ""
    sidecar = path.with_suffix(".ocr.txt")
    if sidecar.exists():
        try:
            return sidecar.read_text()
        except Exception:
            pass
    try:
        text = ocr_pdf_text(path)
    except Exception as e:
        print(f"OCR failed for {path.name}: {e}")
        return ""
    try:
        sidecar.write_text(text)
    except Exception:
        pass
    return text


def load_pdfs(paths):
    """Notebook step 1: PyPDFLoader per PDF, '[Source file: ...]' prefix, metadata['file'].
    PDFs with almost no extractable text (scanned) get OCR text indexed too."""
    docs = []
    for path in paths:
        try:
            pages = PyPDFLoader(str(path)).load()
        except Exception:
            continue
        for p in pages:
            p.page_content = f"[Source file: {path.name}]\n" + p.page_content
            p.metadata["file"] = path.name
        docs.extend(pages)
        raw = "\n".join(p.page_content for p in pages)
        ocr_text = ocr_text_for(path, raw)
        if ocr_text.strip():
            docs.append(Document(
                page_content=f"[Source file: {path.name}]\n[OCR text]\n{ocr_text}",
                metadata={"file": path.name, "page": 0}))
    return docs


def patient_directory_doc(patients):
    """Fix for 'List all my patients': one directory Document, added to the
    vector store so the retriever can answer it (the notebook could not)."""
    lines = ["Patient directory — all patients in the clinic records:"]
    for p in patients:
        lines.append(f"- {p['id']} — {p['name']} (file: {p['file']})")
    return Document(page_content="\n".join(lines),
                    metadata={"file": "Patient Directory", "page": 0})


def all_pdf_paths():
    paths = sorted(DATA_DIR.glob("*.pdf"))
    if UPLOAD_DIR.exists():
        paths += sorted(UPLOAD_DIR.glob("*.pdf"))
    return paths


def load_registry():
    if REGISTRY_FILE.exists():
        try:
            return json.loads(REGISTRY_FILE.read_text())
        except Exception:
            pass
    return {"files": [], "patients": [], "embedded": False}


def save_registry(reg):
    REGISTRY_FILE.write_text(json.dumps(reg, indent=2))


def refresh_registry(paths):
    """Register PDFs' text/metadata (patients, file list) without embeddings.
    This is what makes /patients and /upload work even with no API key."""
    reg = {"files": [], "patients": [], "embedded": load_registry().get("embedded", False)}
    seen = set()
    for path in paths:
        try:
            docs = load_pdfs([path])
        except Exception:
            continue
        text = "\n".join(d.page_content for d in docs)
        reg["files"].append({"file": path.name, "pages": len(docs)})
        pat = parse_patient(path.name, text)
        if pat and pat["id"] not in seen:
            seen.add(pat["id"])
            reg["patients"].append(pat)
    reg["patients"].sort(key=lambda p: p["id"])
    save_registry(reg)
    return reg


def index_is_embedded():
    return load_registry().get("embedded", False) and (CHROMA_DIR / "chroma.sqlite3").exists()


def build_vector_store():
    """Notebook steps 2-3: split (800/150) -> embed -> Chroma 'clinic'.
    Rebuilds from ALL PDFs in data/ (seed + uploads) — simpler and always
    consistent, instead of surgically deleting per-file chunks. Needs a key."""
    key = get_api_key()
    if not key:
        raise RuntimeError("GEMINI_API_KEY is not set — cannot embed documents.")
    from langchain_chroma import Chroma
    from langchain_google_genai import GoogleGenerativeAIEmbeddings

    paths = all_pdf_paths()
    docs = load_pdfs(paths)
    patients = []
    seen = set()
    for path in paths:
        pat = parse_patient(path.name, "\n".join(d.page_content for d in docs
                                                 if d.metadata.get("file") == path.name))
        if pat and pat["id"] not in seen:
            seen.add(pat["id"]); patients.append(pat)
    if patients:
        docs.append(patient_directory_doc(sorted(patients, key=lambda p: p["id"])))
    splitter = RecursiveCharacterTextSplitter(chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP)
    chunks = splitter.split_documents(docs)
    emb = GoogleGenerativeAIEmbeddings(model=EMBED_MODEL, google_api_key=key)
    try:  # clear old collection so a rebuild never duplicates chunks (notebook did this too)
        Chroma(collection_name=COLLECTION, embedding_function=emb,
               persist_directory=str(CHROMA_DIR)).delete_collection()
    except Exception:
        pass
    Chroma.from_documents(chunks, emb, collection_name=COLLECTION,
                          persist_directory=str(CHROMA_DIR))
    reg = refresh_registry(paths)
    reg["embedded"] = True
    save_registry(reg)
    return {"chunks": len(chunks), "files": len(paths), "patients": len(patients)}


def get_vector_store():
    key = get_api_key()
    if not key:
        raise RuntimeError("GEMINI_API_KEY is not set.")
    from langchain_chroma import Chroma
    from langchain_google_genai import GoogleGenerativeAIEmbeddings
    return Chroma(collection_name=COLLECTION,
                  embedding_function=GoogleGenerativeAIEmbeddings(
                      model=EMBED_MODEL, google_api_key=key),
                  persist_directory=str(CHROMA_DIR))


def clean_chunk_text(text: str) -> str:
    return re.sub(r"^\[Source file: [^\]]+\]\n(\[OCR text\]\n)?", "", text).strip()


def ask_rag(question: str, language: str = "en"):
    """Notebook steps 4-5, with a similarity threshold: only chunks scoring
    >= SIMILARITY_THRESHOLD are used as context or cited. No chunk passing
    the threshold -> fallback answer, no sources. Sources carry chunk text
    and score. System prompt stays verbatim; only a language line is added."""
    from langchain_core.output_parsers import StrOutputParser
    from langchain_core.prompts import ChatPromptTemplate
    from langchain_core.runnables import RunnablePassthrough
    from langchain_google_genai import ChatGoogleGenerativeAI

    db = get_vector_store()
    scored = db.similarity_search_with_relevance_scores(question, k=5)
    docs = [d for d, s in scored
            if s >= SIMILARITY_THRESHOLD and d.metadata.get("file") != "Patient Directory"]
    scores = {id(d): round(s, 3) for d, s in scored
              if s >= SIMILARITY_THRESHOLD and d.metadata.get("file") != "Patient Directory"}
    if not docs:
        return FALLBACK, [], True
    llm = ChatGoogleGenerativeAI(model=LLM_MODEL, temperature=0,
                                 google_api_key=get_api_key())
    system = SYSTEM_PROMPT
    if language != "en":
        system += f"\nAnswer in {LANG_NAMES[language]}."
    prompt = ChatPromptTemplate.from_messages([("system", system), ("human", "{question}")])

    def fmt(d):
        return "\n\n".join(i.page_content for i in d)

    chain = ({"context": lambda _q: fmt(docs), "question": RunnablePassthrough()}
             | prompt | llm | StrOutputParser())
    answer = chain.invoke(question)
    if "could not find" in answer:
        return answer, [], True
    seen = set()
    sources = []
    for d in docs:
        key = (d.metadata["file"], d.metadata.get("page", 0) + 1)
        if key in seen:
            continue
        seen.add(key)
        sources.append({"file": key[0], "page": key[1],
                        "text": clean_chunk_text(d.page_content),
                        "score": scores[id(d)]})
    sources.sort(key=lambda s: (s["file"], s["page"]))
    return answer, sources, False


# ---------- visit info: parsed from the real guide PDF at startup ----------

def _extract_section(text: str, start: str, end: str) -> str | None:
    m = re.search(re.escape(start) + r"(.*?)" + re.escape(end), text, re.S)
    if not m:
        return None
    return re.sub(r"\s+", " ", m.group(1)).strip(" -:.")


def load_visit_info():
    """Timings/fees/emergency taken from Clinic_Patient_Information_Guide.pdf
    itself — never invented. If a section is missing, the value says so and
    gives the closest guide excerpt."""
    info = {"timings": None, "fees": None, "emergency": None,
            "source_file": GUIDE_FILE}
    try:
        pages = PyPDFLoader(str(DATA_DIR / GUIDE_FILE)).load()
        text = re.sub(r"\s+", " ", "\n".join(p.page_content for p in pages))
    except Exception as e:
        excerpt = f"Could not read {GUIDE_FILE}: {e}"
        return {**info, "timings": excerpt, "fees": excerpt, "emergency": excerpt}
    info["timings"] = _extract_section(text, "1. Clinic timings", "2. Booking")
    info["fees"] = _extract_section(text, "3. Consultation fees", "4. Lab tests")
    info["emergency"] = _extract_section(text, "5. Emergency policy", "6. Prescription")
    for field in ("timings", "fees", "emergency"):
        if not info[field]:
            info[field] = ("Not found as a separate section in the guide; "
                           f"closest excerpt from {GUIDE_FILE}: {text[:300]}")
    return info


VISIT_INFO = load_visit_info()


# ---------- startup: seed the index from repo/data/*.pdf if empty ----------
from contextlib import asynccontextmanager


@asynccontextmanager
async def lifespan(_app):
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    init_db()
    global VISIT_INFO
    VISIT_INFO = load_visit_info()
    if not load_registry()["files"]:
        refresh_registry(all_pdf_paths())
        if get_api_key():
            try:
                build_vector_store()
            except Exception as e:
                print("Startup embedding failed (key may be invalid):", e)
        else:
            print("No GEMINI_API_KEY — registry seeded, vector store not embedded yet.")
    yield


app.router.lifespan_context = lifespan


# ---------- endpoints ----------
@app.get("/")
def root():
    return {"service": "Health RAG Chatbot — Sunrise Family Clinic",
            "note": "Synthetic demo data only. Decision-support, not a diagnosis tool.",
            "endpoints": ["/health", "/stats", "/patients", "/upload", "/ask", "/auth/login",
                          "/auth/me", "/visit-info", "/tokens", "/tokens/take", "/tokens/next",
                          "/test-questions", "/admin/stats", "/admin/queries",
                          "/admin/api-key/status", "/admin/api-key", "/admin/api-key/test"]}


def registry_or_seed():
    """Registry, seeding it from data/*.pdf on first use (startup events
    don't always fire under TestClient, so don't rely on them alone).
    Also refreshes when the PDF set on disk changed (e.g. new seed PDFs)."""
    reg = load_registry()
    disk = sorted(p.name for p in all_pdf_paths())
    if not reg.get("files") or sorted(f["file"] for f in reg["files"]) != disk:
        reg = refresh_registry(all_pdf_paths())
    return reg


@app.get("/health")
def health():
    reg = registry_or_seed()
    return {"status": "ok", "api_key_set": bool(get_api_key()),
            "index_exists": index_is_embedded(),
            "embedded": reg.get("embedded", False),
            "files_indexed": len(reg.get("files", [])),
            "patients_indexed": len(reg.get("patients", [])),
            "note": (None if get_api_key() else
                     "No Gemini API key set — /ask and embedding are disabled until a key is "
                     "entered on the website (admin Settings) or set as GEMINI_API_KEY.")}


@app.get("/stats")
def stats():
    reg = registry_or_seed()
    return {"patients": len(reg.get("patients", [])),
            "documents": len(reg.get("files", []))}


@app.post("/auth/login")
def login(body: dict):
    username = (body.get("username") or "").strip()
    password = body.get("password") or ""
    with db_conn() as conn:
        row = conn.execute("SELECT password_hash, role FROM users WHERE username = ?",
                           (username,)).fetchone()
    if not row or not bcrypt.checkpw(password.encode(), row["password_hash"].encode()):
        raise HTTPException(401, "Invalid username or password.")
    return {"access_token": create_token(username, row["role"]),
            "token_type": "bearer", "username": username, "role": row["role"]}


@app.post("/auth/register")
def register(body: dict):
    """Create a staff account. Role is always "staff" — the request body
    cannot pick a role, so nobody can sign up as admin. Returns a JWT
    like /auth/login, so the new account is signed in immediately."""
    username = (body.get("username") or "").strip()
    password = body.get("password") or ""
    if not re.fullmatch(r"[A-Za-z0-9_.\-]{3,30}", username):
        raise HTTPException(400, "Username must be 3-30 characters: letters, numbers, _ . -")
    if len(password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters.")
    with db_conn() as conn:
        if conn.execute("SELECT 1 FROM users WHERE username = ?",
                        (username,)).fetchone():
            raise HTTPException(409, "That username is already taken.")
        conn.execute(
            "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
            (username, bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode(),
             "staff"))
        conn.commit()
    return {"access_token": create_token(username, "staff"),
            "token_type": "bearer", "username": username, "role": "staff"}


@app.get("/auth/me")
def me(user: dict = Depends(get_current_user)):
    return {"username": user["username"], "role": user["role"]}


@app.get("/patients")
def patients(user: dict = Depends(get_current_user)):
    return {"patients": registry_or_seed().get("patients", [])}


@app.post("/upload")
async def upload(files: list[UploadFile] = File(...),
                 user: dict = Depends(get_current_user)):
    """Accept multiple PDFs, save to data/uploads, OCR scanned ones, re-index.
    With a key: rebuilds the Chroma store from all PDFs. Without a key:
    registers the PDFs (patients + file list) and marks the vector store
    as not embedded yet — re-upload / restart once a key is set."""
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    saved, ocr_report = [], []
    for f in files:
        if not f.filename.lower().endswith(".pdf"):
            raise HTTPException(400, f"{f.filename} is not a PDF.")
        dest = UPLOAD_DIR / Path(f.filename).name
        dest.write_bytes(await f.read())
        saved.append(dest.name)
        try:
            pages = PyPDFLoader(str(dest)).load()
            raw = "\n".join(p.page_content for p in pages)
        except Exception:
            raw = ""
        ocr_applied = False
        if len(raw.strip()) < 50:
            if ocr_text_for(dest, raw).strip():
                ocr_applied = True
        ocr_report.append({"file": dest.name, "ocr_applied": ocr_applied})
    reg = refresh_registry(all_pdf_paths())
    embedded = False
    if get_api_key():
        try:
            build_vector_store()
            embedded = True
        except Exception as e:
            raise HTTPException(502, f"Saved, but embedding failed: {e}")
    return {"uploaded": saved, "files_indexed": len(reg["files"]),
            "patients": reg["patients"], "embedded": embedded, "ocr": ocr_report,
            "note": None if embedded else
            "Saved and registered, but not embedded yet — set GEMINI_API_KEY and re-upload or restart to enable search."}


@app.post("/ask")
def ask(body: dict, user: dict = Depends(get_current_user)):
    question = (body.get("question") or "").strip()
    language = body.get("language") or "en"
    if language not in LANG_NAMES:
        raise HTTPException(400, "language must be one of 'en', 'hi', 'mr'.")
    if not question:
        raise HTTPException(400, "question is required.")
    # Fix (b): greetings get a friendly reply WITHOUT calling the LLM.
    if GREETINGS.match(question):
        answer = ("Hello! I'm the Sunrise Family Clinic assistant. "
                  "Ask me about a patient (by name or ID, e.g. P1001), "
                  "a medicine, or the clinic — I answer only from the clinic records.")
        log_query(user["username"], question, answer, [], False, language)
        return {"answer": answer, "sources": [], "language": language}
    # Fix (a): patient-list questions answered from the registry (also covered
    # by the Patient Directory document in the vector store for the LLM path).
    if PATIENT_LIST_Q.search(question):
        pats = registry_or_seed().get("patients", [])
        if not pats:
            log_query(user["username"], question, FALLBACK, [], True, language)
            return {"answer": FALLBACK, "sources": [], "language": language}
        lines = ["Our patients in the clinic records are:"] + \
                [f"- {p['id']} — {p['name']}" for p in pats]
        answer = "\n".join(lines)
        sources = [{"file": p["file"], "page": 1,
                    "text": f"{p['id']} — {p['name']}", "score": 1.0} for p in pats]
        log_query(user["username"], question, answer, sources, False, language)
        return {"answer": answer, "sources": sources, "language": language}
    if not get_api_key():
        raise HTTPException(
            503, "GEMINI_API_KEY is not set. Set it in the backend environment "
                 "(see backend/README.md) and restart — /ask needs the Gemini API.")
    if not index_is_embedded():
        try:
            build_vector_store()
        except Exception as e:
            raise HTTPException(502, f"Could not build the search index: {e}")
    try:
        answer, sources, is_fallback = ask_rag(question, language)
    except Exception as e:
        raise HTTPException(502, f"Gemini request failed: {e}")
    log_query(user["username"], question, answer, sources, is_fallback, language)
    return {"answer": answer, "sources": sources, "language": language}


@app.get("/visit-info")
def visit_info():
    return VISIT_INFO


@app.get("/tokens")
def list_tokens():
    with db_conn() as conn:
        cur = conn.execute("SELECT * FROM tokens WHERE status = 'current'").fetchone()
        waiting = conn.execute(
            "SELECT * FROM tokens WHERE status = 'waiting' ORDER BY number").fetchall()
        served = conn.execute(
            "SELECT COUNT(*) c FROM tokens WHERE status = 'served'").fetchone()["c"]
    return {"current": ({"number": cur["number"], "name": cur["name"]} if cur else None),
            "waiting": [{"number": r["number"], "name": r["name"],
                         "created_at": r["created_at"]} for r in waiting],
            "served_count": served}


@app.post("/tokens/take")
def take_token(body: dict):
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(400, "name is required.")
    with db_conn() as conn:
        row = conn.execute("SELECT COALESCE(MAX(number), 0) + 1 AS n FROM tokens").fetchone()
        number = row["n"]
        conn.execute("INSERT INTO tokens (number, name, status, created_at) VALUES (?, ?, 'waiting', ?)",
                     (number, name, datetime.now(timezone.utc).isoformat()))
        pos = conn.execute(
            "SELECT COUNT(*) c FROM tokens WHERE status = 'waiting' AND number <= ?",
            (number,)).fetchone()["c"]
        conn.commit()
    return {"number": number, "position": pos}


@app.post("/tokens/next")
def next_token(user: dict = Depends(require_staff_or_admin)):
    with db_conn() as conn:
        cur = conn.execute("SELECT * FROM tokens WHERE status = 'current'").fetchone()
        if cur:
            conn.execute("UPDATE tokens SET status = 'served' WHERE number = ?",
                         (cur["number"],))
        nxt = conn.execute(
            "SELECT * FROM tokens WHERE status = 'waiting' ORDER BY number LIMIT 1").fetchone()
        if nxt:
            conn.execute("UPDATE tokens SET status = 'current' WHERE number = ?",
                         (nxt["number"],))
        conn.commit()
    return {"called": ({"number": nxt["number"], "name": nxt["name"]} if nxt else None)}


@app.get("/test-questions")
def test_questions():
    return {"questions": TEST_QUESTIONS}


@app.get("/admin/stats")
def admin_stats(user: dict = Depends(require_admin)):
    reg = registry_or_seed()
    rows = query_rows()
    total = len(rows)
    fallbacks = sum(1 for r in rows if r["fallback"])
    return {"documents_indexed": len(reg.get("files", [])),
            "questions_asked": total,
            "fallback_rate": (fallbacks / total) if total else 0.0,
            "recent_queries": rows[:5]}


@app.get("/admin/queries")
def admin_queries(user: dict = Depends(require_admin)):
    return {"queries": query_rows()}


@app.get("/admin/api-key/status")
def api_key_status_endpoint(user: dict = Depends(require_admin)):
    """Masked status of the active Gemini key. Never returns the full key."""
    return api_key_status()


@app.post("/admin/api-key")
def set_api_key(body: dict, user: dict = Depends(require_admin)):
    """Save a Gemini API key entered by an admin on the website. Takes effect
    immediately (key resolution is dynamic per request) — no restart needed.
    The key itself is never returned or logged, only its last 4 chars."""
    key = (body.get("api_key") or "").strip()
    if not key:
        raise HTTPException(400, "api_key is required.")
    if len(key) < 10:
        raise HTTPException(400, "That does not look like a Gemini API key.")
    set_manual_api_key(key, user["username"])
    return {"saved": True, **api_key_status()}


@app.delete("/admin/api-key")
def delete_api_key(user: dict = Depends(require_admin)):
    """Remove the manually entered key — the backend falls back to the
    server's own GEMINI_API_KEY from the environment."""
    clear_manual_api_key(user["username"])
    return {"removed": True, **api_key_status()}


@app.post("/admin/api-key/test")
def test_api_key(user: dict = Depends(require_admin)):
    """One tiny live call with the active key (a single embedding) to prove
    the key works. Uses ~1 API request — only run when the admin asks for it."""
    key = get_api_key()
    if not key:
        return {"ok": False, "detail": "No Gemini API key is configured."}
    try:
        from langchain_google_genai import GoogleGenerativeAIEmbeddings
        GoogleGenerativeAIEmbeddings(model=EMBED_MODEL, google_api_key=key).embed_query("ok")
    except Exception as e:
        return {"ok": False, "detail": f"Key check failed: {e}"}
    return {"ok": True, "detail": "Key works — Gemini answered the test call."}
