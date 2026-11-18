"""Health RAG Chatbot — Streamlit frontend (Sunrise Family Clinic).

Talks to the FastAPI backend (backend/main.py). No RAG code lives here —
this app only sends questions/uploads and shows answers + sources.

Run:  streamlit run app.py
API URL: env var API_URL, or type it in the sidebar (default http://localhost:8000).
"""
import os

import requests
import streamlit as st

API_URL = os.environ.get("API_URL", "http://localhost:8000").rstrip("/")
DISCLAIMER = "Decision-support only, not a replacement for a doctor. Synthetic demo data."

st.set_page_config(page_title="Health RAG Chatbot — Sunrise Family Clinic",
                   page_icon="🏥")
st.title("🏥 Health RAG Chatbot")
st.caption("Sunrise Family Clinic — answers only from the clinic records.")
st.warning(DISCLAIMER)

# --- sidebar: API URL + patients + upload ---
with st.sidebar:
    st.header("Settings")
    api_url = st.text_input("Backend API URL", API_URL)
    st.header("Patients")
    try:
        patients = requests.get(f"{api_url}/patients", timeout=5).json().get("patients", [])
    except Exception:
        patients = []
        st.error("Backend not reachable — is it running? (see README)")
    for p in patients:
        st.write(f"**{p['id']}** — {p['name']}")

    st.header("Upload PDFs")
    files = st.file_uploader("Clinic PDFs", type="pdf", accept_multiple_files=True)
    if files and st.button("Upload & index"):
        resp = requests.post(f"{api_url}/upload",
                             files=[("files", (f.name, f.getvalue(), "application/pdf"))
                                    for f in files], timeout=120)
        if resp.ok:
            st.success(f"Uploaded {resp.json()['uploaded']}"
                       + ("" if resp.json()["embedded"]
                          else " — registered, not embedded yet (no API key on backend)."))
            st.rerun()
        else:
            st.error(resp.text)

# --- chat ---
if "history" not in st.session_state:
    st.session_state.history = []  # list of {"q": ..., "a": ..., "sources": [...]}

for msg in st.session_state.history:
    st.chat_message("user").write(msg["q"])
    with st.chat_message("assistant"):
        st.write(msg["a"])
        if msg["sources"]:
            st.caption("Sources: " + ", ".join(
                f"{s['file']} (p.{s['page']})" for s in msg["sources"]))

question = st.chat_input("Ask about a patient, medicine, or the clinic…")
if question:
    st.chat_message("user").write(question)
    try:
        r = requests.post(f"{api_url}/ask", json={"question": question}, timeout=120)
        if r.ok:
            data = r.json()
            answer, sources = data["answer"], data.get("sources", [])
        else:
            answer = f"Backend error ({r.status_code}): {r.json().get('detail', r.text)}"
            sources = []
    except Exception as e:
        answer, sources = f"Could not reach the backend at {api_url}: {e}", []
    with st.chat_message("assistant"):
        st.write(answer)
        if sources:
            st.caption("Sources: " + ", ".join(
                f"{s['file']} (p.{s['page']})" for s in sources))
    st.session_state.history.append({"q": question, "a": answer, "sources": sources})

st.caption(DISCLAIMER)
