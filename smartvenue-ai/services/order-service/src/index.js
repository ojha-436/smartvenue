'use strict';

const express  = require('express');
const helmet   = require('helmet');
const cors     = require('cors');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore }        = require('firebase-admin/firestore');
const { PubSub }              = require('@google-cloud/pubsub');
const { v4: uuidv4 }          = require('uuid');
const winston  = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

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
app.use(cors({ origin: true }));
app.use(express.json());

// ── POST /api/orders ──────────────────────────────────────────────────────────
app.post('/api/orders', async (req, res, next) => {
  try {
    const { userId, venueId, standId, items, totalAmount, paymentToken } = req.body;

    if (!userId || !venueId || !standId || !items?.length) {
      return res.status(400).json({ error: 'userId, venueId, standId and items are required' });
    }

    const orderId  = uuidv4();
    const now      = new Date().toISOString();

    // Validate items exist in menu
    const menuRef  = db.collection('venues').doc(venueId).collection('menu');
    const itemIds  = items.map(i => i.itemId);
    const menuDocs = await Promise.all(itemIds.map(id => menuRef.doc(id).get()));

    for (let i = 0; i < menuDocs.length; i++) {
      if (!menuDocs[i].exists) {
        return res.status(400).json({ error: `Item ${itemIds[i]} not found in menu` });
      }
    }

    const order = {
      orderId,
      userId,
      venueId,
      standId,
      items,
      totalAmount: totalAmount || 0,
      status:    'confirmed',
      paymentStatus: paymentToken ? 'paid' : 'pending',
      createdAt: now,
      estimatedReadyMins: 10,
    };

    // Write to Firestore
    await db.collection('orders').doc(orderId).set(order);

    // Write to stand's order queue
    await db.collection('venues').doc(venueId)
      .collection('stands').doc(standId)
      .collection('orderQueue').doc(orderId)
      .set({ orderId, status: 'confirmed', createdAt: now, items });

    // Publish order event
    await pubsub.topic('order-events').publishMessage({
      data: Buffer.from(JSON.stringify({ eventType: 'order_placed', orderId, standId, venueId, userId, timestamp: now })),
    });

    logger.info({ action: 'order_placed', orderId, standId, venueId });
    res.status(201).json({ success: true, orderId, estimatedReadyMins: order.estimatedReadyMins });
  } catch (err) { next(err); }
});

// ── GET /api/orders/:orderId ──────────────────────────────────────────────────
app.get('/api/orders/:orderId', async (req, res, next) => {
  try {
    const doc = await db.collection('orders').doc(req.params.orderId).get();
    if (!doc.exists) return res.status(404).json({ error: 'Order not found' });
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) { next(err); }
});

// ── GET /api/orders/user/:userId ──────────────────────────────────────────────
app.get('/api/orders/user/:userId', async (req, res, next) => {
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
app.put('/api/orders/:orderId/status', async (req, res, next) => {
  try {
    const { status, venueId, standId } = req.body;
    const allowed = ['ready', 'collected', 'cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
    }

    const now = new Date().toISOString();
    await db.collection('orders').doc(req.params.orderId).update({
      status,
      [`${status}At`]: now,
    });

    // Publish status update
    await pubsub.topic('order-events').publishMessage({
      data: Buffer.from(JSON.stringify({
        eventType: `order_${status}`,
        orderId: req.params.orderId,
        venueId,
        standId,
        timestamp: now,
      })),
    });

    res.json({ success: true, status });
  } catch (err) { next(err); }
});

// ── GET /api/orders/stand/:standId/queue ──────────────────────────────────────
// Kitchen display: pending orders for a stand
app.get('/api/orders/stand/:standId/queue', async (req, res, next) => {
  try {
    const { venueId } = req.query;
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
app.get('/api/menu/:venueId', async (req, res, next) => {
  try {
    const { standId } = req.query;
    let query = db.collection('venues').doc(req.params.venueId).collection('menu');
    if (standId) query = query.where('standId', '==', standId);
    const snapshot = await query.where('available', '==', true).orderBy('category').get();
    const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ items, count: items.length });
  } catch (err) { next(err); }
});

app.get('/health', (req, res) => res.json({ status: 'healthy', service: 'order-service' }));
app.use((err, req, res, next) => { logger.error(err.message); res.status(500).json({ error: err.message }); });

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => logger.info(`order-service listening on :${PORT}`));
