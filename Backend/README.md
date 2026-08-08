# CoC Vault — Backend API

Node/Express + SQLite backend for CoC Vault. Replaces the frontend's LocalStorage
persistence with real server-side storage, adds JWT authentication, and
**hash-chains every custody log entry** so tampering with the database directly
is detectable — not just tampering with the uploaded evidence file.

This has been tested end-to-end (register → login → create case → log evidence
→ transfer custody → verify chain → simulate direct DB tampering → detect it).

---

## How the hash chain works

Each custody log entry stores:
- `prev_hash` — the `entry_hash` of the previous entry for that evidence item (or a fixed genesis value `000...0` for the first entry)
- `entry_hash` — `SHA256(prev_hash + entry's own fields)`

`GET /api/evidence/:id/verify-chain` re-walks every entry in sequence,
recomputes each hash from scratch, and compares it to what's stored. If
*any* field in *any* past entry was edited directly in the database
(bypassing the API), every hash after that point stops matching, and the
endpoint reports exactly which entry broke.

This doesn't make the log physically un-editable (nothing running on a
machine you don't control can guarantee that) — it makes editing
**detectable**, which is the property a real chain-of-custody actually needs.

---

## Setup

```bash
npm install
cp .env.example .env
# edit .env and set a real JWT_SECRET (any long random string)
npm start
```

Server runs on `http://localhost:4000` by default. `coc_vault.db` (SQLite)
is created automatically on first run in this folder.

Health check: `GET http://localhost:4000/api/health` → `{"status":"ok"}`

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
| Method | Route | Body |
|---|---|---|
| GET | `/api/cases` | — |
| POST | `/api/cases` | `{ caseNumber, leadInvestigator, badgeId, agency, suspect, notes }` |
| GET | `/api/cases/:id` | — |

### Evidence
| Method | Route | Body |
|---|---|---|
| GET | `/api/evidence?caseId=...` | — (caseId optional filter) |
| POST | `/api/evidence` | `{ caseId, itemId, evidenceType, makeModel, locationFound, collectedBy, fileHash }` |
| POST | `/api/evidence/:evidenceId/transfer` | `{ releasedBy, receivedBy, releasedSig, receivedSig, location, purpose, notes }` |
| GET | `/api/evidence/:evidenceId/verify-chain` | — returns `{ intact, message, brokenAtSequence? }` |

---

## Connecting the existing frontend

The frontend's `DB` object in `app.js` currently reads/writes LocalStorage
directly. To wire it to this backend, replace each `DB` method with a
`fetch()` call to the matching endpoint above, and store the JWT (e.g. in
memory or `sessionStorage` — avoid `localStorage` for the token since
anything with XSS access to the page could read it, and this app deals with
sensitive case data). Example swap:

```js
// Before (LocalStorage)
getCases() {
  return JSON.parse(localStorage.getItem('coc_cases')) || [];
}

// After (API)
async getCases() {
  const res = await fetch(`${API_BASE}/cases`, {
    headers: { Authorization: `Bearer ${authToken}` }
  });
  return res.json();
}
```

Every call site that uses `DB.getCases()` etc. will need `await` added since
these become async. Happy to do this swap file-by-file if you want — it
touches most of `app.js`.

---

## Security notes (student project scope, not production-hardened)

- Passwords are hashed with bcrypt (12 rounds) — never stored plaintext.
- JWT expires after 8 hours.
- Basic rate limiting on `/api/auth/*` (20 requests / 15 min) to slow brute-force attempts.
- **Not yet done, worth adding if you keep building this:** per-case access control (right now any logged-in user can see any case), HTTPS enforcement in production, refresh tokens, input sanitization beyond basic required-field checks, audit logging of *who* queried what (not just who wrote what).
