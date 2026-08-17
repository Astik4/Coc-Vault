# CoC Vault 

Flask + SQLite backend for CoC Vault. Same design as before, in Python —
replaces the frontend's LocalStorage persistence with real server-side
storage, adds JWT authentication, and **hash-chains every custody log
entry** so tampering with the database directly is detectable.

Tested end-to-end: register → login → create case → log evidence →
transfer custody → verify chain → simulate direct DB tampering with raw
SQL → confirmed the tamper is caught.

---

## How the hash chain works

Each custody log entry stores:
- `prev_hash` — the `entry_hash` of the previous entry for that evidence item (or a fixed genesis value `000...0` for the first entry)
- `entry_hash` — `SHA256(prev_hash + entry's own fields)`, computed in `compute_entry_hash()` in `db.py`

`GET /api/evidence/<id>/verify-chain` re-walks every entry in sequence,
recomputes each hash from scratch, and compares it to what's stored. If
any field in any past entry was edited directly in the database (bypassing
the API), every hash after that point stops matching, and the endpoint
reports exactly which entry broke.

---

## Project layout

```
app.py              — Flask app setup, blueprint registration, health check
db.py                — SQLite connection handling, schema, hash-chain helper
auth_utils.py         — JWT signing/verification, @token_required decorator
routes/
  auth.py             — POST /api/auth/register, /api/auth/login
  cases.py            — GET/POST /api/cases, DELETE /api/cases/<id> (cascades)
  evidence.py          — GET/POST /api/evidence, transfer + verify-chain, DELETE /api/evidence/<id>
```

This mirrors a typical Flask app structure — one blueprint per resource,
same pattern you've used in BOLAHawk/SecurScout.

---

## Demo / test data

`test_evidence/` contains exactly three realistic synthetic evidence files
(a spoofed executive email, suspicious auth logs, a flagged transaction
export) for a simulated Business Email Compromise case. Run
`python seed_demo_data.py` (with the server already running) to load a
full demo case — case, evidence, hashes, and one custody transfer — through
the real API. The script is idempotent: it uses a fixed case number
(`CASE-DEMO-BEC-2026`) and detects if that case already exists rather than
creating a duplicate on every run, so you always end up with exactly one
demo case and 3 evidence items, never a pile-up of repeated demo cases.
See `USER_GUIDE.md` in the project root for the full walkthrough.

## Setup

```bash
python3 -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# edit .env and set a real JWT_SECRET (any long random string)
python app.py
```

Server runs on `http://localhost:4000` by default. `coc_vault.db` (SQLite)
is created automatically on first run.

Health check: `GET http://localhost:4000/api/health` → `{"status":"ok"}`

### CORS

`CORS_ORIGIN` in `.env` accepts a comma-separated list of origins, so the
frontend works whether you run it via `npx http-server -p 8080`, VS Code's
Live Server (port 5500), or by opening `index.html` directly (`file://`,
which sends `Origin: null`). The default value already covers all three —
add your own origin to the list if you serve the frontend somewhere else.

---

## API Reference

All routes except `/api/health` and `/api/auth/*` require:
`Authorization: Bearer <token>`

### Auth
| Method | Route | Body | Notes |
|---|---|---|---|
| POST | `/api/auth/register` | `{ username, password, displayName }` | password min 8 chars |
| POST | `/api/auth/login` | `{ username, password }` | returns `{ token, user }` |

### Cases
| Method | Route | Body | Notes |
|---|---|---|---|
| GET | `/api/cases` | — | |
| POST | `/api/cases` | `{ caseNumber, leadInvestigator, badgeId, agency, suspect, incidentDate, notes }` | |
| GET | `/api/cases/<id>` | — | |
| DELETE | `/api/cases/<id>` | — | Cascades: deletes all evidence under the case and their custody logs. Returns `{ deleted, caseId, evidenceItemsDeleted }`. |

### Evidence
| Method | Route | Body | Notes |
|---|---|---|---|
| GET | `/api/evidence?caseId=...` | — | caseId optional filter |
| POST | `/api/evidence` | `{ caseId, itemId, evidenceType, makeModel, locationFound, collectedBy, fileHash }` | |
| POST | `/api/evidence/<evidenceId>/transfer` | `{ releasedBy, receivedBy, releasedSig, receivedSig, location, purpose, notes }` | |
| GET | `/api/evidence/<evidenceId>/verify-chain` | — | returns `{ intact, message, brokenAtSequence? }` |
| DELETE | `/api/evidence/<evidenceId>` | — | Deletes the item and its full custody log. Returns `{ deleted, evidenceId }`. |

The frontend's `api.js` already points at these exact routes — no frontend
changes are needed switching from the Node version to this one, only the
backend you run.

---

## Why Flask instead of Node here

The frontend (HTML/CSS/JS) has to be JavaScript no matter what — that's a
browser requirement, not a choice. But the backend didn't have to be, and
Flask matches the stack used across BOLAHawk, SecurScout, and LifeFlow, so
this project's backend is something you can actually read, modify, and
explain in an interview — which matters more than which framework looks
more "impressive" on paper.

---

## Security notes (student project scope, not production-hardened)

- Passwords hashed with Werkzeug's `generate_password_hash` (scrypt-based, salted) — never stored plaintext.
- JWT expires after 8 hours.
- Basic rate limiting on `/api/auth/*` (20 requests / 15 min) via Flask-Limiter.
- Case and evidence delete are hard deletes with server-side cascade (deleting a case also deletes its evidence and custody logs) — there's no "trash"/undo, so the frontend confirms before calling these routes.
- **Not yet done, worth adding if you keep building this:** per-case access control (any logged-in user can currently see, edit, and delete any case), soft-delete/archival instead of hard delete, HTTPS enforcement in production, refresh tokens, a production WSGI server (the built-in `app.run()` server says so itself — use gunicorn/waitress for real deployment), audit logging of *who* queried or deleted what.
