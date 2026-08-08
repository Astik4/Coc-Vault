require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const caseRoutes = require('./routes/cases');
const evidenceRoutes = require('./routes/evidence');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:8080' }));
app.use(express.json({ limit: '10mb' })); // evidence metadata + signature PNGs can be sizeable

// Basic rate limiting on auth endpoints to slow down brute-force attempts
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too many attempts, please try again later' }
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/evidence', evidenceRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Fallback error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'internal server error' });
});

app.listen(PORT, () => {
  console.log(`CoC Vault API running on http://localhost:${PORT}`);
});
