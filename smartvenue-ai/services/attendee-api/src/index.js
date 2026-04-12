'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const winston = require('winston');

// ── Logger ────────────────────────────────────────────────────────────────────
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

// ── Firebase Init ─────────────────────────────────────────────────────────────
let firebaseKey;
try {
  firebaseKey = JSON.parse(process.env.FIREBASE_KEY || '{}');
} catch {
  firebaseKey = null;
}

if (firebaseKey && firebaseKey.project_id) {
  initializeApp({ credential: cert(firebaseKey) });
} else {
  initializeApp(); // Uses Application Default Credentials in Cloud Run
}

const db = getFirestore();
module.exports.db = db;

// ── Express App ───────────────────────────────────────────────────────────────
const app = express();

app.use(helmet());
app.use(cors({ origin: true }));
app.use(express.json({ limit: '1mb' }));

// Rate limiting: 100 req/min per IP
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
}));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/attendees', require('./routes/attendee'));
app.use('/api/venues',    require('./routes/venue'));

// Health check
app.get('/health', (req, res) => res.json({
  status: 'healthy',
  service: 'attendee-api',
  timestamp: new Date().toISOString(),
}));

// Error handler
app.use((err, req, res, next) => {
  logger.error({ message: err.message, stack: err.stack, path: req.path });
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => logger.info(`attendee-api listening on :${PORT}`));
