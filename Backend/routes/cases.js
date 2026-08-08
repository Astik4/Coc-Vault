const express = require('express');
const crypto = require('crypto');
const { db } = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/cases - list all cases
router.get('/', (req, res) => {
  const cases = db.prepare('SELECT * FROM cases ORDER BY date_created DESC').all();
  res.json(cases);
});

// POST /api/cases - create a new case
router.post('/', (req, res) => {
  const { caseNumber, leadInvestigator, badgeId, agency, suspect, notes } = req.body;

  if (!caseNumber || !leadInvestigator) {
    return res.status(400).json({ error: 'caseNumber and leadInvestigator are required' });
  }

  const existing = db.prepare('SELECT id FROM cases WHERE case_number = ?').get(caseNumber);
  if (existing) {
    return res.status(409).json({ error: 'a case with this case number already exists' });
  }

  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO cases (id, case_number, lead_investigator, badge_id, agency, suspect, notes, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, caseNumber, leadInvestigator, badgeId || null, agency || null, suspect || null, notes || null, req.user.id);

  const created = db.prepare('SELECT * FROM cases WHERE id = ?').get(id);
  res.status(201).json(created);
});

// GET /api/cases/:id - fetch one case
router.get('/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM cases WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'case not found' });
  res.json(item);
});

module.exports = router;
