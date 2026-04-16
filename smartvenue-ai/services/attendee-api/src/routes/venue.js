'use strict';

const express = require('express');
const Joi = require('joi');
const { db } = require('../index');
const { authenticate } = require('../middleware/auth');
const redis = require('../../../shared/redis-client');

const router = express.Router();

/** Cache TTL constants (seconds) */
const TTL = {
  VENUE:     300,   // 5 min — venue metadata is mostly static
  AMENITIES: 600,   // 10 min — amenity list rarely changes mid-event
  ZONES:     30,    // 30 sec — zone density updates frequently
};

// ── Schema Validation ─────────────────────────────────────────────────────────
const venueIdSchema = Joi.object({
  venueId: Joi.string().required(),
});

const amenityQuerySchema = Joi.object({
  type: Joi.string().valid('food', 'restroom', 'merchandise').optional(),
});

// ── GET /api/venues/:venueId ──────────────────────────────────────────────────
router.get('/:venueId', authenticate, async (req, res, next) => {
  try {
    const { error, value } = venueIdSchema.validate({ venueId: req.params.venueId });
    if (error) return res.status(400).json({ error: error.details[0].message });

    const cacheKey = `venue:${value.venueId}`;
    const cached = await redis.getJSON(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    const venueDoc = await db.collection('venues').doc(value.venueId).get();
    if (!venueDoc.exists) return res.status(404).json({ error: 'Venue not found' });

    const result = { id: venueDoc.id, ...venueDoc.data() };
    await redis.setJSON(cacheKey, result, TTL.VENUE);
    res.setHeader('X-Cache', 'MISS');
    res.json(result);
  } catch (err) { next(err); }
});

// ── GET /api/venues/:venueId/zones ────────────────────────────────────────────
router.get('/:venueId/zones', authenticate, async (req, res, next) => {
  try {
    const { error, value } = venueIdSchema.validate({ venueId: req.params.venueId });
    if (error) return res.status(400).json({ error: error.details[0].message });

    const cacheKey = `zones:${value.venueId}`;
    const cached = await redis.getJSON(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    const snapshot = await db
      .collection('venues').doc(value.venueId)
      .collection('zones')
      .orderBy('name')
      .get();

    const zones = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const result = { zones, count: zones.length };
    await redis.setJSON(cacheKey, result, TTL.ZONES);
    res.setHeader('X-Cache', 'MISS');
    res.json(result);
  } catch (err) { next(err); }
});

// ── GET /api/venues/:venueId/zones/:zoneId ────────────────────────────────────
// Returns real-time zone density + wait times from Firestore (no caching — real-time)
router.get('/:venueId/zones/:zoneId', authenticate, async (req, res, next) => {
  try {
    const { venueId, zoneId } = req.params;
    const zoneDoc = await db
      .collection('venues').doc(venueId)
      .collection('zones').doc(zoneId)
      .get();

    if (!zoneDoc.exists) return res.status(404).json({ error: 'Zone not found' });
    res.json({ id: zoneDoc.id, ...zoneDoc.data() });
  } catch (err) { next(err); }
});

// ── GET /api/venues/:venueId/amenities ────────────────────────────────────────
router.get('/:venueId/amenities', authenticate, async (req, res, next) => {
  try {
    const { error: venueError } = venueIdSchema.validate({ venueId: req.params.venueId });
    if (venueError) return res.status(400).json({ error: venueError.details[0].message });

    const { error: queryError, value: queryValue } = amenityQuerySchema.validate(req.query);
    if (queryError) return res.status(400).json({ error: queryError.details[0].message });

    const cacheKey = `amenities:${req.params.venueId}:${queryValue.type || 'all'}`;
    const cached = await redis.getJSON(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    let query = db
      .collection('venues').doc(req.params.venueId)
      .collection('amenities');

    if (queryValue.type) query = query.where('type', '==', queryValue.type);

    const snapshot = await query.orderBy('name').get();
    const amenities = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const result = { amenities, count: amenities.length };
    await redis.setJSON(cacheKey, result, TTL.AMENITIES);
    res.setHeader('X-Cache', 'MISS');
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
