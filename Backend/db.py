"""
==============================================================================
DATABASE LAYER (SQLite, stdlib sqlite3)
==============================================================================
Same design as the earlier Node/Express version, ported to Python.

Every custody log entry stores:
  - prev_hash  -> the entry_hash of the previous entry for that evidence
                  item (or a fixed genesis value for the very first entry)
  - entry_hash -> SHA256(prev_hash + the entry's own fields)

verify_chain() in routes/evidence.py re-walks the chain and recomputes
every hash from scratch. If any custody_log row was edited directly in the
database (bypassing the API), every hash after that point stops matching,
so tampering becomes detectable even without an API audit trail.
==============================================================================
"""

import sqlite3
import hashlib
import json
import os
from flask import g

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'coc_vault.db')
GENESIS_HASH = '0' * 64  # fixed starting point for every evidence item's chain


def get_db():
    """Returns a SQLite connection for the current request, reusing it if
    one was already opened (Flask's `g` object is per-request)."""
    if 'db' not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row  # lets us access columns by name, like a dict
        g.db.execute('PRAGMA foreign_keys = ON')
    return g.db


def close_db(e=None):
    db = g.pop('db', None)
    if db is not None:
        db.close()


def init_db():
    """Creates all tables if they don't exist yet. Safe to call on every
    startup — CREATE TABLE IF NOT EXISTS is a no-op once tables exist."""
    conn = sqlite3.connect(DB_PATH)
    conn.executescript('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            display_name TEXT,
            role TEXT NOT NULL DEFAULT 'investigator',
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS cases (
            id TEXT PRIMARY KEY,
            case_number TEXT UNIQUE NOT NULL,
            lead_investigator TEXT NOT NULL,
            badge_id TEXT,
            agency TEXT,
            suspect TEXT,
            incident_date TEXT,
            notes TEXT,
            created_by INTEGER REFERENCES users(id),
            date_created TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS evidence (
            id TEXT PRIMARY KEY,
            case_id TEXT NOT NULL REFERENCES cases(id),
            item_id TEXT NOT NULL,
            evidence_type TEXT,
            make_model TEXT,
            location_found TEXT,
            collected_by TEXT,
            file_hash TEXT NOT NULL,
            date_logged TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(case_id, item_id)
        );

        CREATE TABLE IF NOT EXISTS custody_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            evidence_id TEXT NOT NULL REFERENCES evidence(id),
            sequence INTEGER NOT NULL,
            timestamp TEXT NOT NULL DEFAULT (datetime('now')),
            released_by TEXT,
            received_by TEXT,
            released_sig TEXT,
            received_sig TEXT,
            location TEXT,
            purpose TEXT,
            notes TEXT,
            prev_hash TEXT NOT NULL,
            entry_hash TEXT NOT NULL,
            UNIQUE(evidence_id, sequence)
        );
    ''')
    conn.commit()
    conn.close()


def compute_entry_hash(prev_hash, entry):
    """Deterministically hash a custody entry, chained to the previous
    entry's hash. `entry` is a dict with the same keys every time so the
    JSON serialization is stable."""
    payload = json.dumps({
        'evidenceId': entry['evidenceId'],
        'sequence': entry['sequence'],
        'timestamp': entry['timestamp'],
        'releasedBy': entry.get('releasedBy') or '',
        'receivedBy': entry.get('receivedBy') or '',
        'location': entry.get('location') or '',
        'purpose': entry.get('purpose') or '',
        'notes': entry.get('notes') or '',
        'prevHash': prev_hash
    }, sort_keys=False)
    return hashlib.sha256(payload.encode('utf-8')).hexdigest()
