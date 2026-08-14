"""
==============================================================================
DEMO DATA SEEDER
==============================================================================
Populates CoC Vault with one realistic demo case + exactly 3 evidence items
(matching the 3 files in test_evidence/) + a custody transfer, using the
actual running API (not direct DB writes) — so this doubles as a smoke test
that your backend is working end to end.

Usage:
    1. Start the backend:  python app.py
    2. In another terminal, from this same folder, run:
           python seed_demo_data.py

Idempotent — the case number is fixed (CASE-DEMO-BEC-2026), so re-running
this script detects the existing demo case and evidence instead of creating
duplicates. Delete the case from the Case Management tab first (this also
removes its evidence via the API's cascading delete) if you want a clean
re-seed.
==============================================================================
"""

import requests
import hashlib
import os

API_BASE = "http://localhost:4000/api"
TEST_EVIDENCE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_evidence")

DEMO_USERNAME = "demo_investigator"
DEMO_PASSWORD = "demo-password-2026"
DEMO_CASE_NUMBER = "CASE-DEMO-BEC-2026"


def sha256_of_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def get_token():
    """Registers the demo user if needed, otherwise logs in."""
    reg = requests.post(f"{API_BASE}/auth/register", json={
        "username": DEMO_USERNAME,
        "password": DEMO_PASSWORD,
        "displayName": "Demo Investigator"
    })
    if reg.status_code == 201:
        print(f"Created demo account '{DEMO_USERNAME}'")
        return reg.json()["token"]

    # Already exists — log in instead
    login = requests.post(f"{API_BASE}/auth/login", json={
        "username": DEMO_USERNAME,
        "password": DEMO_PASSWORD
    })
    login.raise_for_status()
    print(f"Logged in as existing demo account '{DEMO_USERNAME}'")
    return login.json()["token"]


def main():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}

    # Idempotency check — if the demo case already exists, don't create a
    # second copy of it (this is what previously caused duplicate demo
    # cases to pile up in Case Management every time the script was run).
    existing_cases = requests.get(f"{API_BASE}/cases", headers=headers)
    existing_cases.raise_for_status()
    already_seeded = next((c for c in existing_cases.json() if c["case_number"] == DEMO_CASE_NUMBER), None)

    if already_seeded:
        print(f"Demo case '{DEMO_CASE_NUMBER}' already exists (id={already_seeded['id']}) — skipping seed.")
        print(f"Delete it from the Case Management tab first if you want a fresh re-seed.")
        print()
        print("=" * 70)
        print("Log in to the frontend as:")
        print(f"  Username: {DEMO_USERNAME}")
        print(f"  Password: {DEMO_PASSWORD}")
        print(f"Then select case {DEMO_CASE_NUMBER} from the dropdown.")
        print("=" * 70)
        return

    case_resp = requests.post(f"{API_BASE}/cases", headers=headers, json={
        "caseNumber": DEMO_CASE_NUMBER,
        "leadInvestigator": "Agent Priya Nair",
        "badgeId": "Badge #4471",
        "agency": "Cyber Crime Investigation Cell",
        "suspect": "David Chen (CEO, TargetCorp) - Business Email Compromise suspect",
        "incidentDate": "2026-07-27",
        "notes": (
            "Suspected Business Email Compromise (BEC) and unauthorized data "
            "exfiltration. Fraudulent wire transfer request sent from spoofed "
            "executive email account; server logs show unauthorized SSH access "
            "and file transfer to an external IP within the same time window."
        )
    })
    case_resp.raise_for_status()
    case = case_resp.json()
    print(f"Created case: {case['case_number']} (id={case['id']})")

    # Exactly 3 evidence items, matching the 3 files in test_evidence/
    evidence_items = [
        {
            "file": "suspicious_email.eml",
            "itemId": "EVD-DEMO-001",
            "evidenceType": "Digital File / Email",
            "makeModel": "Exported from Exchange Online mailbox",
            "locationFound": "cfo@targetcorp-internal.example mailbox",
            "collectedBy": "Agent Priya Nair"
        },
        {
            "file": "system_auth_log.txt",
            "itemId": "EVD-DEMO-002",
            "evidenceType": "Log File",
            "makeModel": "Ubuntu 22.04 production server, /var/log/auth.log",
            "locationFound": "prod-db-01.targetcorp.internal",
            "collectedBy": "Agent Priya Nair"
        },
        {
            "file": "financial_transaction_export.csv",
            "itemId": "EVD-DEMO-003",
            "evidenceType": "Financial Record Export",
            "makeModel": "Banking portal CSV export",
            "locationFound": "TargetCorp treasury management system",
            "collectedBy": "Agent Priya Nair"
        }
    ]

    created_evidence_ids = []
    for item in evidence_items:
        file_path = os.path.join(TEST_EVIDENCE_DIR, item["file"])
        file_hash = sha256_of_file(file_path)

        ev_resp = requests.post(f"{API_BASE}/evidence", headers=headers, json={
            "caseId": case["id"],
            "itemId": item["itemId"],
            "evidenceType": item["evidenceType"],
            "makeModel": item["makeModel"],
            "locationFound": item["locationFound"],
            "collectedBy": item["collectedBy"],
            "fileHash": file_hash
        })
        ev_resp.raise_for_status()
        ev = ev_resp.json()
        created_evidence_ids.append(ev["id"])
        print(f"  Logged evidence {item['itemId']} ({item['file']}) hash={file_hash[:16]}...")

    # Record one custody transfer on the first evidence item, to demonstrate
    # the ledger and hash chain having more than one entry
    first_evidence_id = created_evidence_ids[0]
    transfer_resp = requests.post(
        f"{API_BASE}/evidence/{first_evidence_id}/transfer",
        headers=headers,
        json={
            "releasedBy": "Agent Priya Nair",
            "receivedBy": "Forensic Analyst Rohan Mehta",
            "location": "Digital Forensics Lab, Room 3B",
            "purpose": "Forensic Analysis",
            "notes": "Transferred for detailed email header and metadata analysis."
        }
    )
    transfer_resp.raise_for_status()
    print(f"  Recorded custody transfer on {evidence_items[0]['itemId']}")

    verify_resp = requests.get(f"{API_BASE}/evidence/{first_evidence_id}/verify-chain", headers=headers)
    verify_resp.raise_for_status()
    print(f"  Chain verification: {verify_resp.json()['message']}")

    print()
    print("=" * 70)
    print(f"Demo data ready. Log in to the frontend as:")
    print(f"  Username: {DEMO_USERNAME}")
    print(f"  Password: {DEMO_PASSWORD}")
    print(f"Then select case {case['case_number']} from the dropdown.")
    print("=" * 70)


if __name__ == "__main__":
    main()
