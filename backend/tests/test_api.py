"""Tests that need NO Gemini key: /health, /stats, auth, /patients, /ask-no-key,
/visit-info, /tokens, /test-questions, /admin/* role checks.

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


def login(username="doctor", password="doctor123"):
    r = client.post("/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


AUTH = login()
ADMIN = login("admin", "admin123")


def test_health_no_key():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    assert r.json()["api_key_set"] is False


def test_stats_public():
    r = client.get("/stats")
    assert r.status_code == 200
    assert r.json()["patients"] == 6
    # 8 seed documents + any user uploads in data/uploads/ (verification
    # runs re-uploaded seed PDFs there); the count only grows from 8.
    assert r.json()["documents"] >= 8


def test_login_all_seed_accounts():
    for u, p, role in [("admin", "admin123", "admin"),
                       ("doctor", "doctor123", "doctor"),
                       ("staff", "staff123", "staff")]:
        r = client.post("/auth/login", json={"username": u, "password": p})
        assert r.status_code == 200
        assert r.json()["role"] == role and r.json()["token_type"] == "bearer"


def test_login_wrong_password_is_401():
    r = client.post("/auth/login", json={"username": "admin", "password": "wrong"})
    assert r.status_code == 401


def test_register_creates_staff_account_and_can_log_in():
    import uuid
    from main import db_conn
    username = f"regtest_{uuid.uuid4().hex[:8]}"
    try:
        r = client.post("/auth/register", json={"username": username, "password": "secret99"})
        assert r.status_code == 200, r.text
        # New accounts are always staff — never admin, even if asked.
        assert r.json()["role"] == "staff" and r.json()["username"] == username
        assert r.json()["token_type"] == "bearer"
        # The new account can log in and its token works.
        r = client.post("/auth/login", json={"username": username, "password": "secret99"})
        assert r.status_code == 200
        headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
        r = client.get("/auth/me", headers=headers)
        assert r.json() == {"username": username, "role": "staff"}
        # Duplicate username is rejected.
        r = client.post("/auth/register", json={"username": username, "password": "other99"})
        assert r.status_code == 409
    finally:
        with db_conn() as conn:
            conn.execute("DELETE FROM users WHERE username = ?", (username,))
            conn.commit()


def test_register_rejects_admin_role_and_bad_input():
    # Asking for admin still creates staff (role is fixed server-side).
    import uuid
    from main import db_conn
    username = f"regtest_{uuid.uuid4().hex[:8]}"
    try:
        r = client.post("/auth/register", json={"username": username, "password": "secret99", "role": "admin"})
        assert r.status_code == 200, r.text
        assert r.json()["role"] == "staff"
    finally:
        with db_conn() as conn:
            conn.execute("DELETE FROM users WHERE username = ?", (username,))
            conn.commit()
    # Bad usernames and short passwords are rejected.
    assert client.post("/auth/register", json={"username": "ab", "password": "secret99"}).status_code == 400
    assert client.post("/auth/register", json={"username": "bad name!", "password": "secret99"}).status_code == 400
    assert client.post("/auth/register", json={"username": "goodname", "password": "short"}).status_code == 400


def test_auth_me():
    r = client.get("/auth/me", headers=AUTH)
    assert r.json() == {"username": "doctor", "role": "doctor"}


def test_patients_needs_auth():
    assert client.get("/patients").status_code == 401


def test_patients_lists_seed_patients():
    r = client.get("/patients", headers=AUTH)
    assert r.status_code == 200
    pats = r.json()["patients"]
    assert {p["id"] for p in pats} == {"P1001", "P1002", "P1003", "P1004", "P1005", "P1006"}
    assert {p["name"] for p in pats} == {"Rahul Mehta", "Sneha Kulkarni", "Arjun Nair",
                                         "Meera Joshi", "Kabir Singh", "Ananya Rao"}


def test_ask_greeting_needs_no_key():
    r = client.post("/ask", json={"question": "hello"}, headers=AUTH)
    assert r.status_code == 200
    assert "Sunrise" in r.json()["answer"]
    assert r.json()["language"] == "en"


def test_ask_patient_list_needs_no_key():
    r = client.post("/ask", json={"question": "List all my patients"}, headers=AUTH)
    assert r.status_code == 200
    assert "P1001" in r.json()["answer"] and "P1006" in r.json()["answer"]


def test_ask_without_key_is_503_not_fake_answer():
    r = client.post("/ask", json={"question": "What is Rahul Mehta allergic to?"},
                    headers=AUTH)
    assert r.status_code == 503
    assert "GEMINI_API_KEY" in r.json()["detail"]


def test_ask_without_token_is_401():
    r = client.post("/ask", json={"question": "hello"})
    assert r.status_code == 401


def test_visit_info_from_guide():
    r = client.get("/visit-info")
    assert r.status_code == 200
    assert "9:00 AM - 1:00 PM" in r.json()["timings"]
    assert "Rs. 500" in r.json()["fees"]
    assert "108" in r.json()["emergency"]
    assert r.json()["source_file"] == "Clinic_Patient_Information_Guide.pdf"


def test_test_questions():
    r = client.get("/test-questions")
    assert r.status_code == 200
    qs = r.json()["questions"]
    assert len(qs) >= 8
    assert qs[0]["expected"] == "Penicillin"


def test_token_queue_flow():
    r = client.get("/tokens")
    assert r.status_code == 200
    assert "current" in r.json() and "waiting" in r.json()
    r = client.post("/tokens/take", json={"name": "Test Patient"})
    assert r.status_code == 200 and r.json()["number"] >= 1
    r = client.post("/tokens/next", headers=ADMIN)
    assert r.status_code == 200
    assert r.json()["called"] is not None
    # doctor cannot advance the queue
    assert client.post("/tokens/next", headers=AUTH).status_code == 403


def test_admin_stats_needs_admin():
    assert client.get("/admin/stats").status_code == 401
    assert client.get("/admin/stats", headers=AUTH).status_code == 403
    r = client.get("/admin/stats", headers=ADMIN)
    assert r.status_code == 200
    assert r.json()["documents_indexed"] >= 8  # 8 seed + uploads, see above
    assert r.json()["questions_asked"] >= 2  # greeting + list logged above


def test_admin_queries():
    r = client.get("/admin/queries", headers=ADMIN)
    assert r.status_code == 200
    assert isinstance(r.json()["queries"], list)


def test_upload_pdf_registers_it():
    pdf = Path(__file__).resolve().parent.parent.parent / "data" / "Patient_P1001_Rahul_Mehta.pdf"
    with open(pdf, "rb") as fh:
        r = client.post("/upload", headers=AUTH,
                        files=[("files", ("Patient_P1001_Rahul_Mehta.pdf", fh, "application/pdf"))])
    assert r.status_code == 200
    assert r.json()["embedded"] is False  # no key -> registered, not embedded
    assert "P1001" in str(r.json()["patients"])


def test_api_key_status_needs_admin():
    assert client.get("/admin/api-key/status").status_code == 401
    assert client.get("/admin/api-key/status", headers=AUTH).status_code == 403


def test_api_key_set_status_delete_flow():
    # Env keys are popped at import in this test process; a manual key is
    # set and deleted inside this test (finally cleans up no matter what).
    try:
        r = client.get("/admin/api-key/status", headers=ADMIN)
        assert r.status_code == 200
        assert r.json()["configured"] is False
        assert r.json()["source"] == "none"
        assert r.json()["masked"] is None
        # non-admin cannot set a key
        assert client.post("/admin/api-key", json={"api_key": "DUMMY-KEY-TEST-1234"},
                           headers=AUTH).status_code == 403
        # empty / too-short keys rejected
        assert client.post("/admin/api-key", json={"api_key": ""}, headers=ADMIN).status_code == 400
        assert client.post("/admin/api-key", json={"api_key": "short"}, headers=ADMIN).status_code == 400
        # set a dummy key — full key is never returned, only last 4 chars
        r = client.post("/admin/api-key", json={"api_key": "DUMMY-KEY-TEST-1234"}, headers=ADMIN)
        assert r.status_code == 200
        assert r.json()["saved"] is True
        assert r.json()["source"] == "manual"
        assert r.json()["masked"] == "1234"
        assert "DUMMY-KEY-TEST-1234" not in r.text
        r = client.get("/admin/api-key/status", headers=ADMIN)
        assert r.json() == {"configured": True, "source": "manual", "masked": "1234"}
        # test endpoint: an invalid key reports failure, not success
        r = client.post("/admin/api-key/test", headers=ADMIN)
        assert r.status_code == 200
        assert r.json()["ok"] is False
        # delete -> back to no key (env popped in this test process)
        r = client.delete("/admin/api-key", headers=ADMIN)
        assert r.status_code == 200
        assert r.json()["removed"] is True
        assert r.json()["configured"] is False
        assert r.json()["source"] == "none"
    finally:
        client.delete("/admin/api-key", headers=ADMIN)
