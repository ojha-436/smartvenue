'use strict';

const express  = require('express');
const helmet   = require('helmet');
const cors     = require('cors');
const rateLimit = require('express-rate-limit');
const Joi      = require('joi');
const jwt      = require('jsonwebtoken');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore }        = require('firebase-admin/firestore');
const { getAuth }             = require('firebase-admin/auth');
const { PubSub }              = require('@google-cloud/pubsub');
const { v4: uuidv4 }          = require('uuid');
const winston  = require('winston');
const redis    = require('../../shared/redis-client');

/** Cache TTL constants (seconds) */
const CACHE_TTL = {
  MENU: 120,   // 2 min — menu items rarely change mid-event
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

const db     = getFirestore();
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
const orderSchema = Joi.object({
  userId: Joi.string().required(),
  venueId: Joi.string().required(),
  standId: Joi.string().required(),
  items: Joi.array().items(Joi.object({
    itemId: Joi.string().required(),
    quantity: Joi.number().min(1).required(),
    price: Joi.number().min(0).required(),
  })).min(1).required(),
  totalAmount: Joi.number().min(0).required(),
  paymentToken: Joi.string().optional(),
});

const statusUpdateSchema = Joi.object({
  status: Joi.string().valid('ready', 'collected', 'cancelled').required(),
  venueId: Joi.string().required(),
  standId: Joi.string().required(),
});

// ── POST /api/orders ──────────────────────────────────────────────────────────
app.post('/api/orders', authenticate, async (req, res, next) => {
  try {
    const { error, value } = orderSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    // Verify total amount matches items
    const itemsTotal = value.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    if (Math.abs(itemsTotal - value.totalAmount) > 0.01) {
      return res.status(400).json({ error: 'Total amount does not match items' });
    }

    const orderId  = uuidv4();
    const now      = new Date().toISOString();

    // Validate items exist in menu
    const menuRef  = db.collection('venues').doc(value.venueId).collection('menu');
    const itemIds  = value.items.map(i => i.itemId);
    const menuDocs = await Promise.all(itemIds.map(id => menuRef.doc(id).get()));

    for (let i = 0; i < menuDocs.length; i++) {
      if (!menuDocs[i].exists) {
        return res.status(400).json({ error: `Item ${itemIds[i]} not found in menu` });
      }
    }

    const order = {
      orderId,
      userId: value.userId,
      venueId: value.venueId,
      standId: value.standId,
      items: value.items,
      totalAmount: value.totalAmount,
      status:    'confirmed',
      paymentStatus: value.paymentToken ? 'paid' : 'pending',
      createdAt: now,
      estimatedReadyMins: 10,
    };

    // Write to Firestore
    await db.collection('orders').doc(orderId).set(order);

    // Write to stand's order queue
    await db.collection('venues').doc(value.venueId)
      .collection('stands').doc(value.standId)
      .collection('orderQueue').doc(orderId)
      .set({ orderId, status: 'confirmed', createdAt: now, items: value.items });

    // Publish order event
    await pubsub.topic('order-events').publishMessage({
      data: Buffer.from(JSON.stringify({ eventType: 'order_placed', orderId, standId: value.standId, venueId: value.venueId, userId: value.userId, timestamp: now })),
    });

    logger.info({ action: 'order_placed', orderId, standId: value.standId, venueId: value.venueId });
    res.status(201).json({ success: true, orderId, estimatedReadyMins: order.estimatedReadyMins });
  } catch (err) { next(err); }
});

// ── GET /api/orders/:orderId ──────────────────────────────────────────────────
app.get('/api/orders/:orderId', authenticate, async (req, res, next) => {
  try {
    const doc = await db.collection('orders').doc(req.params.orderId).get();
    if (!doc.exists) return res.status(404).json({ error: 'Order not found' });
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) { next(err); }
});

// ── GET /api/orders/user/:userId ──────────────────────────────────────────────
app.get('/api/orders/user/:userId', authenticate, async (req, res, next) => {
  try {
    const snapshot = await db.collection('orders')
      .where('userId', '==', req.params.userId)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();
    const orders = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ orders });
  } catch (err) { next(err); }
});

// ── PUT /api/orders/:orderId/status ───────────────────────────────────────────
// Staff marks order as ready or collected
app.put('/api/orders/:orderId/status', authenticate, async (req, res, next) => {
  try {
    const { error, value } = statusUpdateSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const now = new Date().toISOString();
    await db.collection('orders').doc(req.params.orderId).update({
      status: value.status,
      [`${value.status}At`]: now,
    });

    // Publish status update
    await pubsub.topic('order-events').publishMessage({
      data: Buffer.from(JSON.stringify({
        eventType: `order_${value.status}`,
        orderId: req.params.orderId,
        venueId: value.venueId,
        standId: value.standId,
        timestamp: now,
      })),
    });

    res.json({ success: true, status: value.status });
  } catch (err) { next(err); }
});

// ── GET /api/orders/stand/:standId/queue ──────────────────────────────────────
// Kitchen display: pending orders for a stand
app.get('/api/orders/stand/:standId/queue', authenticate, async (req, res, next) => {
  try {
    const { venueId } = req.query;
    if (!venueId) return res.status(400).json({ error: 'venueId query parameter required' });

    const snapshot = await db.collection('venues').doc(venueId)
      .collection('stands').doc(req.params.standId)
      .collection('orderQueue')
      .where('status', '==', 'confirmed')
      .orderBy('createdAt')
      .limit(50)
      .get();
    const queue = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ queue, count: queue.length });
  } catch (err) { next(err); }
});

// ── GET /api/menu/:venueId ────────────────────────────────────────────────────
app.get('/api/menu/:venueId', authenticate, async (req, res, next) => {
  try {
    const { standId } = req.query;
    const cacheKey = `menu:${req.params.venueId}:${standId || 'all'}`;

    // Serve from Redis cache when available
    const cached = await redis.getJSON(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    let query = db.collection('venues').doc(req.params.venueId).collection('menu');
    if (standId) query = query.where('standId', '==', standId);
    const snapshot = await query.where('available', '==', true).orderBy('category').get();
    const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    const result = { items, count: items.length };

    await redis.setJSON(cacheKey, result, CACHE_TTL.MENU);
    res.setHeader('X-Cache', 'MISS');
    res.json(result);
  } catch (err) { next(err); }
});

app.get('/health', (req, res) => res.json({ status: 'healthy', service: 'order-service' }));
app.use((err, req, res, next) => { logger.error({ error: err.message, stack: err.stack }); res.status(500).json({ error: err.message }); });

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => logger.info(`order-service listening on :${PORT}`));
