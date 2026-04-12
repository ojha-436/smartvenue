'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const Joi = require('joi');
const { PubSub } = require('@google-cloud/pubsub');
const { db } = require('../index');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const pubsub = new PubSub({ projectId: process.env.PROJECT_ID });

// ── Schema Validation ─────────────────────────────────────────────────────────
const profileSchema = Joi.object({
  displayName: Joi.string().min(2).max(100).required(),
  ticketId:    Joi.string().max(64).optional(),
  seatSection: Joi.string().max(20).optional(),
  seatRow:     Joi.string().max(10).optional(),
  seatNumber:  Joi.string().max(10).optional(),
  preferences: Joi.object({
    dietary:       Joi.array().items(Joi.string()).optional(),
    accessibilityNeeds: Joi.boolean().optional(),
    gpsOptIn:      Joi.boolean().optional(),
    notifications: Joi.boolean().optional(),
  }).optional(),
});

const gpsSchema = Joi.object({
  lat:     Joi.number().min(-90).max(90).required(),
  lng:     Joi.number().min(-180).max(180).required(),
  venueId: Joi.string().required(),
  zoneId:  Joi.string().optional(),
});

// ── GET /api/attendees/me ─────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const doc = await db.collection('attendees').doc(req.user.uid).get();
    if (!doc.exists) return res.status(404).json({ error: 'Attendee profile not found' });
    res.json({ uid: doc.id, ...doc.data() });
  } catch (err) { next(err); }
});

// ── POST /api/attendees/profile ───────────────────────────────────────────────
router.post('/profile', authenticate, async (req, res, next) => {
  try {
    const { error, value } = profileSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const profile = {
      ...value,
      uid: req.user.uid,
      email: req.user.email,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    await db.collection('attendees').doc(req.user.uid).set(profile, { merge: true });
    res.status(201).json({ success: true, profile });
  } catch (err) { next(err); }
});

// ── PUT /api/attendees/gps ────────────────────────────────────────────────────
// Receives opt-in GPS ping, strips PII, publishes anonymized zone event
router.put('/gps', authenticate, async (req, res, next) => {
  try {
    const { error, value } = gpsSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    // Check if user has opted in
    const doc = await db.collection('attendees').doc(req.user.uid).get();
    const profile = doc.data() || {};
    if (!profile.preferences?.gpsOptIn) {
      return res.status(403).json({ error: 'GPS opt-in not enabled for this user' });
    }

    // Anonymize: round coords to ~50m precision, no user ID stored
    const anonEvent = {
      eventId:   uuidv4(),
      eventType: 'gps_ping',
      venueId:   value.venueId,
      zoneId:    value.zoneId || null,
      lat:       Math.round(value.lat * 1000) / 1000,
      lng:       Math.round(value.lng * 1000) / 1000,
      timestamp: new Date().toISOString(),
    };

    // Publish to Pub/Sub app-events topic
    const topic = pubsub.topic('app-events');
    await topic.publishMessage({ data: Buffer.from(JSON.stringify(anonEvent)) });

    res.json({ success: true, message: 'Location ping recorded' });
  } catch (err) { next(err); }
});

// ── GET /api/attendees/ticket/:ticketId ───────────────────────────────────────
router.get('/ticket/:ticketId', authenticate, async (req, res, next) => {
  try {
    const snapshot = await db.collection('attendees')
      .where('ticketId', '==', req.params.ticketId)
      .where('uid', '==', req.user.uid)
      .limit(1)
      .get();

    if (snapshot.empty) return res.status(404).json({ error: 'Ticket not found' });

    const doc = snapshot.docs[0];
    res.json({
      ticketId:    doc.data().ticketId,
      seatSection: doc.data().seatSection,
      seatRow:     doc.data().seatRow,
      seatNumber:  doc.data().seatNumber,
      valid:       true,
    });
  } catch (err) { next(err); }
});

// ── POST /api/attendees/checkin ───────────────────────────────────────────────
router.post('/checkin', authenticate, async (req, res, next) => {
  try {
    const { venueId, gateId, ticketId } = req.body;
    if (!venueId || !gateId) {
      return res.status(400).json({ error: 'venueId and gateId are required' });
    }

    // Record check-in event
    const checkinEvent = {
      eventId:   uuidv4(),
      eventType: 'gate_checkin',
      venueId,
      zoneId:    gateId,
      timestamp: new Date().toISOString(),
    };

    await pubsub.topic('app-events').publishMessage({
      data: Buffer.from(JSON.stringify(checkinEvent)),
    });

    // Update attendee record
    await db.collection('attendees').doc(req.user.uid).update({
      checkedIn:   true,
      checkinTime: new Date().toISOString(),
      currentVenue: venueId,
    });

    res.json({ success: true, message: 'Check-in recorded', venueId, gateId });
  } catch (err) { next(err); }
});

// ── DELETE /api/attendees/me ──────────────────────────────────────────────────
// GDPR right to erasure
router.delete('/me', authenticate, async (req, res, next) => {
  try {
    await db.collection('attendees').doc(req.user.uid).delete();
    res.json({ success: true, message: 'Account data deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
