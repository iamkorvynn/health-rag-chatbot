# Health RAG Chatbot — Streamlit frontend

Simple chat UI that talks to the FastAPI backend. No RAG code here — it only
sends questions/uploads and shows answers + sources.

## Run

```bash
pip install -r requirements.txt
# start the backend first (see backend/README.md), then:
streamlit run app.py
```

Set the backend URL with the `API_URL` env var, or type it in the sidebar.
Default: `http://localhost:8000`.

## Features

- Chat box + history, sources listed under each answer
- Patient list in the sidebar (`GET /patients`)
- PDF upload → `POST /upload`
- Disclaimer shown at the top and bottom: "Decision-support only, not a replacement for a doctor."
