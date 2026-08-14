# CoC Vault — User Guide

This guide walks through setting up and using CoC Vault end to end: running
both servers, creating an account, logging a case, registering evidence,
transferring custody, and verifying integrity.

---

## 1. What CoC Vault does

CoC Vault is a digital forensics chain-of-custody tracker. For each case,
you log evidence items (files, logs, exports — anything with a computable
hash), record every time custody of an item changes hands, and can verify
at any point that neither the evidence file nor the custody log itself has
been tampered with.

The evidence-handling workflow follows the general principles common to
established digital forensics guidance — organizations like **NIST** and
**SWGDE** publish best-practice documents on this, and the shared core
ideas are:

- Evidence should be hashed at the point of collection, and that hash
  checked again at every later point it's examined.
- Every transfer of custody should be logged with who released it, who
  received it, when, where, and why.
- The custody record itself should be tamper-evident — not just the
  evidence file.

CoC Vault implements all three: file hashing via the browser's Web Crypto
API, a full custody ledger per evidence item, and a hash-chained log (see
`Backend/README.md` for exactly how that works) so edits to the log itself
are detectable.

This is a portfolio/demo project, not a certified forensic tool — see the
**Architecture Notes** section of the frontend README for what would still
be needed before it could be used in an actual investigation.

---

## 2. Running the app

You need two things running at once, in two separate terminals.

**Terminal 1 — Backend:**
```bash
cd Backend
python -m venv venv          # first time only
source venv/bin/activate     # Windows: venv\Scripts\activate
pip install -r requirements.txt   # first time only
cp .env.example .env         # first time only — then edit JWT_SECRET
python app.py
```
Leave this running. Confirm it's up: visit `http://localhost:4000/api/health`
in a browser — you should see `{"status":"ok"}`.

**Terminal 2 — Frontend:**
```bash
cd Frontend
npx http-server -p 8080
```

Then open your browser to **`http://localhost:8080`**.

You can also open the frontend other ways — double-clicking `index.html`
directly, or using VS Code's "Live Server" extension (port 5500) — without
any extra setup. The backend's CORS settings (`Backend/.env` →
`CORS_ORIGIN`) already allow all of these by default. If you serve the
frontend from somewhere else entirely (a different port, a VM/network IP,
a deployed URL), add that origin to the comma-separated `CORS_ORIGIN` list
in `Backend/.env` and restart `python app.py`, or the backend will silently
reject the requests due to CORS and login/register will appear to do
nothing.

---

## 3. First-time login

You'll land on a login screen, not the dashboard — CoC Vault requires an
account. Click **"Need an account? Register"**, fill in a username and
password (8+ characters), and submit. This creates your account and logs
you in immediately — there's no separate admin approval step in this
version.

---

## 4. Loading test/demo data (optional but recommended)

Rather than manually creating a case and typing in evidence by hand every
time you want to test something, use the included seeder script — it
creates a realistic demo case using the real API (so it also confirms your
backend is working correctly).

```bash
cd Backend
python seed_demo_data.py
```

This creates:
- **One demo case**: a simulated Business Email Compromise investigation
  (`CASE-DEMO-BEC-2026`)
- **Three evidence items** in `Backend/test_evidence/`, each a realistic
  synthetic file you can actually open and inspect:
  - `suspicious_email.eml` — a spoofed executive wire-transfer request
  - `system_auth_log.txt` — SSH auth logs showing brute-force + unauthorized access
  - `financial_transaction_export.csv` — flagged outgoing transactions
- **One custody transfer** already recorded, so the ledger and chain
  verification have something to show immediately

It prints a username/password at the end:
- **Username:** `demo_investigator`
- **Password:** `demo-password-2026`

Log in with those in the frontend, then select the demo case from the
dropdown at the top.

The script is **idempotent** — it uses a fixed case number
(`CASE-DEMO-BEC-2026`), so re-running it detects that the demo case already
exists and skips seeding instead of creating a duplicate. This intentionally
replaces the earlier version of the script, which appended a timestamp to
the case number and created a brand new demo case on every run — that's
what caused repeated/duplicate demo cases to pile up in Case Management. If
you want a completely fresh re-seed, delete the demo case first from the
Case Management tab (see Section 9 below) — its cascading delete also
removes the 3 evidence items and custody logs with it — then run the script
again.

---

## 5. Creating a case manually

Click **"New Case"** in the sidebar. Fields:

| Field | What goes here |
|---|---|
| Case Number | A unique identifier, e.g. `CASE-2026-0142` |
| Lead Investigator | Your name |
| Badge / ID | Optional |
| Agency | Optional |
| Suspect/Target | Optional — defaults to "UNKNOWN/UNSPECIFIED" |
| Incident Date | Date the incident occurred (not today's date, unless they're the same) |
| Notes | Scope/description of the case |

The new case becomes your active case automatically.

---

## 6. Logging evidence

Go to the **Evidence Vault** tab (requires an active case selected at the
top). Drag a file into the drop zone, or click it to browse — CoC Vault
computes its SHA-256 hash client-side using the browser's Web Crypto API.
Fill in item ID, type, location found, and who collected it, then submit.

The hash you see here is what gets stored — this is the value future
integrity checks compare against.

---

## 7. Transferring custody

Go to **Custody Ledger**, pick an evidence item from the dropdown. Click
**"New Transfer"**. Both the releasing and receiving party need to draw a
signature (mouse or touch) before you can submit — the form won't let you
submit with an empty signature pad.

Each transfer appends a new entry to that item's timeline, visible
immediately below.

---

## 8. Checking integrity

Go to **Integrity Checker**. There are two independent checks here:

**File hash check** — re-upload the same file (or a copy of it). CoC Vault
recomputes its hash and compares it to what's stored. A mismatch means the
file itself was altered since it was logged.

**Custody chain check** — click **"Verify Custody Chain Integrity"**. This
doesn't touch the file at all — it re-walks every custody log entry on the
backend and recomputes each entry's hash from scratch. If anyone edited a
custody record directly in the database (bypassing the app entirely), this
catches it and tells you exactly which entry broke.

These two checks answer different questions: "was the evidence file
changed?" vs. "was the custody record about that evidence changed?" — a
real forensic tool needs both, which is why they're separate here.

---

## 9. Exporting a report

From **Custody Ledger**, with an evidence item selected, use **Print
Report** (browser print dialog) or **Export PDF** (generates a downloadable
PDF via `html2pdf.js`) in the export card. The report includes case
details, evidence metadata, the file hash, and the full custody timeline
with signatures.

---

## 10. Deleting a case or evidence item

Both **Case Management** and **Evidence Vault** have a trash-can icon in
the Actions column of every row.

- **Deleting an evidence item** removes it and its entire custody log —
  every transfer recorded against it is gone too.
- **Deleting a case** cascades: it removes the case itself, every evidence
  item logged under it, and all of those items' custody logs, in one
  action.

Both are confirmed with a dialog first — the case-delete confirmation also
tells you how many evidence items will be removed along with it — since
neither action can be undone. This is meant for correcting data-entry
mistakes or resetting test/demo data, not for erasing evidentiary history
in a real investigation; see the Architecture Notes in the frontend README
for the reasoning.

---

## 11. Troubleshooting

| Symptom | Likely cause |
|---|---|
| "Can't reach the backend" or "Failed to fetch" on login/register | The backend isn't running, or your frontend's origin isn't in `Backend/.env`'s `CORS_ORIGIN`. Start `python app.py`, and if you're serving the frontend from something other than `localhost:8080`, `127.0.0.1:8080`, `localhost:5500`, `127.0.0.1:5500`, or `file://`, add that origin to `CORS_ORIGIN` and restart the backend. |
| Blank dashboard after login | No case selected yet, or no cases exist — create one or run the seeder. |
| "Cannot GET /" in browser | Normal — there's no route for `/` itself, only `/api/...`. Use `/api/health` to test the backend directly. |
| Backend errors on startup | Check `.env` exists in `Backend/` (copied from `.env.example`) and you're running `python app.py` from inside `Backend/`, not the project root. |
| Ran the seed script twice and expected two demo cases | Expected — the seeder is idempotent by design (see Section 4) and skips re-seeding if the demo case already exists. |
