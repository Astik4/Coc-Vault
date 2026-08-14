# CoC Vault — Digital Forensics Chain of Custody System

<p align="center">
  <strong>A secure web-based digital evidence management and chain-of-custody platform for forensic investigations.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.11%2B-blue?logo=python" alt="Python">
  <img src="https://img.shields.io/badge/Flask-3.0.3-black?logo=flask" alt="Flask">
  <img src="https://img.shields.io/badge/JavaScript-ES6%2B-yellow?logo=javascript" alt="JavaScript">
  <img src="https://img.shields.io/badge/SQLite-Database-blue?logo=sqlite" alt="SQLite">
  <img src="https://img.shields.io/badge/JWT-Authentication-purple" alt="JWT">
  <img src="https://img.shields.io/badge/SHA--256-Integrity-green" alt="SHA-256">
  <img src="https://img.shields.io/badge/Status-Active-success" alt="Status">
</p>

---

## 📌 Overview

**CoC Vault** is a web-based Digital Forensics and Incident Response (DFIR) application designed to manage digital evidence throughout its chain of custody.

The platform provides investigators with a centralized system for:

* Managing forensic investigation cases
* Registering digital evidence
* Generating SHA-256 evidence fingerprints
* Recording evidence custody transfers
* Capturing electronic signatures
* Maintaining a tamper-evident custody ledger
* Detecting modifications to evidence files
* Verifying the integrity of custody records
* Generating investigation reports in PDF format
* Authenticating investigators using JWT
* Protecting authentication endpoints with rate limiting

The project combines a **JavaScript frontend**, **Flask REST API**, and **SQLite database** into a lightweight forensic evidence-management platform.

> **Project classification:** Cybersecurity / Digital Forensics / DFIR / Web Security

---

## 🎯 Project Objectives

CoC Vault was designed around a simple forensic principle:

> Digital evidence should be traceable, verifiable, and accompanied by an auditable record of every custody transfer.

The system therefore addresses two separate integrity questions:

### 1. Evidence Integrity

Was the actual evidence file modified?

CoC Vault calculates a **SHA-256 hash** when evidence is registered and allows investigators to upload the file again later to compare its current hash against the original value.

### 2. Custody Record Integrity

Was the custody history itself modified?

Every custody entry contains a hash linked to the previous custody entry. The backend can reconstruct the entire chain and identify where the chain becomes invalid.

This means an investigator can distinguish between:

```text
Evidence File Tampering
        ↓
SHA-256 mismatch
```

and:

```text
Custody Ledger Tampering
        ↓
Hash-chain verification failure
```

---

# ✨ Features

## 🔐 Authentication & Security

* Investigator account registration
* Secure password hashing using Werkzeug
* JWT-based authentication
* Token expiration
* Protected API routes
* Generic authentication error messages to reduce username enumeration
* Authentication endpoint rate limiting
* Environment-based JWT secret configuration
* Configurable CORS origins

---

## 📁 Case Management

Investigators can create and manage investigation cases containing:

* Case number
* Lead investigator
* Badge / investigator ID
* Agency
* Suspect / target
* Incident date
* Investigation notes
* Case creation timestamp

Cases can be selected as the active investigation from the frontend.

---

## 🧾 Evidence Vault

Evidence items can be registered against a specific case.

Each evidence record can contain:

* Evidence item ID
* Evidence type
* Make / model
* Location discovered
* Collector
* SHA-256 file hash
* Date logged
* Associated custody history

The system automatically creates an initial acquisition custody entry when evidence is registered.

---

## 🔑 SHA-256 Evidence Fingerprinting

CoC Vault uses the browser's native **Web Crypto API** to calculate SHA-256 hashes.

The browser calculates:

```text
Evidence File
     │
     ▼
Web Crypto API
     │
     ▼
SHA-256
     │
     ▼
Stored Evidence Fingerprint
```

The original hash becomes the reference value for future integrity verification.

---

## 🔄 Chain of Custody

Every custody transfer records information such as:

* Releasing party
* Receiving party
* Timestamp
* Location
* Purpose
* Notes
* Sequence number
* Previous hash
* Current entry hash
* Electronic signatures

A typical custody history therefore resembles:

```text
Genesis
   │
   ▼
Acquisition
   │
   ▼
Transfer #2
   │
   ▼
Transfer #3
   │
   ▼
Transfer #4
```

Each entry is cryptographically connected to the previous entry.

---

## ⛓️ Tamper-Evident Custody Ledger

The custody ledger uses hash chaining.

Conceptually:

```text
Hash #1
  │
  ├── prev_hash = Genesis
  │
  ▼
Hash #2
  │
  ├── prev_hash = Hash #1
  │
  ▼
Hash #3
  │
  ├── prev_hash = Hash #2
  │
  ▼
Hash #4
```

Each custody entry is hashed using its relevant fields and the previous entry's hash.

If an attacker modifies an earlier custody record directly in the database:

```text
Original:

H1 → H2 → H3 → H4

After modification:

H1' → H2 → H3 → H4
       ✕
```

The verification process detects the broken chain and reports the sequence where the inconsistency begins.

---

## ✍️ Electronic Signatures

The Custody Ledger provides signature pads for:

* Releasing party
* Receiving party

Investigators can draw signatures using:

* Mouse
* Trackpad
* Touchscreen

The captured signature is stored as part of the custody transfer record.

> **Important:** These signatures are captured as image data and should not be considered cryptographic digital signatures or legally binding non-repudiation mechanisms.

---

## 🛡️ Integrity Checker

The application provides two independent integrity checks.

### Evidence File Verification

```text
Original File
     │
     ▼
Stored SHA-256
     │
     ├── MATCH ──► Integrity Secure
     │
     └── MISMATCH ► Possible Tampering
```

### Custody Chain Verification

The backend reconstructs the custody chain and recalculates every entry hash.

If a modification is detected, the API reports:

* Integrity status
* Broken sequence number
* Explanation of the detected inconsistency

---

## 📄 Investigation Reports

CoC Vault can generate investigation reports containing information such as:

* Case details
* Evidence metadata
* SHA-256 fingerprint
* Custody history
* Transfer information
* Signature records

Reports can be:

* Printed
* Exported as PDF

PDF generation is handled on the frontend using `html2pdf.js`.

---

## 🧪 Demo / Test Evidence

The project includes synthetic forensic evidence for demonstration and testing.

Example evidence includes:

```text
test_evidence/
├── suspicious_email.eml
├── system_auth_log.txt
└── financial_transaction_export.csv
```

These files simulate scenarios such as:

* Suspicious email activity
* Authentication attacks
* Unauthorized access
* Suspicious financial transactions

The included seeding script can populate the database with a complete demonstration case.

---

# 🏗️ Architecture

CoC Vault follows a simple client-server architecture:

```text
┌──────────────────────────────────────────────┐
│                  Frontend                    │
│                                              │
│ HTML + CSS + JavaScript                     │
│                                              │
│ • Authentication UI                          │
│ • Case Management                             │
│ • Evidence Vault                              │
│ • Custody Ledger                              │
│ • Integrity Checker                           │
│ • PDF Reports                                 │
└───────────────────┬──────────────────────────┘
                    │
                    │ HTTP / REST API
                    │ JWT Bearer Token
                    ▼
┌──────────────────────────────────────────────┐
│                  Backend                     │
│                                              │
│ Flask REST API                                │
│                                              │
│ • Authentication                              │
│ • Case APIs                                   │
│ • Evidence APIs                               │
│ • Custody APIs                                │
│ • Chain Verification                          │
│ • Rate Limiting                               │
└───────────────────┬──────────────────────────┘
                    │
                    │ SQL
                    ▼
┌──────────────────────────────────────────────┐
│                  SQLite                      │
│                                              │
│ Users                                         │
│ Cases                                         │
│ Evidence                                      │
│ Custody Logs                                  │
└──────────────────────────────────────────────┘
```

---

# 🧰 Technology Stack

## Frontend

| Technology      | Purpose                                 |
| --------------- | --------------------------------------- |
| HTML5           | Application structure                   |
| CSS3            | UI and responsive styling               |
| JavaScript      | Application logic                       |
| Web Crypto API  | SHA-256 hashing                         |
| Fetch API       | Backend communication                   |
| Session Storage | Short-lived client authentication state |
| html2pdf.js     | PDF report generation                   |
| Lucide          | UI icons                                |

## Backend

| Technology    | Purpose                      |
| ------------- | ---------------------------- |
| Python        | Backend programming language |
| Flask         | REST API framework           |
| Flask-CORS    | Cross-origin API access      |
| Flask-Limiter | API rate limiting            |
| PyJWT         | JWT authentication           |
| python-dotenv | Environment configuration    |
| Werkzeug      | Password hashing             |
| SQLite        | Persistent database          |

---

# 📂 Project Structure

```text
CoC-Vault/
│
├── Backend/
│   ├── app.py
│   ├── auth_utils.py
│   ├── db.py
│   ├── seed_demo_data.py
│   ├── requirements.txt
│   │
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── cases.py
│   │   └── evidence.py
│   │
│   └── test_evidence/
│       ├── suspicious_email.eml
│       ├── system_auth_log.txt
│       └── financial_transaction_export.csv
│
├── Frontend/
│   ├── index.html
│   ├── app.js
│   ├── api.js
│   ├── style.css
│   └── README.md
│
├── USER_GUIDE.md
└── README.md
```

---

# 🚀 Installation & Setup

## Prerequisites

Make sure the following are installed:

* Python 3.11+
* pip
* Node.js / npm
* Git
* A modern web browser

---

## 1. Clone the Repository

```bash
git clone https://github.com/Astik4/CoC-Vault.git
cd CoC-Vault
```

---

## 2. Setup the Backend

```bash
cd Backend
```

Create a virtual environment:

### Windows

```powershell
python -m venv venv
venv\Scripts\activate
```

### Linux / macOS

```bash
python3 -m venv venv
source venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

---

## 3. Configure Environment Variables

Create your environment file:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Configure at minimum:

```env
JWT_SECRET=replace-with-a-long-random-secret
PORT=4000
CORS_ORIGIN=http://localhost:8080,http://127.0.0.1:8080,http://localhost:5500,http://127.0.0.1:5500
```

### Security Warning

Never commit your real `.env` file or production secrets to GitHub.

Generate a strong random JWT secret for anything beyond local development.

---

# ▶️ Running the Application

## Start the Backend

From `Backend/`:

```bash
python app.py
```

The API runs by default on:

```text
http://localhost:4000
```

Verify the backend:

```text
http://localhost:4000/api/health
```

Expected response:

```json
{
  "status": "ok"
}
```

---

## Start the Frontend

Open another terminal:

```bash
cd Frontend
```

Using `http-server`:

```bash
npx http-server -p 8080
```

Then open:

```text
http://localhost:8080
```

Alternatively, the frontend can be served using VS Code Live Server.

---

# 🧪 Demo Data

To quickly populate the application with realistic synthetic investigation data:

```bash
cd Backend
python seed_demo_data.py
```

The seeder creates a demonstration investigation containing:

* One simulated Business Email Compromise case
* Three synthetic evidence items
* A custody transfer
* Data suitable for testing the Evidence Vault
* Data suitable for testing the Custody Ledger
* Data suitable for testing the Integrity Checker

### Demo Account

```text
Username: demo_investigator
Password: demo-password-2026
```

> This account is intended strictly for local demonstration/testing. Do not use these credentials in a deployed environment.

The seed script is designed to be idempotent and avoids creating duplicate demo cases when executed repeatedly.

---

# 🔌 API Overview

The Flask backend exposes REST-style endpoints.

## Authentication

```text
POST /api/auth/register
POST /api/auth/login
```

Registration creates an investigator account and returns a JWT.

Login validates the credentials and returns a JWT.

---

## Health

```text
GET /api/health
```

Used to verify backend availability.

---

## Cases

```text
GET    /api/cases
POST   /api/cases
GET    /api/cases/<case_id>
DELETE /api/cases/<case_id>
```

Protected by JWT authentication.

---

## Evidence

```text
GET    /api/evidence
POST   /api/evidence
DELETE /api/evidence/<evidence_id>
```

Evidence operations require authentication.

---

## Custody Transfers

```text
POST /api/evidence/<evidence_id>/transfer
```

Creates a new custody entry and links it cryptographically to the previous entry.

---

## Custody Integrity Verification

```text
GET /api/evidence/<evidence_id>/verify-chain
```

Recalculates the entire custody chain and reports whether the ledger remains intact.

---

# 🔐 Security Design

The project intentionally incorporates several security concepts relevant to cybersecurity and digital forensics.

### Password Security

Passwords are never stored as plaintext.

They are processed using Werkzeug's password hashing implementation.

```text
Password
   ↓
Password Hashing
   ↓
Stored Password Hash
```

---

### JWT Authentication

Authenticated API requests use:

```http
Authorization: Bearer <JWT>
```

The backend validates:

* Token presence
* Token signature
* Token algorithm
* Token expiration

---

### Rate Limiting

Authentication routes are protected with:

```text
20 requests / 15 minutes
```

This is intended to reduce brute-force login and registration attempts.

---

### Username Enumeration Protection

Login returns the same error message for:

```text
Unknown username
```

and:

```text
Incorrect password
```

This prevents the API from unnecessarily revealing whether a username exists.

---

### CORS Controls

The backend uses an explicit list of allowed frontend origins rather than allowing arbitrary origins.

Origins can be configured using:

```env
CORS_ORIGIN=
```

---

### Cryptographic Integrity

SHA-256 is used for:

* Evidence fingerprints
* Custody ledger hash chaining

The system does not treat hashing as encryption. Hashes are used as integrity fingerprints.

---

# 🔬 Forensic Workflow

The intended workflow is:

```text
┌──────────────┐
│ Authenticate  │
└──────┬───────┘
       ▼
┌──────────────┐
│ Create Case  │
└──────┬───────┘
       ▼
┌────────────────────┐
│ Register Evidence  │
└─────────┬──────────┘
          ▼
┌────────────────────┐
│ Calculate SHA-256   │
└─────────┬──────────┘
          ▼
┌────────────────────┐
│ Record Acquisition │
└─────────┬──────────┘
          ▼
┌────────────────────┐
│ Transfer Custody   │
└─────────┬──────────┘
          ▼
┌────────────────────┐
│ Hash-Chain Ledger  │
└─────────┬──────────┘
          ▼
┌────────────────────┐
│ Verify Integrity   │
└─────────┬──────────┘
          ▼
┌────────────────────┐
│ Generate Report    │
└────────────────────┘
```

---

# 🧠 Threat Model & Security Considerations

CoC Vault is designed primarily as a **portfolio and educational DFIR application**.

It demonstrates important security concepts but does not attempt to solve every requirement of a production forensic evidence-management platform.

### Current protections

* Password hashing
* JWT authentication
* Token expiration
* Authentication rate limiting
* SHA-256 evidence fingerprinting
* Tamper-evident custody hash chaining
* CORS configuration
* Generic authentication failure responses
* Protected case/evidence/custody endpoints

### Current limitations

#### 1. No Fine-Grained Authorization

Currently, authenticated investigators can interact with cases without a complete per-user/per-role authorization model.

A production system should enforce:

```text
User
  ↓
Role
  ↓
Case Permissions
  ↓
Allowed Actions
```

---

#### 2. Electronic Signatures Are Not Cryptographic Signatures

The application captures drawn signatures as image data.

They do not provide:

* Cryptographic signing
* Certificate-based identity
* Non-repudiation
* Qualified electronic signature functionality

---

#### 3. SQLite Is Intended for the Demo

SQLite is appropriate for a lightweight local application and demonstration environment.

A production deployment would likely use a more robust database such as:

* PostgreSQL
* MySQL / MariaDB

---

#### 4. Flask Development Server

The project currently uses Flask's development server.

A production deployment should use a production WSGI server such as:

* Gunicorn
* Waitress

with an appropriate reverse proxy and HTTPS configuration.

---

#### 5. Hard Delete

Cases and evidence can currently be deleted.

A production forensic system should generally favor:

```text
Archive / Void / Close
```

over permanent deletion in order to preserve the historical audit trail.

---

#### 6. Client-Side Evidence Hashing

The initial SHA-256 calculation is performed inside the browser.

For a higher-assurance forensic workflow, production systems should carefully control the acquisition environment and independently verify evidence hashes server-side or through a trusted acquisition workstation.

---

# 🗺️ Roadmap

Potential future improvements include:

* [ ] Role-based access control (RBAC)
* [ ] Per-case authorization
* [ ] Investigator activity audit logs
* [ ] Immutable/append-only audit storage
* [ ] PostgreSQL support
* [ ] Production WSGI deployment
* [ ] HTTPS enforcement
* [ ] Multi-factor authentication
* [ ] Cryptographic digital signatures
* [ ] Certificate-based identity
* [ ] Evidence file server-side verification
* [ ] Evidence versioning
* [ ] Case archival instead of hard deletion
* [ ] Advanced forensic report templates
* [ ] Automated audit-log monitoring
* [ ] API documentation with OpenAPI/Swagger
* [ ] Automated unit and integration testing
* [ ] CI/CD security checks
* [ ] Docker deployment
* [ ] Security logging and alerting

---

# 🧪 Testing the Integrity Mechanism

A simple demonstration of the tamper-detection functionality:

### Step 1 — Register a File

Upload a file as evidence.

The application calculates:

```text
SHA-256(file)
```

and stores the resulting fingerprint.

### Step 2 — Verify the Original

Upload the same file again.

Expected:

```text
MATCH
Integrity Secure
```

### Step 3 — Modify the File

Change even one character in the file.

### Step 4 — Verify Again

Upload the modified file.

Expected:

```text
MISMATCH
Integrity Broken / Tampered
```

The reason is that cryptographic hashes exhibit an avalanche effect: even a small input modification produces a substantially different digest.

---

# 📊 Database Model

The SQLite database contains four primary entities:

```text
users
  │
  │
  ├──────────────┐
  │              │
  ▼              ▼
cases        authentication
  │
  │ 1:N
  ▼
evidence
  │
  │ 1:N
  ▼
custody_log
```

### Users

Stores investigator account information and password hashes.

### Cases

Stores investigation metadata.

### Evidence

Stores evidence metadata and its original SHA-256 fingerprint.

### Custody Log

Stores chronological custody transfers and the cryptographic hash chain.

---

# 📸 Screenshots

Recommended screenshots for the repository:

### Login

```text
Add screenshot here
```

### Case Management

```text
Add screenshot here
```

### Evidence Vault

```text
Add screenshot here
```

### Custody Ledger

```text
Add screenshot here
```

### Integrity Checker

```text
Add screenshot here
```

### Generated Report

```text
Add screenshot here
```

> For a professional GitHub repository, screenshots are strongly recommended because they let recruiters understand the application without running it first.

---

# 📚 Documentation

Additional documentation is available inside the repository:

* `USER_GUIDE.md` — complete application usage guide
* `Backend/README.md` — backend architecture and API documentation
* `Frontend/README.md` — frontend architecture and testing workflow

---

# 🎓 Learning Outcomes

This project demonstrates practical experience with:

* Digital forensics concepts
* Chain-of-custody management
* Cryptographic hashing
* Hash chaining
* REST API development
* JWT authentication
* Password security
* API rate limiting
* CORS configuration
* SQLite database design
* Frontend/backend integration
* Browser Web Crypto API
* Secure session handling
* Evidence integrity verification
* Security-oriented application architecture

---

# ⚠️ Disclaimer

CoC Vault is an **educational and portfolio project** intended to demonstrate digital-forensics workflows, web security concepts, cryptographic integrity mechanisms, and secure application development.

It should **not be treated as a certified forensic evidence-management system or relied upon as the sole system of record for real criminal, civil, regulatory, or legal investigations** without appropriate security review, forensic validation, legal review, operational controls, and compliance requirements.

---

# 👨‍💻 Author

**Astik Gupta**

B.Tech Computer Science Engineering
Cybersecurity Specialization

Interests:

* Cybersecurity
* Penetration Testing
* Red Teaming
* Digital Forensics
* Incident Response
* Web Application Security

---

# 📄 License

No open-source license has been specified for this repository yet.

If you intend to allow others to freely use, modify, and distribute the project, consider adding an appropriate license such as the **MIT License**.

---

<p align="center">
  <strong>CoC Vault</strong><br>
  Digital Evidence • Cryptographic Integrity • Chain of Custody
</p>
