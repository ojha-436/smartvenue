'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { PubSub } = require('@google-cloud/pubsub');
const { v4: uuidv4 } = require('uuid');
const winston = require('winston');

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

const db = getFirestore();
const pubsub = new PubSub({ projectId: process.env.PROJECT_ID });

const app = express();
app.use(helmet());
app.use(cors({ origin: true }));
app.use(express.json());

// ── POST /api/queues/:amenityId/join ──────────────────────────────────────────
// Attendee joins a virtual queue
app.post('/api/queues/:amenityId/join', async (req, res, next) => {
  try {
    const { amenityId } = req.params;
    const { userId, venueId, displayName } = req.body;

    if (!userId || !venueId) {
      return res.status(400).json({ error: 'userId and venueId are required' });
    }

    const queueRef = db
      .collection('venues').doc(venueId)
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
        userId,
        displayName: displayName || 'Guest',
        position: newPosition,
        estimatedWaitMins: estimatedWait,
        status: 'waiting',
        joinedAt: now,
      });

      // Update queue length
      txn.set(queueRef, {
        amenityId,
        venueId,
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
        venueId,
        amenityId,
        timestamp: now,
      })),
    });

    logger.info({ action: 'queue_join', amenityId, userId, entryId });
    res.status(201).json({ success: true, entryId, amenityId });
  } catch (err) { next(err); }
});

// ── DELETE /api/queues/:amenityId/leave ───────────────────────────────────────
app.delete('/api/queues/:amenityId/leave', async (req, res, next) => {
  try {
    const { amenityId } = req.params;
    const { entryId, venueId } = req.body;

    if (!entryId || !venueId) {
      return res.status(400).json({ error: 'entryId and venueId are required' });
    }

    const entryRef = db
      .collection('venues').doc(venueId)
      .collection('queues').doc(amenityId)
      .collection('entries').doc(entryId);

    const entryDoc = await entryRef.get();
    if (!entryDoc.exists) return res.status(404).json({ error: 'Queue entry not found' });

    await entryRef.update({ status: 'cancelled', leftAt: new Date().toISOString() });

    // Decrement queue length
    await db.collection('venues').doc(venueId)
      .collection('queues').doc(amenityId)
      .update({ length: FieldValue.increment(-1), updatedAt: new Date().toISOString() });

    res.json({ success: true, message: 'Left queue successfully' });
  } catch (err) { next(err); }
});

// ── GET /api/queues/:amenityId/position/:entryId ──────────────────────────────
app.get('/api/queues/:amenityId/position/:entryId', async (req, res, next) => {
  try {
    const { amenityId, entryId } = req.params;
    const { venueId } = req.query;

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
app.get('/api/queues/venue/:venueId', async (req, res, next) => {
  try {
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

    res.json({ queues });
  } catch (err) { next(err); }
});

// ── POST /api/queues/:amenityId/serve ─────────────────────────────────────────
// Staff marks next person in queue as served
app.post('/api/queues/:amenityId/serve', async (req, res, next) => {
  try {
    const { amenityId } = req.params;
    const { venueId } = req.body;

    const entriesRef = db
      .collection('venues').doc(venueId)
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
    await db.collection('venues').doc(venueId)
      .collection('queues').doc(amenityId)
      .update({ length: FieldValue.increment(-1), updatedAt: servedAt });

    // Publish staff-tasks to notify next person
    await pubsub.topic('staff-tasks').publishMessage({
      data: Buffer.from(JSON.stringify({
        taskType: 'queue_served',
        userId:   nextEntry.data().userId,
        amenityId,
        venueId,
        servedAt,
      })),
    });

    res.json({ success: true, servedUserId: nextEntry.data().userId });
  } catch (err) { next(err); }
});

app.get('/health', (req, res) => res.json({ status: 'healthy', service: 'queue-service' }));

app.use((err, req, res, next) => {
  logger.error(err.message);
  res.status(500).json({ error: err.message });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => logger.info(`queue-service listening on :${PORT}`));
