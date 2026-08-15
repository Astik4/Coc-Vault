# CoC Vault — Frontend

> Vanilla SPA frontend for the CoC Vault Digital Forensics Chain of Custody System.

---

## Overview

This is the browser-based Single-Page Application (SPA) for CoC Vault. It communicates with the Flask REST API in `../Backend` over HTTPS/HTTP and stores only a short-lived session token in `sessionStorage`. All cryptographic operations (SHA-256 file hashing) run client-side using the browser's native **Web Crypto API** (`crypto.subtle`) — no third-party crypto libraries.

---

## Running the Frontend

> **Start the backend first.** See `../Backend` for instructions.

Once the Flask API is running on `http://localhost:4000`, serve this directory with any of the following:

| Method | Command | Default URL |
|---|---|---|
| **npx http-server** *(recommended)* | `npx http-server -p 8080` | http://localhost:8080 |
| **VS Code Live Server** | Install extension → click Go Live | http://localhost:5500 |
| **Direct file open** | Open `index.html` in browser | `file://` |

All three origins are pre-approved in `Backend/.env` → `CORS_ORIGIN`. If you serve from a different port, add it to that list and restart the backend.

> **Login not working?** Open DevTools (F12) → Console. A "Failed to fetch" or CORS error means the backend is not running, or your origin isn't in `CORS_ORIGIN`.

---

## Quick Demo (Recommended First Run)

```bash
# Terminal 1 — start the backend
cd ../Backend
python app.py

# Terminal 2 — seed two demo cases with evidence
cd ../Backend
python seed_demo_data.py

# Terminal 3 — serve the frontend
cd ../Frontend
npx http-server -p 8080
```

Then open **http://localhost:8080** and sign in with:

| Field | Value |
|---|---|
| **Username** | `demo_investigator` |
| **Password** | `demo-password-2026` |

The seeder creates **two pre-populated forensic cases**:

| Case Number | Scenario | Evidence Items |
|---|---|---|
| `CASE-DEMO-BEC-2026` | Business Email Compromise | 3 items + 1 custody transfer |
| `CASE-DEMO-INSIDER-2026` | Insider Threat / Data Exfiltration | 2 items + 1 custody transfer |

The seeder is idempotent — re-running it detects existing cases and skips them safely.

---

## Full Testing Protocol

Follow this guide to simulate a real DFIR workflow from scratch.

### Step 0 — Create an Account

On the login screen, click **"Need an account? Register"** and create your investigator account. Or use the seeded `demo_investigator` credentials above.

---

### Step 1 — Prepare a Test Evidence File

To test hashing and the tamper alarm, create a simple text file:

1. Open Notepad (or any editor)
2. Type: `Forensic Image — Server Logs — August 2026`
3. Save to Desktop as **`evidence.txt`**

---

### Step 2 — Create a Case

You can create a case in two ways:
- Click **`+ New Case`** in the **top header bar** (always visible)
- Click **`+ New Case File`** inside the **Case Management** tab (same modal)

Fill in the case form:

| Field | Example Value |
|---|---|
| **Case Number** | `CASE-2026-F812` |
| **Lead Investigator** | `Agent Sarah Jenkins` |
| **Badge ID** | `Badge #9482` |
| **Agency** | `Federal Cyber Defence Directorate` |
| **Suspect/Target** | `Marcus Vance` |
| **Incident Date** | *(auto-filled today)* |
| **Notes** | `Network log tampering and data exfiltration investigation.` |

Click **"Initialize Case File"**. Select this case from the **Active Case** dropdown in the top bar.

---

### Step 3 — Register Evidence & Calculate Hash

1. Navigate to **Evidence Vault** in the sidebar
2. Fill in the **Log New Evidence** form:
   - **Item ID:** `EVD-001`
   - **Type:** `Logical Files/Folder`
   - **Make/Model:** `Desktop evidence.txt`
   - **Location Found:** `Suspect Desktop — Drive C`
   - **Collected By:** `Agent Sarah Jenkins`
3. Click the dashed dropzone **"Calculate Hash from File"** and select your `evidence.txt`
4. The SHA-256 hash is calculated instantly in-browser (no upload occurs)
5. Click **"Secure & Log Item"** — the item appears in the Registered Evidence Vault table

---

### Step 4 — Record a Custody Transfer (Electronic Signatures)

1. Navigate to **Custody Ledger** in the sidebar
2. Select `EVD-001` from the dropdown — you'll see its hash and metadata preview
3. Click **"Record Transfer"**
4. Fill in the transfer modal:
   - **Received By:** `Analyst Bob Miller`
   - **Purpose:** `Forensic Analysis / Imaging`
   - **Location:** `Forensic Lab Room 204`
5. Draw hand-written signatures in both canvas pads (mouse, touch, or trackpad)
6. Click **"Authorize & Log Transfer"**

The ledger timeline renders a new chronological entry with the handoff details and signature image.

---

### Step 5 — Test the Tamper Alarm

1. Navigate to **Integrity Checker** in the sidebar
2. Select case `CASE-2026-F812` → item `EVD-001`
3. Upload `evidence.txt` via the dropzone
   - ✅ **Matched:** Green banner — hash is identical, file is unaltered
4. Now open `evidence.txt` in Notepad, add a space, save it, and upload again
   - 🔴 **Tampered:** Red warning banner — hash mismatch detected

---

### Step 6 — Export a Court-Admissible PDF Report

1. Return to **Custody Ledger**
2. With your evidence item selected, the **Forensic Audit Reports** card appears
3. Click **"Download PDF Report"** to generate an A4 PDF with:
   - Case header and investigator details
   - Evidence metadata table
   - Registered SHA-256 hash
   - Full signed custody timeline

---

### Step 7 — Managing Cases (Add More Cases Anytime)

You can create **unlimited cases** at any time:
- Use **`+ New Case`** in the top bar
- Use **`+ New Case File`** in the Case Management tab

Switch between cases with the **Active Case** dropdown in the top bar. All evidence and custody data is isolated per case.

To clean up test data:
- **Delete Evidence** — removes the item and its custody log
- **Delete Case** — removes the case *and* cascades to all its evidence items and logs

Both actions prompt for confirmation first.

---

## File Structure

| File | Purpose |
|---|---|
| [`index.html`](index.html) | Main UI layout, auth overlay, tab panes, modals, PDF print template |
| [`style.css`](style.css) | Full design system — colors, typography, sidebar, cards, tables, timeline, print CSS |
| [`app.js`](app.js) | Application logic — auth gate, tab navigation, forms, SHA-256 hashing, signature pads, PDF export |
| [`api.js`](api.js) | API client — fetch wrapper, session token management, field-name mapping |

---

## Security Notes

- File hashing uses `crypto.subtle.digest('SHA-256', ...)` — the browser's **native** Web Crypto API, not a JS reimplementation
- Session tokens are stored in `sessionStorage` (cleared when the tab closes, never in localStorage)
- Third-party CDN scripts (`lucide`, `html2pdf.js`) are pinned to exact versions with **SRI integrity hashes** and `crossorigin="anonymous"` attributes

---

## Architecture Notes

- **No data is stored in the browser.** All cases, evidence, and custody entries live in the Flask + SQLite backend
- **The custody hash chain** is server-side. Each entry is chained to its predecessor's HMAC — editing the DB directly breaks the chain and is detected by the `/verify-chain` endpoint
- **Signatures are images.** The canvas captures a drawn stroke as a PNG blob — sufficient for audit trail, but not a cryptographic non-repudiation signature

See the [root README](../README.md) for the full architecture overview, API reference, and security notes.
