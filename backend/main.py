"""Health RAG Chatbot — FastAPI backend (Sunrise Family Clinic).

Replicates the notebook pipeline (Health_RAG_Chatbot__1.ipynb) exactly:
  PyPDFLoader -> "[Source file: <name>]" prefix -> RecursiveCharacterTextSplitter
  (chunk_size=800, chunk_overlap=150) -> GoogleGenerativeAIEmbeddings
  ("models/gemini-embedding-001") -> Chroma collection "clinic"
  -> retriever k=5 -> ChatGoogleGenerativeAI ("gemini-2.5-flash", temp 0)
  with the notebook's system prompt, verbatim.

Synthetic demo data only. Decision-support for doctors, NOT a diagnosis tool.

API key: ONLY from the environment (GEMINI_API_KEY, or GOOGLE_API_KEY as
fallback, like the notebook). Never hardcode one, never commit one.
Without a key the server still runs: /health, /patients and /upload work
(the PDFs' text/metadata are registered), but embedding and /ask need the
key, so /ask returns a clear 503 until a key is set.
"""
import json
import os
import re
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from langchain_community.document_loaders import PyPDFLoader
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

BASE_DIR = Path(__file__).resolve().parent          # repo/backend/
REPO_DIR = BASE_DIR.parent                          # repo/
DATA_DIR = REPO_DIR / "data"                        # seed PDFs (5 synthetic)
UPLOAD_DIR = DATA_DIR / "uploads"                   # user-uploaded PDFs
CHROMA_DIR = BASE_DIR / "chroma_db"
REGISTRY_FILE = BASE_DIR / "registry.json"          # no-key index: files+patients
COLLECTION = "clinic"
CHUNK_SIZE, CHUNK_OVERLAP = 800, 150
EMBED_MODEL = "models/gemini-embedding-001"
LLM_MODEL = "gemini-2.5-flash"
FALLBACK = "Sorry, I could not find that in the clinic records. Please check with the treating doctor."

# EXACT system prompt from the notebook — do not reword it.
SYSTEM_PROMPT = """You are an assistant for doctors and staff at Sunrise Family Clinic.
Answer the question using only the context given below. Dont use any outside knowledge.
Be careful to use the right patient: match the name or patient ID in the question with the source file.
If the answer is not in the context say: "Sorry, I could not find that in the clinic records. Please check with the treating doctor."
Do not diagnose or suggest new medicines or doses beyond what is written in the records.
Keep the answer short and clear.

Context:
{context}"""

GREETINGS = re.compile(
    r"^\s*(hi|hii+|hello|hey|hiya|yo|good\s+(morning|afternoon|evening)|"
    r"what'?s up|whats up|how are you|namaste|good day)\b[.!?]*\s*$", re.I)
PATIENT_LIST_Q = re.compile(
    r"(list|show|give|name|who are|tell me).{0,30}(all )?(my |the )?(patients|patient names)"
    r"|who are my patients|list all my patients", re.I)

app = FastAPI(title="Health RAG Chatbot — Sunrise Family Clinic",
              description="Synthetic demo data only. Decision-support, not a diagnosis tool.")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"],
                   allow_headers=["*"])


def get_api_key():
    """Key from env only — GEMINI_API_KEY first, GOOGLE_API_KEY as fallback."""
    return os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")


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


def load_pdfs(paths):
    """Notebook step 1: PyPDFLoader per PDF, '[Source file: ...]' prefix, metadata['file']."""
    docs = []
    for path in paths:
        pages = PyPDFLoader(str(path)).load()
        for p in pages:
            p.page_content = f"[Source file: {path.name}]\n" + p.page_content
            p.metadata["file"] = path.name
        docs.extend(pages)
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
    os.environ["GOOGLE_API_KEY"] = key
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
    emb = GoogleGenerativeAIEmbeddings(model=EMBED_MODEL)
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


def get_retriever():
    key = get_api_key()
    if not key:
        raise RuntimeError("GEMINI_API_KEY is not set.")
    os.environ["GOOGLE_API_KEY"] = key
    from langchain_chroma import Chroma
    from langchain_google_genai import GoogleGenerativeAIEmbeddings
    db = Chroma(collection_name=COLLECTION,
                embedding_function=GoogleGenerativeAIEmbeddings(model=EMBED_MODEL),
                persist_directory=str(CHROMA_DIR))
    return db.as_retriever(search_kwargs={"k": 5})


def ask_rag(question: str):
    """Notebook steps 4-5: retriever k=5 | fmt | prompt | llm | StrOutputParser."""
    from langchain_core.output_parsers import StrOutputParser
    from langchain_core.prompts import ChatPromptTemplate
    from langchain_core.runnables import RunnablePassthrough
    from langchain_google_genai import ChatGoogleGenerativeAI

    retriever = get_retriever()
    llm = ChatGoogleGenerativeAI(model=LLM_MODEL, temperature=0)
    prompt = ChatPromptTemplate.from_messages([("system", SYSTEM_PROMPT), ("human", "{question}")])

    def fmt(d):
        return "\n\n".join(i.page_content for i in d)

    chain = ({"context": retriever | fmt, "question": RunnablePassthrough()}
             | prompt | llm | StrOutputParser())
    answer = chain.invoke(question)
    sources = []
    if "could not find" not in answer:
        srcs = {(d.metadata["file"], d.metadata["page"] + 1)
                for d in retriever.invoke(question)
                if d.metadata.get("file") != "Patient Directory"}
        sources = [{"file": f, "page": p} for f, p in sorted(srcs)]
    return answer, sources


# ---------- startup: seed the index from repo/data/*.pdf if empty ----------
@app.on_event("startup")
def startup():
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    if not load_registry()["files"]:
        reg = refresh_registry(all_pdf_paths())
        if get_api_key():
            try:
                build_vector_store()
            except Exception as e:
                print("Startup embedding failed (key may be invalid):", e)
        else:
            print("No GEMINI_API_KEY — registry seeded, vector store not embedded yet.")


# ---------- endpoints ----------
@app.get("/")
def root():
    return {"service": "Health RAG Chatbot — Sunrise Family Clinic",
            "note": "Synthetic demo data only. Decision-support, not a diagnosis tool.",
            "endpoints": ["/health", "/patients", "/upload", "/ask"]}


@app.get("/health")
def health():
    reg = load_registry()
    return {"status": "ok", "api_key_set": bool(get_api_key()),
            "index_exists": index_is_embedded(),
            "embedded": reg.get("embedded", False),
            "files_indexed": len(reg.get("files", [])),
            "patients_indexed": len(reg.get("patients", [])),
            "note": (None if get_api_key() else
                     "GEMINI_API_KEY not set — /ask and embedding are disabled until a key is set.")}


@app.get("/patients")
def patients():
    return {"patients": load_registry().get("patients", [])}


@app.post("/upload")
async def upload(files: list[UploadFile] = File(...)):
    """Accept multiple PDFs, save to data/uploads, re-index.
    With a key: rebuilds the Chroma store from all PDFs. Without a key:
    registers the PDFs (patients + file list) and marks the vector store
    as not embedded yet — re-upload / restart once a key is set."""
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    saved = []
    for f in files:
        if not f.filename.lower().endswith(".pdf"):
            raise HTTPException(400, f"{f.filename} is not a PDF.")
        dest = UPLOAD_DIR / Path(f.filename).name
        dest.write_bytes(await f.read())
        saved.append(dest.name)
    reg = refresh_registry(all_pdf_paths())
    embedded = False
    if get_api_key():
        try:
            build_vector_store()
            embedded = True
        except Exception as e:
            raise HTTPException(502, f"Saved, but embedding failed: {e}")
    return {"uploaded": saved, "files_indexed": len(reg["files"]),
            "patients": reg["patients"], "embedded": embedded,
            "note": None if embedded else
            "Saved and registered, but not embedded yet — set GEMINI_API_KEY and re-upload or restart to enable search."}


@app.post("/ask")
def ask(body: dict):
    question = (body.get("question") or "").strip()
    if not question:
        raise HTTPException(400, "question is required.")
    # Fix (b): greetings get a friendly reply WITHOUT calling the LLM.
    if GREETINGS.match(question):
        return {"answer": ("Hello! I'm the Sunrise Family Clinic assistant. "
                           "Ask me about a patient (by name or ID, e.g. P1001), "
                           "a medicine, or the clinic — I answer only from the clinic records."),
                "sources": []}
    # Fix (a): patient-list questions answered from the registry (also covered
    # by the Patient Directory document in the vector store for the LLM path).
    if PATIENT_LIST_Q.search(question):
        pats = load_registry().get("patients", [])
        if not pats:
            return {"answer": FALLBACK, "sources": []}
        lines = ["Our patients in the clinic records are:"] + \
                [f"- {p['id']} — {p['name']}" for p in pats]
        return {"answer": "\n".join(lines),
                "sources": [{"file": p["file"], "page": 1} for p in pats]}
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
        answer, sources = ask_rag(question)
    except Exception as e:
        raise HTTPException(502, f"Gemini request failed: {e}")
    return {"answer": answer, "sources": sources}
