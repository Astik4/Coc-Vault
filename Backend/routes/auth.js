const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { signToken } = require('../auth');

const router = express.Router();

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { username, password, displayName } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'password must be at least 8 characters' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(409).json({ error: 'username already taken' });
  }

  const passwordHash = bcrypt.hashSync(password, 12);
  const info = db
    .prepare('INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?)')
    .run(username, passwordHash, displayName || username);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  const token = signToken(user);
  res.status(201).json({ token, user: { id: user.id, username: user.username, displayName: user.display_name, role: user.role } });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    // Same error for both cases so we don't leak which usernames exist
    return res.status(401).json({ error: 'invalid username or password' });
  }

  const token = signToken(user);
  res.json({ token, user: { id: user.id, username: user.username, displayName: user.display_name, role: user.role } });
});

module.exports = router;
