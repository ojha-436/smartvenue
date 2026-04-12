'use strict';

const express = require('express');
const { db } = require('../index');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ── GET /api/venues/:venueId ──────────────────────────────────────────────────
router.get('/:venueId', authenticate, async (req, res, next) => {
  try {
    const venueDoc = await db.collection('venues').doc(req.params.venueId).get();
    if (!venueDoc.exists) return res.status(404).json({ error: 'Venue not found' });
    res.json({ id: venueDoc.id, ...venueDoc.data() });
  } catch (err) { next(err); }
});

// ── GET /api/venues/:venueId/zones ────────────────────────────────────────────
router.get('/:venueId/zones', authenticate, async (req, res, next) => {
  try {
    const snapshot = await db
      .collection('venues').doc(req.params.venueId)
      .collection('zones')
      .orderBy('name')
      .get();

    const zones = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ zones, count: zones.length });
  } catch (err) { next(err); }
});

// ── GET /api/venues/:venueId/zones/:zoneId ────────────────────────────────────
// Returns real-time zone density + wait times from Firestore
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
    const { type } = req.query; // filter by type: food | restroom | merchandise
    let query = db
      .collection('venues').doc(req.params.venueId)
      .collection('amenities');

    if (type) query = query.where('type', '==', type);

    const snapshot = await query.orderBy('name').get();
    const amenities = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ amenities, count: amenities.length });
  } catch (err) { next(err); }
});

module.exports = router;
