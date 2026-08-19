"""
==============================================================================
DEMO DATA SEEDER — CoC Vault
==============================================================================
Seeds CoC Vault with TWO realistic demo cases:

  CASE-DEMO-BEC-2026   (Business Email Compromise) — 3 evidence items
  CASE-DEMO-INSIDER-2026  (Insider Threat / Data Exfiltration) — 2 evidence items

Usage:
    1. Start the backend:  python app.py
    2. In another terminal, from this same folder, run:
           python seed_demo_data.py

Idempotent — checks for existing case numbers before creating anything.
Delete a case from the Case Management tab (or via the API) if you want to
re-seed it; the seeder will then recreate it cleanly.
==============================================================================
"""

import requests
import hashlib
import os

API_BASE = "https://coc-vault-backend.onrender.com/api"
TEST_EVIDENCE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_evidence")

DEMO_USERNAME = "demo_investigator"
DEMO_PASSWORD = "demo-password-2026"


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
        print(f"[+] Created demo account '{DEMO_USERNAME}'")
        return reg.json()["token"]

    login = requests.post(f"{API_BASE}/auth/login", json={
        "username": DEMO_USERNAME,
        "password": DEMO_PASSWORD
    })
    login.raise_for_status()
    print(f"[+] Logged in as existing demo account '{DEMO_USERNAME}'")
    return login.json()["token"]


def seed_case(headers, case_payload, evidence_items, transfer=None):
    """
    Creates a case + its evidence items. Skips gracefully if already seeded.
    Returns the case dict (from API), or None if skipped.
    """
    case_number = case_payload["caseNumber"]

    existing_cases = requests.get(f"{API_BASE}/cases", headers=headers)
    existing_cases.raise_for_status()
    already_seeded = next(
        (c for c in existing_cases.json() if c["case_number"] == case_number), None
    )
    if already_seeded:
        print(f"[~] Case '{case_number}' already exists — skipping.")
        return None

    case_resp = requests.post(f"{API_BASE}/cases", headers=headers, json=case_payload)
    case_resp.raise_for_status()
    case = case_resp.json()
    print(f"[+] Created case: {case['case_number']} (id={case['id']})")

    created_ids = []
    for item in evidence_items:
        file_path = os.path.join(TEST_EVIDENCE_DIR, item["file"])
        file_hash = sha256_of_file(file_path)

        ev_resp = requests.post(f"{API_BASE}/evidence", headers=headers, json={
            "caseId":        case["id"],
            "itemId":        item["itemId"],
            "evidenceType":  item["evidenceType"],
            "makeModel":     item["makeModel"],
            "locationFound": item["locationFound"],
            "collectedBy":   item["collectedBy"],
            "fileHash":      file_hash
        })
        ev_resp.raise_for_status()
        ev = ev_resp.json()
        created_ids.append(ev["id"])
        print(f"    [e] Logged {item['itemId']} ({item['file']})  hash={file_hash[:16]}...")

    if transfer and created_ids:
        first_id = created_ids[transfer.get("evidenceIndex", 0)]
        tr_resp = requests.post(
            f"{API_BASE}/evidence/{first_id}/transfer",
            headers=headers,
            json=transfer["data"]
        )
        tr_resp.raise_for_status()
        print(f"    [t] Recorded custody transfer on {evidence_items[transfer.get('evidenceIndex', 0)]['itemId']}")

        vr = requests.get(f"{API_BASE}/evidence/{first_id}/verify-chain", headers=headers)
        vr.raise_for_status()
        print(f"    [v] Chain verification: {vr.json()['message']}")

    return case


def main():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}

    print()
    print("=" * 70)
    print("Seeding CASE 1: Business Email Compromise (BEC)")
    print("=" * 70)

    seed_case(
        headers,
        case_payload={
            "caseNumber":       "CASE-DEMO-BEC-2026",
            "leadInvestigator": "Agent Priya Nair",
            "badgeId":          "Badge #4471",
            "agency":           "Cyber Crime Investigation Cell",
            "suspect":          "David Chen (CEO, TargetCorp) — BEC suspect",
            "incidentDate":     "2026-07-27",
            "notes": (
                "Suspected Business Email Compromise (BEC) and unauthorized data "
                "exfiltration. Fraudulent wire transfer request sent from spoofed "
                "executive email account; server logs show unauthorized SSH access "
                "and file transfer to an external IP within the same time window."
            )
        },
        evidence_items=[
            {
                "file":          "suspicious_email.eml",
                "itemId":        "EVD-BEC-001",
                "evidenceType":  "Digital File / Email",
                "makeModel":     "Exported from Exchange Online mailbox",
                "locationFound": "cfo@targetcorp-internal.example mailbox",
                "collectedBy":   "Agent Priya Nair"
            },
            {
                "file":          "system_auth_log.txt",
                "itemId":        "EVD-BEC-002",
                "evidenceType":  "Log File",
                "makeModel":     "Ubuntu 22.04 production server — /var/log/auth.log",
                "locationFound": "prod-db-01.targetcorp.internal",
                "collectedBy":   "Agent Priya Nair"
            },
            {
                "file":          "financial_transaction_export.csv",
                "itemId":        "EVD-BEC-003",
                "evidenceType":  "Financial Record Export",
                "makeModel":     "Banking portal CSV export",
                "locationFound": "TargetCorp treasury management system",
                "collectedBy":   "Agent Priya Nair"
            }
        ],
        transfer={
            "evidenceIndex": 0,
            "data": {
                "releasedBy": "Agent Priya Nair",
                "receivedBy": "Forensic Analyst Rohan Mehta",
                "location":   "Digital Forensics Lab, Room 3B",
                "purpose":    "Forensic Analysis",
                "notes":      "Transferred for detailed email header and metadata analysis."
            }
        }
    )

    print()
    print("=" * 70)
    print("Seeding CASE 2: Insider Threat / Data Exfiltration")
    print("=" * 70)

    seed_case(
        headers,
        case_payload={
            "caseNumber":       "CASE-DEMO-INSIDER-2026",
            "leadInvestigator": "Agent Kavya Sharma",
            "badgeId":          "Badge #3302",
            "agency":           "Corporate Security & Investigations",
            "suspect":          "Jane Doe (Data Analyst, Analytics Dept) — departing employee",
            "incidentDate":     "2026-07-28",
            "notes": (
                "Suspected deliberate data exfiltration by a departing employee. "
                "Endpoint DLP triggered at 23:04 local time on USB write events "
                "totalling 4.1 GB to an unregistered NAS device. Browser history "
                "confirms job search and external cloud upload activity immediately "
                "preceding the exfiltration window."
            )
        },
        evidence_items=[
            {
                "file":          "usb_activity_log.csv",
                "itemId":        "EVD-INSIDER-001",
                "evidenceType":  "Log File",
                "makeModel":     "SanDisk Ultra USB 3.0 64GB — S/N: SDCZ48-064G-G46",
                "locationFound": "Suspect laptop USB port — HP EliteBook 840, S/N: 5CG1193PBK",
                "collectedBy":   "Agent Kavya Sharma"
            },
            {
                "file":          "browser_history_export.txt",
                "itemId":        "EVD-INSIDER-002",
                "evidenceType":  "Logical Files/Folder",
                "makeModel":     "Chrome v126 Browser History — FTK Imager 4.7.1 export",
                "locationFound": "HP EliteBook 840 — Chrome Default Profile",
                "collectedBy":   "Agent Kavya Sharma"
            }
        ],
        transfer={
            "evidenceIndex": 0,
            "data": {
                "releasedBy": "Agent Kavya Sharma",
                "receivedBy": "Senior Forensic Analyst Arjun Bose",
                "location":   "Forensic Acquisition Suite, Floor 2",
                "purpose":    "Write-Blocked Disk Image Acquisition",
                "notes":      "USB drive handed over for full forensic imaging under write-blocker."
            }
        }
    )

    print()
    print("=" * 70)
    print("Demo data seeded successfully.")
    print()
    print("Log in to the frontend as:")
    print(f"  Username : {DEMO_USERNAME}")
    print(f"  Password : {DEMO_PASSWORD}")
    print()
    print("You will find two pre-populated cases ready to explore:")
    print("  - CASE-DEMO-BEC-2026      (3 evidence items + custody transfer)")
    print("  - CASE-DEMO-INSIDER-2026  (2 evidence items + custody transfer)")
    print("=" * 70)


if __name__ == "__main__":
    main()
