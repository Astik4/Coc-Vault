# CoC Vault - Digital Forensics Chain of Custody System

A professional, web-based **Digital Forensics Incident Response (DFIR) Evidence Vault & Chain of Custody Manager**. CoC Vault lets investigators register user accounts, log evidence, calculate cryptographic file fingerprints, record chronological custody transfers with on-screen electronic signatures, check for evidence tampering, and export court-admissible audit reports — all backed by a real Flask API with JWT authentication and a hash-chained custody ledger (see `../Backend/README.md`).

---

## 🚀 How to Run the Application

This is a front-end SPA that talks to the Flask backend in `../Backend`. **Start the backend first** (`python app.py` from the `Backend` folder), then run the frontend with any of these:

1.  **Dev server (recommended):**
    ```bash
    npx http-server -p 8080
    ```
    Then open **[http://localhost:8080](http://localhost:8080)**.
2.  **VS Code "Live Server" extension** — works out of the box (default port 5500).
3.  **Double-click `index.html`** — also works directly via `file://`.

All three are pre-approved in the backend's CORS settings (`Backend/.env` → `CORS_ORIGIN`), so login/register will work from any of them. If you serve the frontend from a different port/origin, add it to that comma-separated list and restart the backend.

> **Login page not responding / stuck / no error shown?** Open the browser DevTools console (F12). If you see a CORS or "Failed to fetch" error, the backend isn't running, or your frontend's origin isn't in `Backend/.env`'s `CORS_ORIGIN`. Add it, restart `python app.py`, and reload.

### Fastest way to see it fully populated

The project ships with a seeded demo case so you don't have to build one by hand to see the app in action:

```bash
cd ../Backend
python app.py                 # in one terminal
python seed_demo_data.py      # in another, once the server is up
```

Then sign in with:
- **Username:** `demo_investigator`
- **Password:** `demo-password-2026`

This loads one case (`CASE-DEMO-BEC-2026`, a simulated Business Email Compromise investigation) with exactly 3 evidence items and one recorded custody transfer, so the Evidence Vault, Custody Ledger, and Integrity Checker tabs all have real data to demo immediately. The seed script is idempotent — running it again detects the existing demo case and skips it instead of creating a duplicate.

---

## 🧪 Quick Start & Testing Protocol

Prefer to build it yourself from a blank account? Follow this step-by-step protocol to simulate a real digital forensics investigation workflow:

### Step 0: Sign In
Register a new investigator account from the login screen (or use the seeded `demo_investigator` account above).

### Step 1: Create a Test File (Your Evidence)
To test the cryptographic hashing and integrity check, you need a sample file:
1.  Open **Notepad** (or any text editor) on your computer.
2.  Type a sample sentence (e.g., `Forensic Image copy of Server logs - August 2026`).
3.  Save the file to your Desktop as **`evidence.txt`**.

---

### Step 2: Initialize a Case Profile
1.  Click the blue **`+ New Case`** button in the top-right corner.
2.  Complete the case metadata:
    *   **Case Number:** `CASE-2026-F812` (or choose your own)
    *   **Lead Investigator:** `Agent Sarah Jenkins`
    *   **Badge ID:** `Badge #9482`
    *   **Agency:** `Federal Cyber Defence Directorate`
    *   **Suspect:** `Marcus Vance`
    *   **Notes:** `Investigation into network logs tampering and data exfiltration.`
3.  Click **"Initialize Case File"**.
4.  Ensure this case is selected in the **Active Case** dropdown at the top of the screen.

---

### Step 3: Register Your Evidence & Calculate Hash
1.  Navigate to the **Evidence Vault** tab in the left sidebar.
2.  Under **Log New Evidence** (the left form), fill in:
    *   **Evidence Item ID:** `EVD-001`
    *   **Evidence Type:** `Logical Files/Folder`
    *   **Make/Model & Serial:** `Desktop evidence.txt`
    *   **Location Found:** `Suspect C: drive Desktop`
    *   **Collected By:** `Agent Sarah Jenkins`
3.  Click the dashed box that says **"Calculate Hash from File"**.
4.  Select the **`evidence.txt`** file you created in Step 1.
5.  The app will instantly calculate the file's **SHA-256 hash** (e.g., `e3b0c442...`). This acts as the unchangeable digital seal for the evidence.
6.  Click **"Secure & Log Item"**. It will appear in the vault grid on the right.

---

### Step 4: Record a Custody Transfer (E-Signatures)
1.  Navigate to the **Custody Ledger** tab in the sidebar.
2.  Select `EVD-001` from the dropdown. You will see its metadata and hash preview.
3.  Click **"Record Transfer"** on the ledger card.
4.  In the transfer form:
    *   "Released By" is pre-filled with the current custodian.
    *   **Received By:** `Analyst Bob Miller`
    *   **Purpose:** `Forensic Analysis / Imaging`
    *   **Location:** `Forensic Lab Room 204`
5.  **Authorize with Signatures:** Use your mouse, trackpad, or touch screen to draw hand-written signatures inside the two canvas boxes for the Releasing and Receiving officers.
6.  Click **"Authorize & Log Transfer"**.
7.  The timeline will instantly draw a new chronological transfer node, displaying the handoff details and signature image trails.

---

### Step 5: Test the Tamper Alarm (Integrity Checker)
1.  Navigate to the **Integrity Checker** tab.
2.  Select case `CASE-2026-F812` and item `EVD-001`. The system displays the registered hash.
3.  Under "Upload File for Verification", click or drag-and-drop your **`evidence.txt`** file.
    *   **Result:** The system calculates the hash and displays a green banner: **"Integrity Secure (MATCHED)"**.
4.  Now, open **`evidence.txt`** on your Desktop in Notepad, add a single character (like a space or full stop), save it, and upload it again.
    *   **Result:** The system recalculates the hash, detects a mismatch, and triggers a red warning banner: **"Integrity Broken (TAMPERED)"**.

---

### Step 6: Export Court-Admissible Reports
1.  Return to the **Custody Ledger** tab.
2.  With your evidence selected, click **"Download PDF Report"** (or **"Print Report"** to print).
3.  The system compiles the case details, evidence table, SHA-256 target hash, and the complete signed custody timeline into a clean, double-bordered legal A4 PDF document.

---

### Step 7: Removing a Case or Evidence Item

Made a mistake, or want to reset your demo data? Both **Case Management** and **Evidence Vault** have a trash-can button in the Actions column of each row:

- **Delete Evidence** removes that item and its entire custody log.
- **Delete Case** removes the case *and cascades* — all evidence items and custody logs under that case are deleted along with it.

Both actions ask for confirmation first (and the case delete tells you how many evidence items will go with it) since neither can be undone.

---

## 📁 File Structure

*   [`index.html`](index.html): The main web interface, login/register screen, layouts, modal structures, and PDF template.
*   [`style.css`](style.css): Design system (colors, type, spacing), sidebar/card/table/badge/modal styling, timeline elements, and print overrides.
*   [`app.js`](app.js): Application logic — auth gate, tab navigation, form handling, WebCrypto SHA-256 hashing, canvas signature pads, custody timeline rendering, and PDF export.
*   [`api.js`](api.js): The API client — wraps every backend call (`fetch` to `../Backend`), manages the session token in `sessionStorage`, and maps backend field names to the shapes the UI expects.
*   [`README.md`](README.md): This documentation guide.

---

## 🔐 Architecture Notes

CoC Vault is a two-part project: this static frontend, and the Flask + SQLite API in `../Backend`. Every case, evidence item, and custody entry lives server-side — the frontend only keeps a short-lived session token in `sessionStorage`.

**What's real and verifiable:**
- **File integrity verification.** Hashes are computed with the browser's native `crypto.subtle.digest('SHA-256', ...)` (Web Crypto API), not a JS reimplementation, so the hash values themselves are trustworthy.
- **Authentication.** Every account is password-hashed server-side (Werkzeug's scrypt-based `generate_password_hash`) and every API call (besides login/register) requires a valid JWT.
- **Tamper-evident custody log.** Each custody entry's hash is chained to the previous entry's hash (`GET /api/evidence/<id>/verify-chain` re-walks and recomputes every hash). If a row is edited directly in the database — bypassing the API — the chain breaks from that point forward and the app reports exactly where.
- **The custody workflow is domain-accurate.** Each transfer records releasedBy/receivedBy/purpose/location/timestamp with a sequence number, matching how physical CoC forms are structured in real investigations.

**What this project doesn't claim to be production-grade at:**
- **Signatures are images, not signatures.** The canvas captures a drawn signature as an image blob. It proves someone drew something on that screen, not that a specific authenticated person authorized the transfer — it has no non-repudiation value.
- **No per-case access control.** Any logged-in investigator can currently see and act on any case; there's no per-user or per-role permission boundary yet.
- **Hard delete, not archival.** Deleting a case or evidence item (see Step 7 above) permanently removes it. A production CoC system would more likely support closing/voiding a case instead, to preserve the audit trail — hard delete is kept here because it's the more useful behaviour for correcting demo/test data during development and grading.
- **Dev server only.** The backend runs on Flask's built-in development server, not a production WSGI server (gunicorn/waitress) — see `Backend/README.md` for what a real deployment would add.

These are exactly the kind of trade-offs worth being able to explain in an interview or project review — they show you know where the current trust boundary sits, not just that the demo works.
