# Health RAG Chatbot — Backend API Spec (authoritative contract)

Base URL (local/VPS): `http://127.0.0.1:8000`. Public tunnel URL is in
`~/workspace/health-rag/tunnel-url.txt` (same API, do not touch the tunnel).
Synthetic demo data only. Decision-support for doctors, NOT a diagnosis tool.

## Auth

- JWT Bearer auth. `Authorization: Bearer <access_token>`.
- `POST /auth/login` with `{"username", "password"}` returns
  `{"access_token", "token_type": "bearer", "username", "role"}`.
  Wrong credentials → `401 {"detail": "Invalid username or password"}`.
- `GET /auth/me` (Bearer) → `{"username", "role"}`. No/invalid token → `401`.
- Seeded demo accounts (documented, Numaan's project demo accounts):
  `admin / admin123` (role `admin`), `doctor / doctor123` (role `doctor`),
  `staff / staff123` (role `staff`). Passwords are bcrypt-hashed in SQLite
  (`backend/clinic.db`, table `users`).
- Roles: `admin` can use `/admin/*`; `/tokens/next` requires role `staff` or
  `admin`; `doctor`/`staff`/`admin` can all use the general authenticated
  endpoints. Any valid token works for `/ask`, `/patients`, `/upload`.
- Missing/invalid token on a protected endpoint → `401`.
  Forbidden role on `/admin/*` or `/tokens/next` → `403`.

## Retrieval / sources

- Retriever: Chroma collection `clinic`, Gemini embeddings
  (`models/gemini-embedding-001`), `k=5`, with a **similarity threshold of
  0.53** (cosine relevance score from `similarity_search_with_relevance_scores`;
  chunks scoring below 0.35 are dropped, so unrelated files stop appearing in
  citations). If no chunk passes the threshold, the answer is the fallback
  (see `/ask`).
- Every `/ask` source is `{"file", "page", "text", "score"}` where `text` is
  the retrieved chunk text (with the `[Source file: ...]` prefix stripped) and
  `score` is the relevance score rounded to 3 decimals. The Patient Directory
  document is never returned as a source.

## Endpoints

### GET `/`
No auth. `{"service", "note", "endpoints": [...]}` — service info.

### GET `/health`
No auth. `{"status": "ok", "api_key_set": bool, "index_exists": bool,
"embedded": bool, "files_indexed": int, "patients_indexed": int,
"note": str|null}`.

### GET `/stats`
No auth. `{"patients": int, "documents": int}` — computed live from the
registry/Chroma (patients = registered patients, documents = indexed files).

### POST `/auth/login`
No auth. Request `{"username": "...", "password": "..."}`.
Success `200 {"access_token", "token_type": "bearer", "username", "role"}`.
Bad credentials → `401`.

### POST `/auth/register`
No auth. Request `{"username": "...", "password": "..."}`.
Creates a **staff** account only — the role is fixed server-side, the body
cannot pick a role. Username must be 3-30 characters (letters, numbers,
`_ . -`); password at least 6 characters. Success `200` returns the same
JWT shape as `/auth/login` (signed in immediately). Username taken → `409`;
bad username/password → `400`.

### GET `/auth/me`
Bearer (any role). `200 {"username", "role"}`.

### GET `/patients`
Bearer (any role). `200 {"patients": [{"id", "name", "file"}, ...]}` sorted
by patient ID.

### POST `/ask`
Bearer (any role). Request `{"question": "...", "language": "en"|"hi"|"mr"}`
— `language` is optional, default `"en"`. The LLM is instructed to answer
in that language; the system prompt is otherwise verbatim from the notebook.
Response `200 {"answer": "...", "sources": [{"file", "page", "text",
"score"}, ...], "language": "en"|"hi"|"mr"}`.
- Greetings (`hi`, `hello`, …) get a friendly reply, no LLM call,
  `sources: []`, `language` echoed.
- Patient-list questions are answered from the registry,
  `sources: [{"file", "page": 1, "text": "<patient line>", "score": 1.0}, ...]`.
- If the answer is not in the records, `answer` is the fallback
  `"Sorry, I could not find that in the clinic records. Please check with
  the treating doctor."` and `sources: []`.
- No API key → `503`. Empty/missing question → `400`.
- Every call is logged to SQLite (see Query log).

### POST `/upload`
Bearer (any role). Multipart form, field `files` (one or more PDFs).
Saves to `data/uploads/`, re-indexes (rebuilds Chroma from all PDFs).
Response `200 {"uploaded": [...names], "files_indexed": int,
"patients": [...], "embedded": bool, "ocr": [{"file", "ocr_applied": bool}, ...],
"note": str|null}`.
- Non-PDF → `400`.
- OCR: if a PDF yields no (or almost no, < 50 chars) extractable text, it is
  OCR'd (tesseract via `ocrmypdf`, falling back to `pytesseract` +
  `pdf2image`) and the OCR text is indexed, so scanned PDFs become searchable.
  `ocr_applied` reports per file whether OCR ran.
- No API key → saved + registered, `embedded: false`.

### GET `/visit-info`
No auth. `200 {"timings": str, "fees": str, "emergency": str,
"source_file": "Clinic_Patient_Information_Guide.pdf"}`.
Values are extracted from the real `Clinic_Patient_Information_Guide.pdf`
text at startup. If a field genuinely cannot be found in the guide, its
value is the closest guide excerpt and says so — never an invented fee
or timing.

### GET `/tokens`
No auth. `200 {"current": {"number": int, "name": str} | null,
"waiting": [{"number": int, "name": str, "created_at": str}, ...],
"served_count": int}`.

### POST `/tokens/take`
No auth. Request `{"name": "..."}`. Response `200 {"number": int,
"position": int}` — `position` is 1-based place in the waiting queue
(1 = next to be called).

### POST `/tokens/next`
Bearer, role `staff` or `admin`. No body. Advances `current` to the next
waiting token. Response `200 {"called": {"number": int, "name": str} | null}`.
`called: null` when the queue is empty (current becomes `null`).

### GET `/test-questions`
No auth. `200 {"questions": [{"id": int, "question": str, "expected": str},
...]}` — ~8 fixture questions; `expected` is the key phrase the live
answer must contain (the test spec, not results).

### GET `/admin/stats`
Bearer, role `admin` only. `200 {"documents_indexed": int,
"questions_asked": int, "fallback_rate": float,
"recent_queries": [{"id", "timestamp", "username", "question", "answer",
"sources", "fallback", "language"}, ...]}` — computed LIVE from the
SQLite query log and Chroma/registry, never hardcoded. `fallback_rate` is
the fraction of logged questions that fell back (0.0 when no questions yet).
`recent_queries` is the 5 most recent, most recent first.

### GET `/admin/queries`
Bearer, role `admin` only. `200 {"queries": [{"id", "timestamp",
"username", "question", "answer", "sources", "fallback", "language"},
...]}` — all logged questions, most recent first. `sources` is the list
of source objects as returned by `/ask`.

### GET `/admin/api-key/status`
Bearer, role `admin` only. `200 {"configured": bool, "source":
"manual" | "env" | "none", "masked": <last 4 chars of the active key> |
null}`. The full key is never returned.

### POST `/admin/api-key`
Bearer, role `admin` only. Body `{"api_key": "<Gemini key>"}`. Stores the
key in SQLite (`settings` table) and it takes effect immediately — key
resolution is dynamic per request, no restart needed. A manually entered
key takes precedence over the server's `GEMINI_API_KEY` env var. Returns
`{"saved": true, "configured": true, "source": "manual", "masked":
"<last 4>"}`. Empty / too-short keys → `400`. The key itself is never
returned or logged; changes are recorded (who/when, no value) in
`settings_log`.

### DELETE `/admin/api-key`
Bearer, role `admin` only. Removes the manually entered key; the backend
falls back to the server's `GEMINI_API_KEY`. Returns the new status.

### POST `/admin/api-key/test`
Bearer, role `admin` only. One tiny live embedding call with the active
key. `200 {"ok": true, "detail": ...}` when Gemini answers, or
`{"ok": false, "detail": "<error>"}` when the key is invalid / quota is
exhausted. Uses ~1 API request.

## Query log (SQLite `backend/clinic.db`, table `queries`)

Every `/ask` call logs one row: `question`, `answer`, `sources` (JSON),
`fallback` (bool), `timestamp` (UTC ISO), `username` (from the JWT),
`language`. Greeting and patient-list answers are logged too.

## Token queue (SQLite `backend/clinic.db`, table `tokens`)

Rows: `number` (sequential, never reused within the DB), `name`,
`status` (`waiting` | `current` | `served`), `created_at` (UTC ISO).
`served_count` = rows with status `served`.

## Errors

- `400` — bad request (missing question, non-PDF upload, missing name).
- `401` — missing/invalid token, or bad login credentials.
- `403` — valid token but wrong role.
- `502` — Gemini/embedding failure.
- `503` — no Gemini API key set (embedding / `/ask`).
