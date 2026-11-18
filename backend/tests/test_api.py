"""Tests that need NO Gemini key: /health, /patients, /upload, /ask-no-key.

Run from repo/backend:  python -m pytest tests/ -v
(Uses the FastAPI TestClient; startup seeding runs against repo/data/*.pdf.)
"""
import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ.pop("GEMINI_API_KEY", None)
os.environ.pop("GOOGLE_API_KEY", None)

from main import app  # noqa: E402

client = TestClient(app)


def test_health_no_key():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    assert r.json()["api_key_set"] is False


def test_patients_lists_seed_patients():
    r = client.get("/patients")
    assert r.status_code == 200
    pats = r.json()["patients"]
    assert {p["id"] for p in pats} == {"P1001", "P1002", "P1003"}
    assert {p["name"] for p in pats} == {"Rahul Mehta", "Sneha Kulkarni", "Arjun Nair"}


def test_ask_greeting_needs_no_key():
    r = client.post("/ask", json={"question": "hello"})
    assert r.status_code == 200
    assert "Sunrise" in r.json()["answer"]


def test_ask_patient_list_needs_no_key():
    r = client.post("/ask", json={"question": "List all my patients"})
    assert r.status_code == 200
    assert "P1001" in r.json()["answer"] and "P1003" in r.json()["answer"]


def test_ask_without_key_is_503_not_fake_answer():
    r = client.post("/ask", json={"question": "What is Rahul Mehta allergic to?"})
    assert r.status_code == 503
    assert "GEMINI_API_KEY" in r.json()["detail"]


def test_upload_pdf_registers_it():
    pdf = Path(__file__).resolve().parent.parent.parent / "data" / "Patient_P1001_Rahul_Mehta.pdf"
    with open(pdf, "rb") as fh:
        r = client.post("/upload", files=[("files", ("Patient_P1001_Rahul_Mehta.pdf", fh, "application/pdf"))])
    assert r.status_code == 200
    assert r.json()["embedded"] is False  # no key -> registered, not embedded
    assert "P1001" in str(r.json()["patients"])
