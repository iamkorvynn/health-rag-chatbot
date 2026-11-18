# Health RAG Chatbot — Backend (FastAPI)

Same pipeline as the notebook (`Health_RAG_Chatbot__1.ipynb`):
PyPDFLoader → `"[Source file: <name>]"` prefix → `RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=150)`
→ `GoogleGenerativeAIEmbeddings("models/gemini-embedding-001")` → Chroma collection `"clinic"`
→ retriever `k=5` → `ChatGoogleGenerativeAI("gemini-2.5-flash", temperature=0)` with the notebook's system prompt, verbatim.

Synthetic demo data only. **Decision-support for doctors, NOT a diagnosis tool.**

## Run locally

```bash
python -m venv venv && source venv/bin/activate
pip install -r backend/requirements.txt
# paste your key (see below), then:
cd backend && uvicorn main:app --reload --port 8000
```

## Where the Gemini key goes

**Numaan: this is the one thing you need to do.** Get a free key at https://aistudio.google.com/apikey and set it as an environment variable — never paste it into code or commit it:

```bash
export GEMINI_API_KEY=PASTE_YOUR_KEY_HERE
uvicorn main:app --port 8000
```

Or copy `backend/.env.example` to `backend/.env` and fill it in (`.env` is gitignored).
`GOOGLE_API_KEY` also works as a fallback, like the notebook.

Without a key the server still starts: `/health`, `/patients` and `/upload` work
(PDFs are registered from their text/metadata), but embedding and `/ask` are disabled —
`/ask` returns a clear `503` saying the key is missing. **Live answers have NOT been
tested without a key** — once you set one, restart and try
"What is Rahul Mehta allergic to?" (expect: Penicillin).

## Endpoints

| Method | Path | What it does |
|---|---|---|
| GET | `/` | Service info |
| GET | `/health` | Status: `api_key_set`, `index_exists` (embedded?), files/patients indexed |
| GET | `/patients` | `[{"id", "name", "file"}]` parsed from patient PDFs |
| POST | `/upload` | Multiple PDFs → saved to `data/uploads/`, re-indexed (see below) |
| POST | `/ask` | `{"question": "..."}` → `{"answer": "...", "sources": [{"file", "page"}]}` |

## Upload / indexing strategy

On upload we **rebuild the index from all PDFs in `data/`** (seed + uploads) instead of
surgically deleting per-file chunks — simpler and always consistent. The old Chroma
collection is deleted first (the notebook did the same on re-run) so chunks never duplicate.
Without a key, uploads are saved and registered (patients/file list) and marked
`"embedded": false`; re-upload or restart once a key is set to embed them.

On startup, if the registry is empty the seed PDFs in `repo/data/*.pdf` are registered,
and embedded too if a key is set — so the demo works out of the box.

## Two notebook limits, fixed

1. **"List all my patients"** — a *Patient Directory* document (one line per patient:
   id, name, file) is added to the vector store, and `/ask` also answers patient-list
   questions directly from the registry, so it works even without a key.
2. **Greetings** (`hi`, `hello`, `good morning`, …) get a brief friendly reply in code,
   without calling the LLM (the notebook answered them with the fallback).

## Deploy on Render (free)

1. Push this repo to GitHub. In Render: **New → Web Service → pick this repo**.
2. Root directory `backend`, build command `pip install -r requirements.txt`,
   start command `uvicorn main:app --host 0.0.0.0 --port $PORT`.
   (Or use the included `render.yaml` + `Dockerfile`: New → Blueprint, pick the repo.)
3. Environment → add `GEMINI_API_KEY` = your key.
4. Copy the service URL (e.g. `https://health-rag-backend.onrender.com`) and set it as
   `NEXT_PUBLIC_API_URL` on the Vercel site (and as the API URL in Streamlit).

## Tests (no key needed)

```bash
cd backend && python -m pytest tests/ -v
```
