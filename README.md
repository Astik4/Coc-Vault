# CoC Vault - Digital Forensics Chain of Custody System

A professional, web-based **Digital Forensics Incident Response (DFIR) Evidence Vault & Chain of Custody Manager**. Built with a clean, clinical forensic light theme, CoC Vault allows investigators to log evidence, calculate cryptographic file fingerprints, record chronological custody transfers with on-screen electronic signatures, check for evidence tampering, and export court-admissible audit reports.

---

## 🚀 How to Run the Application

The application is a pure front-end Single Page Application (SPA). To run it:

1.  **Launch the Dev Server:**
    *   Open your terminal in this directory and run:
        ```bash
        npx http-server -p 8080
        ```
    *   Open your web browser and navigate to: **[http://localhost:8080](http://localhost:8080)**.
2.  **Run Directly (Alternative):**
    *   Simply double-click the [`index.html`](index.html) file to open it in any modern browser (Chrome, Edge, Firefox, Safari). *Note: running through a local server is recommended to avoid browser CORS warnings during file hashing operations.*

---

## 🧪 Quick Start & Testing Protocol

Follow this step-by-step testing protocol to simulate a real digital forensics investigation workflow:

### Step 1: Create a Test File (Your Evidence)
To test the cryptographic hashing and integrity check, you need a sample file:
1.  Open **Notepad** (or any text editor) on your computer.
2.  Type a sample sentence (e.g., `Forensic Image copy of Server logs - August 2026`).
3.  Save the file to your Desktop as **`evidence.txt`**.

---

### Step 2: Initialize a Case Profile
1.  Open CoC Vault in your browser.
2.  Click the blue **`+ New Case`** button in the top-right corner.
3.  Complete the case metadata:
    *   **Case Number:** `CASE-2026-F812` (or choose your own)
    *   **Lead Investigator:** `Agent Sarah Jenkins`
    *   **Badge ID:** `Badge #9482`
    *   **Agency:** `Federal Cyber Defence Directorate`
    *   **Suspect:** `Marcus Vance`
    *   **Notes:** `Investigation into network logs tampering and data exfiltration.`
4.  Click **"Initialize Case File"**. 
5.  Ensure this case is selected in the **Active Case** dropdown at the top of the screen.

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

## 📁 File Structure

*   [`index.html`](index.html): The main web interface, layouts, modal structures, and PDF template.
*   [`style.css`](style.css): Custom variables, grids, interactive canvas styling, timeline elements, and print overrides.
*   [`app.js`](app.js): Application logic, LocalStorage data persistence, WebCrypto SHA-256 hashing, canvas signature handlers, and PDF export engines.
*   [`README.md`](README.md): This documentation guide.

---

## ⚠️ Known Limitations & Threat Model

CoC Vault is built as a front-end prototype to demonstrate the *workflow* of digital chain of custody — evidence logging, hashing, custody transfers, and reporting. Before treating it as a production forensic tool, it's important to be clear about what it actually protects against and what it doesn't.

### What it does well
- **File integrity verification is real.** Hashes are computed with the browser's native `crypto.subtle.digest('SHA-256', ...)` (Web Crypto API), not a JS library reimplementation, so the hash values themselves are trustworthy.
- **The custody workflow is domain-accurate.** Each transfer records releasedBy/receivedBy/purpose/location/timestamp with a sequence number, matching how physical CoC forms are structured in real investigations.

### What it doesn't protect against
- **No server, no tamper-proof storage.** All case and evidence data lives in the browser's LocalStorage. Anyone with DevTools access can open Application → LocalStorage and directly edit `coc_cases` or `coc_evidence`, including rewriting custody history or changing a logged hash after the fact. There is currently no cryptographic seal on the log itself — only on the evidence *file*.
- **Signatures are images, not signatures.** The canvas captures a drawn signature as an image blob. It proves someone drew something on that screen, not that a specific authenticated person authorized the transfer. It has no non-repudiation value.
- **Single-user, single-browser.** There's no auth, no multi-investigator access control, and no audit trail of *who* used the app — anyone opening `index.html` has full read/write access to every case.
- **No log-level tamper evidence.** The integrity checker verifies a re-uploaded file against its stored hash, but nothing currently detects if the custody log entries themselves were edited or deleted from LocalStorage.

### If this were taken further
A production version would need: a backend with an append-only or hash-chained ledger (each custody entry's hash includes the previous entry's hash, Merkle-style), real user authentication tied to signatures, and server-side storage so the "evidence" can't be edited from the client that's viewing it. That's a natural v2 direction and worth mentioning if this comes up in an interview or project review — it shows you know where the trust boundary currently sits, not just that the demo works.
