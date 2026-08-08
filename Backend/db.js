/* ==========================================================================
   DATABASE LAYER (SQLite via better-sqlite3)
   ==========================================================================
   Replaces the old LocalStorage DB wrapper from the frontend prototype.
   Adds a hash-chained custody log: every entry's hash is derived from its
   own data PLUS the previous entry's hash. This means if anyone edits or
   deletes a row in custody_log directly in the DB, every subsequent hash
   in that evidence item's chain breaks — tampering becomes detectable,
   even by someone with raw DB access.
   ========================================================================== */

const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');

const db = new Database(path.join(__dirname, 'coc_vault.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
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
`);

/** Deterministically hash a custody entry chained to the previous entry's hash. */
function computeEntryHash(prevHash, entry) {
  const payload = JSON.stringify({
    evidenceId: entry.evidenceId,
    sequence: entry.sequence,
    timestamp: entry.timestamp,
    releasedBy: entry.releasedBy || '',
    receivedBy: entry.receivedBy || '',
    location: entry.location || '',
    purpose: entry.purpose || '',
    notes: entry.notes || '',
    prevHash
  });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

const GENESIS_HASH = '0'.repeat(64); // fixed starting point for every evidence item's chain

module.exports = { db, computeEntryHash, GENESIS_HASH };
