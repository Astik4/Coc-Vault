const express = require('express');
const crypto = require('crypto');
const { db, computeEntryHash, GENESIS_HASH } = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();
router.use(requireAuth);

function attachCustodyHistory(item) {
  const custodyHistory = db
    .prepare('SELECT * FROM custody_log WHERE evidence_id = ? ORDER BY sequence ASC')
    .all(item.id);
  return { ...item, custodyHistory };
}

// GET /api/evidence - list all evidence (optionally filtered by caseId)
router.get('/', (req, res) => {
  const { caseId } = req.query;
  const rows = caseId
    ? db.prepare('SELECT * FROM evidence WHERE case_id = ?').all(caseId)
    : db.prepare('SELECT * FROM evidence').all();
  res.json(rows.map(attachCustodyHistory));
});

// POST /api/evidence - log new evidence + create the genesis custody entry
router.post('/', (req, res) => {
  const { caseId, itemId, evidenceType, makeModel, locationFound, collectedBy, fileHash } = req.body;

  if (!caseId || !itemId || !fileHash || !collectedBy) {
    return res.status(400).json({ error: 'caseId, itemId, collectedBy, and fileHash are required' });
  }

  const caseRow = db.prepare('SELECT id FROM cases WHERE id = ?').get(caseId);
  if (!caseRow) return res.status(404).json({ error: 'case not found' });

  const evidenceId = crypto.randomUUID();

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO evidence (id, case_id, item_id, evidence_type, make_model, location_found, collected_by, file_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(evidenceId, caseId, itemId, evidenceType || null, makeModel || null, locationFound || null, collectedBy, fileHash);

    // Genesis custody entry — the acquisition record, chained from GENESIS_HASH
    const entry = {
      evidenceId,
      sequence: 1,
      timestamp: new Date().toISOString(),
      releasedBy: collectedBy,
      receivedBy: collectedBy,
      location: locationFound || '',
      purpose: 'Initial acquisition and sealing of evidence package',
      notes: 'Logged directly in CoC Vault at scene of recovery.'
    };
    const entryHash = computeEntryHash(GENESIS_HASH, entry);

    db.prepare(`
      INSERT INTO custody_log
        (evidence_id, sequence, timestamp, released_by, received_by, released_sig, received_sig, location, purpose, notes, prev_hash, entry_hash)
      VALUES (?, ?, ?, ?, ?, 'ACQUISITION', 'ACQUISITION', ?, ?, ?, ?, ?)
    `).run(evidenceId, 1, entry.timestamp, entry.releasedBy, entry.receivedBy, entry.location, entry.purpose, entry.notes, GENESIS_HASH, entryHash);
  });
  tx();

  const created = db.prepare('SELECT * FROM evidence WHERE id = ?').get(evidenceId);
  res.status(201).json(attachCustodyHistory(created));
});

// POST /api/evidence/:evidenceId/transfer - append a chained custody transfer
router.post('/:evidenceId/transfer', (req, res) => {
  const { evidenceId } = req.params;
  const { releasedBy, receivedBy, releasedSig, receivedSig, location, purpose, notes } = req.body;

  const evidenceRow = db.prepare('SELECT * FROM evidence WHERE id = ?').get(evidenceId);
  if (!evidenceRow) return res.status(404).json({ error: 'evidence item not found' });

  if (!releasedBy || !receivedBy) {
    return res.status(400).json({ error: 'releasedBy and receivedBy are required' });
  }

  const lastEntry = db
    .prepare('SELECT * FROM custody_log WHERE evidence_id = ? ORDER BY sequence DESC LIMIT 1')
    .get(evidenceId);

  const nextSequence = (lastEntry?.sequence || 0) + 1;
  const prevHash = lastEntry?.entry_hash || GENESIS_HASH;

  const entry = {
    evidenceId,
    sequence: nextSequence,
    timestamp: new Date().toISOString(),
    releasedBy,
    receivedBy,
    location: location || '',
    purpose: purpose || '',
    notes: notes || ''
  };
  const entryHash = computeEntryHash(prevHash, entry);

  db.prepare(`
    INSERT INTO custody_log
      (evidence_id, sequence, timestamp, released_by, received_by, released_sig, received_sig, location, purpose, notes, prev_hash, entry_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(evidenceId, nextSequence, entry.timestamp, releasedBy, receivedBy, releasedSig || null, receivedSig || null, entry.location, entry.purpose, entry.notes, prevHash, entryHash);

  const updated = db.prepare('SELECT * FROM evidence WHERE id = ?').get(evidenceId);
  res.status(201).json(attachCustodyHistory(updated));
});

// GET /api/evidence/:evidenceId/verify-chain - re-walk the custody log and confirm no entry was altered
router.get('/:evidenceId/verify-chain', (req, res) => {
  const { evidenceId } = req.params;
  const entries = db
    .prepare('SELECT * FROM custody_log WHERE evidence_id = ? ORDER BY sequence ASC')
    .all(evidenceId);

  if (entries.length === 0) {
    return res.status(404).json({ error: 'no custody entries found for this evidence item' });
  }

  let expectedPrevHash = GENESIS_HASH;
  for (const row of entries) {
    const recomputed = computeEntryHash(expectedPrevHash, {
      evidenceId: row.evidence_id,
      sequence: row.sequence,
      timestamp: row.timestamp,
      releasedBy: row.released_by,
      receivedBy: row.received_by,
      location: row.location,
      purpose: row.purpose,
      notes: row.notes
    });

    if (row.prev_hash !== expectedPrevHash || row.entry_hash !== recomputed) {
      return res.json({
        intact: false,
        brokenAtSequence: row.sequence,
        message: `Chain integrity broken at custody entry #${row.sequence}. This entry does not match its expected hash — the log may have been altered.`
      });
    }
    expectedPrevHash = row.entry_hash;
  }

  res.json({ intact: true, message: 'Custody chain verified — no tampering detected across all entries.' });
});

module.exports = router;
