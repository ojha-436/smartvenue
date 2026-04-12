'use strict';

const express = require('express');
const helmet  = require('helmet');
const cors    = require('cors');
const { initializeApp, cert } = require('firebase-admin/app');
const { getMessaging }        = require('firebase-admin/messaging');
const { getFirestore }        = require('firebase-admin/firestore');
const { v4: uuidv4 }          = require('uuid');
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

const db        = getFirestore();
const messaging = getMessaging();

const app = express();
app.use(helmet());
app.use(cors({ origin: true }));
app.use(express.json());

// ── Helper: Send FCM notification ─────────────────────────────────────────────
async function sendFCM({ token, topic, title, body, data = {} }) {
  const message = {
    notification: { title, body },
    data: { ...data, timestamp: new Date().toISOString() },
  };

  if (token) {
    message.token = token;
  } else if (topic) {
    message.topic = topic;
  } else {
    throw new Error('Either token or topic is required');
  }

  try {
    const msgId = await messaging.send(message);
    logger.info({ action: 'fcm_sent', msgId, title });
    return msgId;
  } catch (err) {
    logger.error({ action: 'fcm_error', error: err.message, title });
    throw err;
  }
}

// ── POST /api/notify/user ─────────────────────────────────────────────────────
// Send targeted notification to a specific user's device
app.post('/api/notify/user', async (req, res, next) => {
  try {
    const { userId, title, body, data, venueId } = req.body;
    if (!userId || !title || !body) {
      return res.status(400).json({ error: 'userId, title and body required' });
    }

    // Get user's FCM token from Firestore
    const userDoc = await db.collection('attendees').doc(userId).get();
    if (!userDoc.exists || !userDoc.data().fcmToken) {
      return res.status(404).json({ error: 'User not found or no FCM token registered' });
    }

    await sendFCM({ token: userDoc.data().fcmToken, title, body, data });

    // Log notification
    await db.collection('notifications').add({
      notificationId: uuidv4(),
      type: 'user',
      userId,
      title,
      body,
      venueId,
      sentAt: new Date().toISOString(),
    });

    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── POST /api/notify/venue ────────────────────────────────────────────────────
// Broadcast to ALL attendees at a venue via FCM topic
app.post('/api/notify/venue', async (req, res, next) => {
  try {
    const { venueId, title, body, data, type } = req.body;
    if (!venueId || !title || !body) {
      return res.status(400).json({ error: 'venueId, title and body required' });
    }

    // FCM topic = venueId (all attendees subscribed to their venue topic at check-in)
    await sendFCM({ topic: `venue-${venueId}`, title, body, data: data || {} });

    await db.collection('notifications').add({
      notificationId: uuidv4(),
      type: type || 'broadcast',
      venueId,
      title,
      body,
      sentAt: new Date().toISOString(),
    });

    logger.info({ action: 'broadcast_sent', venueId, title });
    res.json({ success: true, type: 'broadcast', venueId });
  } catch (err) { next(err); }
});

// ── POST /api/notify/emergency ────────────────────────────────────────────────
// Emergency broadcast — highest priority FCM
app.post('/api/notify/emergency', async (req, res, next) => {
  try {
    const { venueId, message, evacuationZone } = req.body;
    if (!venueId || !message) {
      return res.status(400).json({ error: 'venueId and message required' });
    }

    const title = '🚨 VENUE ALERT';
    const body  = message;
    const data  = { type: 'emergency', evacuationZone: evacuationZone || '', venueId };

    // Send to venue topic (all attendees)
    await messaging.send({
      topic: `venue-${venueId}`,
      notification: { title, body },
      data,
      android: { priority: 'high', notification: { sound: 'default', priority: 'max', channelId: 'emergency' } },
      apns: { headers: { 'apns-priority': '10' }, payload: { aps: { sound: 'default', badge: 1, contentAvailable: true } } },
    });

    // Also alert staff
    await messaging.send({
      topic: `staff-${venueId}`,
      notification: { title: '🚨 EMERGENCY ALERT', body: message },
      data,
      android: { priority: 'high' },
    });

    await db.collection('notifications').add({
      notificationId: uuidv4(),
      type: 'emergency',
      venueId,
      message,
      sentAt: new Date().toISOString(),
    });

    logger.warn({ action: 'emergency_broadcast', venueId, message });
    res.json({ success: true, type: 'emergency' });
  } catch (err) { next(err); }
});

// ── POST /api/notify/queue-ready ──────────────────────────────────────────────
// Notify user their queue position is ready
app.post('/api/notify/queue-ready', async (req, res, next) => {
  try {
    const { userId, amenityName, pickupCode } = req.body;

    const userDoc = await db.collection('attendees').doc(userId).get();
    if (!userDoc.exists || !userDoc.data().fcmToken) {
      return res.json({ success: false, reason: 'No FCM token' });
    }

    await sendFCM({
      token: userDoc.data().fcmToken,
      title: `✅ ${amenityName} is ready!`,
      body:  pickupCode ? `Your pickup code: ${pickupCode}. Head over now!` : 'Please proceed to the counter now.',
      data:  { type: 'queue_ready', amenityName, pickupCode: pickupCode || '' },
    });

    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── POST /internal/crowd-alert ────────────────────────────────────────────────
// Pub/Sub push subscription endpoint from crowd-alerts topic
app.post('/internal/crowd-alert', async (req, res, next) => {
  try {
    const msg = req.body?.message;
    if (!msg) return res.status(400).json({ error: 'No message' });

    const data = JSON.parse(Buffer.from(msg.data, 'base64').toString());
    logger.info({ action: 'crowd_alert_received', data });

    // Auto-notify attendees in affected zone
    if (data.severity === 'red' && data.venueId && data.zoneId) {
      await sendFCM({
        topic: `zone-${data.venueId}-${data.zoneId}`,
        title: '⚠️ Crowded Area Alert',
        body:  `Zone ${data.zoneId} is very busy. Alternative routes suggested.`,
        data:  { type: 'crowd_alert', zoneId: data.zoneId, severity: data.severity },
      });
    }

    res.status(204).send();
  } catch (err) { next(err); }
});

// ── POST /api/notify/register-token ──────────────────────────────────────────
// Register or update user's FCM device token
app.post('/api/notify/register-token', async (req, res, next) => {
  try {
    const { userId, fcmToken, venueId } = req.body;
    if (!userId || !fcmToken) return res.status(400).json({ error: 'userId and fcmToken required' });

    await db.collection('attendees').doc(userId).update({ fcmToken });

    // Subscribe to venue topic
    if (venueId) {
      await messaging.subscribeToTopic([fcmToken], `venue-${venueId}`);
    }

    res.json({ success: true });
  } catch (err) { next(err); }
});

app.get('/health', (req, res) => res.json({ status: 'healthy', service: 'notification-service' }));
app.use((err, req, res, next) => { logger.error(err.message); res.status(500).json({ error: err.message }); });

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => logger.info(`notification-service listening on :${PORT}`));
