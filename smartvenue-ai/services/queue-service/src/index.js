'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');
const jwt = require('jsonwebtoken');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { PubSub } = require('@google-cloud/pubsub');
const { v4: uuidv4 } = require('uuid');
const winston = require('winston');
const redis   = require('../../shared/redis-client');

const CACHE_TTL = {
  QUEUE_LIST: 15,  // 15 sec — queue lengths change frequently during events
};

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

// Validate JWT_SECRET is set at startup
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  logger.error('FATAL: JWT_SECRET environment variable is not set');
  process.exit(1);
}

let firebaseKey;
try { firebaseKey = JSON.parse(process.env.FIREBASE_KEY || '{}'); } catch { firebaseKey = null; }
if (firebaseKey?.project_id) {
  initializeApp({ credential: cert(firebaseKey) });
} else {
  initializeApp();
}

const db = getFirestore();
const pubsub = new PubSub({ projectId: process.env.PROJECT_ID });

const app = express();
app.use(helmet());

// Configure CORS with specific origins
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3001').split(',').map(o => o.trim());
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// Rate limiting: 100 req/min per IP
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
}));

// ── Middleware: Authenticate ──────────────────────────────────────────────────
async function authenticate(req, res, next) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) {
    logger.warn({ action: 'auth_failed', reason: 'missing_auth_header', path: req.path });
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = auth.slice(7);

  // Try Firebase ID token first
  try {
    const decoded = await getAuth().verifyIdToken(token);
    req.user = { uid: decoded.uid, email: decoded.email, role: decoded.role || 'attendee' };
    return next();
  } catch (_) {
    // Fall through to JWT
  }

  // Try local JWT
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (err) {
    logger.warn({ action: 'auth_failed', reason: 'invalid_token', error: err.message, path: req.path });
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ── Joi Schemas ───────────────────────────────────────────────────────────────
const joinQueueSchema = Joi.object({
  userId: Joi.string().required(),
  venueId: Joi.string().required(),
  displayName: Joi.string().min(1).max(100).required(),
});

const leaveQueueSchema = Joi.object({
  entryId: Joi.string().required(),
  venueId: Joi.string().required(),
});

const serveQueueSchema = Joi.object({
  venueId: Joi.string().required(),
});

// ── POST /api/queues/:amenityId/join ──────────────────────────────────────────
// Attendee joins a virtual queue
app.post('/api/queues/:amenityId/join', authenticate, async (req, res, next) => {
  try {
    const { error, value } = joinQueueSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { amenityId } = req.params;

    const queueRef = db
      .collection('venues').doc(value.venueId)
      .collection('queues').doc(amenityId);

    const entryId = uuidv4();
    const now = new Date().toISOString();

    await db.runTransaction(async (txn) => {
      const queueDoc = await txn.get(queueRef);
      const queueData = queueDoc.exists ? queueDoc.data() : { length: 0, avgWaitMins: 5 };

      const newPosition = (queueData.length || 0) + 1;
      const estimatedWait = Math.round(newPosition * (queueData.avgWaitMins || 5));

      // Add entry to queue entries sub-collection
      const entryRef = queueRef.collection('entries').doc(entryId);
      txn.set(entryRef, {
        entryId,
        userId: value.userId,
        displayName: value.displayName,
        position: newPosition,
        estimatedWaitMins: estimatedWait,
        status: 'waiting',
        joinedAt: now,
      });

      // Update queue length
      txn.set(queueRef, {
        amenityId,
        venueId: value.venueId,
        length: newPosition,
        avgWaitMins: queueData.avgWaitMins || 5,
        updatedAt: now,
      }, { merge: true });
    });

    // Publish queue join event for analytics
    await pubsub.topic('app-events').publishMessage({
      data: Buffer.from(JSON.stringify({
        eventId: uuidv4(),
        eventType: 'queue_join',
        venueId: value.venueId,
        amenityId,
        timestamp: now,
      })),
    });

    logger.info({ action: 'queue_join', amenityId, userId: value.userId, entryId });
    res.status(201).json({ success: true, entryId, amenityId });
  } catch (err) { next(err); }
});

// ── DELETE /api/queues/:amenityId/leave ───────────────────────────────────────
app.delete('/api/queues/:amenityId/leave', authenticate, async (req, res, next) => {
  try {
    const { error, value } = leaveQueueSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { amenityId } = req.params;

    const entryRef = db
      .collection('venues').doc(value.venueId)
      .collection('queues').doc(amenityId)
      .collection('entries').doc(value.entryId);

    const entryDoc = await entryRef.get();
    if (!entryDoc.exists) return res.status(404).json({ error: 'Queue entry not found' });

    await entryRef.update({ status: 'cancelled', leftAt: new Date().toISOString() });

    // Decrement queue length
    await db.collection('venues').doc(value.venueId)
      .collection('queues').doc(amenityId)
      .update({ length: FieldValue.increment(-1), updatedAt: new Date().toISOString() });

    res.json({ success: true, message: 'Left queue successfully' });
  } catch (err) { next(err); }
});

// ── GET /api/queues/:amenityId/position/:entryId ──────────────────────────────
app.get('/api/queues/:amenityId/position/:entryId', authenticate, async (req, res, next) => {
  try {
    const { amenityId, entryId } = req.params;
    const { venueId } = req.query;

    if (!venueId) return res.status(400).json({ error: 'venueId query parameter required' });

    const entryRef = db
      .collection('venues').doc(venueId)
      .collection('queues').doc(amenityId)
      .collection('entries').doc(entryId);

    const entryDoc = await entryRef.get();
    if (!entryDoc.exists) return res.status(404).json({ error: 'Queue entry not found' });

    const entry = entryDoc.data();
    res.json({
      position:       entry.position,
      status:         entry.status,
      estimatedWait:  entry.estimatedWaitMins,
      joinedAt:       entry.joinedAt,
    });
  } catch (err) { next(err); }
});

// ── GET /api/queues/venue/:venueId ────────────────────────────────────────────
// All queue depths for a venue (for venue map display)
app.get('/api/queues/venue/:venueId', authenticate, async (req, res, next) => {
  try {
    const cacheKey = `queueList:${req.params.venueId}`;
    const cached = await redis.getJSON(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    const snapshot = await db
      .collection('venues').doc(req.params.venueId)
      .collection('queues')
      .get();

    const queues = snapshot.docs.map(doc => ({
      id: doc.id,
      length: doc.data().length || 0,
      avgWaitMins: doc.data().avgWaitMins || 0,
      updatedAt: doc.data().updatedAt,
    }));

    const result = { queues };
    await redis.setJSON(cacheKey, result, CACHE_TTL.QUEUE_LIST);
    res.setHeader('X-Cache', 'MISS');
    res.json(result);
  } catch (err) { next(err); }
});

// ── POST /api/queues/:amenityId/serve ─────────────────────────────────────────
// Staff marks next person in queue as served
app.post('/api/queues/:amenityId/serve', authenticate, async (req, res, next) => {
  try {
    const { error, value } = serveQueueSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { amenityId } = req.params;

    const entriesRef = db
      .collection('venues').doc(value.venueId)
      .collection('queues').doc(amenityId)
      .collection('entries');

    // Get the next waiting entry
    const snapshot = await entriesRef
      .where('status', '==', 'waiting')
      .orderBy('position')
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.json({ success: true, message: 'Queue is empty' });
    }

    const nextEntry = snapshot.docs[0];
    const servedAt = new Date().toISOString();
    const joinedAt = new Date(nextEntry.data().joinedAt);
    const actualWait = Math.round((new Date() - joinedAt) / 60000);

    await nextEntry.ref.update({ status: 'served', servedAt, actualWaitMins: actualWait });

    // Decrement queue
    await db.collection('venues').doc(value.venueId)
      .collection('queues').doc(amenityId)
      .update({ length: FieldValue.increment(-1), updatedAt: servedAt });

    // Publish staff-tasks to notify next person
    await pubsub.topic('staff-tasks').publishMessage({
      data: Buffer.from(JSON.stringify({
        taskType: 'queue_served',
        userId:   nextEntry.data().userId,
        amenityId,
        venueId: value.venueId,
        servedAt,
      })),
    });

    res.json({ success: true, servedUserId: nextEntry.data().userId });
  } catch (err) { next(err); }
});

app.get('/health', (req, res) => res.json({ status: 'healthy', service: 'queue-service' }));

app.use((err, req, res, next) => {
  logger.error({ error: err.message, stack: err.stack });
  res.status(500).json({ error: err.message });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => logger.info(`queue-service listening on :${PORT}`));
