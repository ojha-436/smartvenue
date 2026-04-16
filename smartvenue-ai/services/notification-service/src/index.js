'use strict';

const express = require('express');
const helmet  = require('helmet');
const cors    = require('cors');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');
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

// ── Joi Schemas ───────────────────────────────────────────────────────────────
const notifyUserSchema = Joi.object({
  userId: Joi.string().required(),
  title: Joi.string().min(1).max(200).required(),
  body: Joi.string().min(1).max(1000).required(),
  data: Joi.object().optional(),
  venueId: Joi.string().optional(),
});

const notifyVenueSchema = Joi.object({
  venueId: Joi.string().required(),
  title: Joi.string().min(1).max(200).required(),
  body: Joi.string().min(1).max(1000).required(),
  data: Joi.object().optional(),
  type: Joi.string().optional(),
});

const emergencySchema = Joi.object({
  venueId: Joi.string().required(),
  message: Joi.string().min(1).max(1000).required(),
  evacuationZone: Joi.string().optional(),
});

const queueReadySchema = Joi.object({
  userId: Joi.string().required(),
  amenityName: Joi.string().min(1).max(100).required(),
  pickupCode: Joi.string().optional(),
});

const registerTokenSchema = Joi.object({
  userId: Joi.string().required(),
  fcmToken: Joi.string().required(),
  venueId: Joi.string().optional(),
});

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
    const { error, value } = notifyUserSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    // Get user's FCM token from Firestore
    const userDoc = await db.collection('attendees').doc(value.userId).get();
    if (!userDoc.exists || !userDoc.data().fcmToken) {
      return res.status(404).json({ error: 'User not found or no FCM token registered' });
    }

    await sendFCM({ token: userDoc.data().fcmToken, title: value.title, body: value.body, data: value.data });

    // Log notification
    await db.collection('notifications').add({
      notificationId: uuidv4(),
      type: 'user',
      userId: value.userId,
      title: value.title,
      body: value.body,
      venueId: value.venueId || null,
      sentAt: new Date().toISOString(),
    });

    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── POST /api/notify/venue ────────────────────────────────────────────────────
// Broadcast to ALL attendees at a venue via FCM topic
app.post('/api/notify/venue', async (req, res, next) => {
  try {
    const { error, value } = notifyVenueSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    // FCM topic = venueId (all attendees subscribed to their venue topic at check-in)
    await sendFCM({ topic: `venue-${value.venueId}`, title: value.title, body: value.body, data: value.data || {} });

    await db.collection('notifications').add({
      notificationId: uuidv4(),
      type: value.type || 'broadcast',
      venueId: value.venueId,
      title: value.title,
      body: value.body,
      sentAt: new Date().toISOString(),
    });

    logger.info({ action: 'broadcast_sent', venueId: value.venueId, title: value.title });
    res.json({ success: true, type: 'broadcast', venueId: value.venueId });
  } catch (err) { next(err); }
});

// ── POST /api/notify/emergency ────────────────────────────────────────────────
// Emergency broadcast — highest priority FCM
app.post('/api/notify/emergency', async (req, res, next) => {
  try {
    const { error, value } = emergencySchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const title = 'VENUE ALERT';
    const body  = value.message;
    const data  = { type: 'emergency', evacuationZone: value.evacuationZone || '', venueId: value.venueId };

    // Send to venue topic (all attendees)
    await messaging.send({
      topic: `venue-${value.venueId}`,
      notification: { title, body },
      data,
      android: { priority: 'high', notification: { sound: 'default', priority: 'max', channelId: 'emergency' } },
      apns: { headers: { 'apns-priority': '10' }, payload: { aps: { sound: 'default', badge: 1, contentAvailable: true } } },
    });

    // Also alert staff
    await messaging.send({
      topic: `staff-${value.venueId}`,
      notification: { title: 'EMERGENCY ALERT', body: value.message },
      data,
      android: { priority: 'high' },
    });

    await db.collection('notifications').add({
      notificationId: uuidv4(),
      type: 'emergency',
      venueId: value.venueId,
      message: value.message,
      sentAt: new Date().toISOString(),
    });

    logger.warn({ action: 'emergency_broadcast', venueId: value.venueId, message: value.message });
    res.json({ success: true, type: 'emergency' });
  } catch (err) { next(err); }
});

// ── POST /api/notify/queue-ready ──────────────────────────────────────────────
// Notify user their queue position is ready
app.post('/api/notify/queue-ready', async (req, res, next) => {
  try {
    const { error, value } = queueReadySchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const userDoc = await db.collection('attendees').doc(value.userId).get();
    if (!userDoc.exists || !userDoc.data().fcmToken) {
      return res.json({ success: false, reason: 'No FCM token' });
    }

    await sendFCM({
      token: userDoc.data().fcmToken,
      title: `${value.amenityName} is ready!`,
      body:  value.pickupCode ? `Your pickup code: ${value.pickupCode}. Head over now!` : 'Please proceed to the counter now.',
      data:  { type: 'queue_ready', amenityName: value.amenityName, pickupCode: value.pickupCode || '' },
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
        title: 'Crowded Area Alert',
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
    const { error, value } = registerTokenSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    await db.collection('attendees').doc(value.userId).update({ fcmToken: value.fcmToken });

    // Subscribe to venue topic
    if (value.venueId) {
      await messaging.subscribeToTopic([value.fcmToken], `venue-${value.venueId}`);
    }

    res.json({ success: true });
  } catch (err) { next(err); }
});

app.get('/health', (req, res) => res.json({ status: 'healthy', service: 'notification-service' }));
app.use((err, req, res, next) => { logger.error({ error: err.message, stack: err.stack }); res.status(500).json({ error: err.message }); });

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => logger.info(`notification-service listening on :${PORT}`));
