# Health RAG Chatbot — Sunrise Family Clinic

A chatbot for doctors and staff that answers questions **only from the clinic's
uploaded PDFs** (patient records, treatment protocols, clinic guide), using the
exact pipeline from the notebook `Health_RAG_Chatbot__1.ipynb`:
PyPDFLoader → split (800/150) → Gemini embeddings → Chroma → retriever k=5 →
Gemini 2.5 Flash with the notebook's system prompt, verbatim.

> **Synthetic demo data only. Decision-support for doctors, NOT a diagnosis tool,
> and not a replacement for a doctor.** All 5 sample PDFs are fake patients.

## Structure

| Folder | What it is |
|---|---|
| `data/` | The 5 synthetic seed PDFs (13 pages). Uploads go to `data/uploads/`. |
| `backend/` | FastAPI backend — the RAG engine (`main.py`, `requirements.txt`, tests) |
| `streamlit_app/` | Streamlit chat UI (talks to the backend) |
| `web/` | Next.js + TypeScript website + PWA (talks to the same backend) |

## Quick start

```bash
# 1. Backend
python -m venv venv && source venv/bin/activate
pip install -r backend/requirements.txt
export GEMINI_API_KEY=PASTE_YOUR_KEY_HERE   # <-- see below
cd backend && uvicorn main:app --reload --port 8000

# 2a. Streamlit (in a second terminal)
pip install -r streamlit_app/requirements.txt
cd streamlit_app && streamlit run app.py

# 2b. Website (in a second terminal)
cd web && npm install && npm run dev        # http://localhost:3000
```

## Where Numaan pastes his Gemini key

Get a free key at https://aistudio.google.com/apikey, then set it **only as an
environment variable** — never in code, never committed:

- **Locally:** `export GEMINI_API_KEY=...` before starting the backend, or copy
  `backend/.env.example` → `backend/.env` and fill it in (`.env` is gitignored).
- **On Render:** dashboard → service → Environment → add `GEMINI_API_KEY`.
- **On Vercel:** the website does NOT need the key — only the backend does.

Without a key the backend still starts and `/health`, `/patients`, `/upload`
work, but embedding and `/ask` return a clear 503. **Live answers have not been
tested without a key** — set one, restart, and try "What is Rahul Mehta allergic to?"

## Two notebook limits, fixed

1. **"List all my patients"** now works — a Patient Directory document is added
   to the vector store, and `/ask` also answers it directly from the patient registry.
2. **Greetings** (`hi`, `hello`, …) get a brief friendly reply without calling the LLM.

## Deploy

- Website: Vercel, root directory `web`, env var `NEXT_PUBLIC_API_URL` = backend URL.
- Backend: Render (see `backend/README.md` + `backend/render.yaml`/`Dockerfile`),
  or a Cloudflare quick tunnel for a temporary public URL.
