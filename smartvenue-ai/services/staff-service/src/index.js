'use strict';

const express  = require('express');
const helmet   = require('helmet');
const cors     = require('cors');
const jwt      = require('jsonwebtoken');
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

const db      = getFirestore();
const pubsub  = new PubSub({ projectId: process.env.PROJECT_ID });
const JWT_KEY = process.env.JWT_SECRET || 'dev-secret';

const app = express();
app.use(helmet());
app.use(cors({ origin: true }));
app.use(express.json());

// ── Middleware: Verify staff JWT ───────────────────────────────────────────────
function staffAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorised' });
  try {
    req.staff = jwt.verify(auth.slice(7), JWT_KEY);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid staff token' });
  }
}

// ── POST /api/staff/login ─────────────────────────────────────────────────────
app.post('/api/staff/login', async (req, res, next) => {
  try {
    const { email, password, venueId } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    // Look up staff by email
    const snapshot = await db.collection('staff')
      .where('email', '==', email.toLowerCase())
      .where('venueId', '==', venueId)
      .limit(1).get();

    if (snapshot.empty) return res.status(401).json({ error: 'Invalid credentials' });

    const staffDoc  = snapshot.docs[0];
    const staffData = staffDoc.data();

    // NOTE: In production, use bcrypt.compare() to verify hashed password
    // For this demo we store a plaintext password hash field
    if (staffData.passwordHash !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({
      uid:     staffDoc.id,
      email:   staffData.email,
      role:    staffData.role,    // 'security' | 'concession' | 'medical' | 'gate' | 'manager'
      venueId: staffData.venueId,
    }, JWT_KEY, { expiresIn: '12h' });

    res.json({ token, role: staffData.role, displayName: staffData.displayName });
  } catch (err) { next(err); }
});

// ── PUT /api/staff/position ───────────────────────────────────────────────────
app.put('/api/staff/position', staffAuth, async (req, res, next) => {
  try {
    const { lat, lng, venueId } = req.body;
    if (!lat || !lng || !venueId) return res.status(400).json({ error: 'lat, lng, venueId required' });

    await db.collection('venues').doc(venueId)
      .collection('staff').doc(req.staff.uid)
      .set({
        staffId:     req.staff.uid,
        email:       req.staff.email,
        role:        req.staff.role,
        lat,
        lng,
        updatedAt:   new Date().toISOString(),
        status:      'active',
      }, { merge: true });

    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── GET /api/staff/tasks ──────────────────────────────────────────────────────
app.get('/api/staff/tasks', staffAuth, async (req, res, next) => {
  try {
    const { venueId } = req.query;
    const snapshot = await db.collection('venues').doc(venueId)
      .collection('tasks')
      .where('assignedTo', '==', req.staff.uid)
      .where('status', 'in', ['pending', 'in_progress'])
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    const tasks = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ tasks });
  } catch (err) { next(err); }
});

// ── PUT /api/staff/tasks/:taskId ──────────────────────────────────────────────
app.put('/api/staff/tasks/:taskId', staffAuth, async (req, res, next) => {
  try {
    const { venueId, status } = req.body;
    const allowed = ['in_progress', 'completed', 'rejected'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    await db.collection('venues').doc(venueId)
      .collection('tasks').doc(req.params.taskId)
      .update({ status, updatedAt: new Date().toISOString(), updatedBy: req.staff.uid });

    res.json({ success: true, taskId: req.params.taskId, status });
  } catch (err) { next(err); }
});

// ── POST /api/staff/tasks ─────────────────────────────────────────────────────
// Manager creates a task for staff
app.post('/api/staff/tasks', staffAuth, async (req, res, next) => {
  try {
    if (!['manager', 'security'].includes(req.staff.role)) {
      return res.status(403).json({ error: 'Only managers can assign tasks' });
    }

    const { venueId, assignedTo, title, description, priority, zoneId } = req.body;
    const taskId = uuidv4();
    const now = new Date().toISOString();

    const task = {
      taskId,
      venueId,
      assignedTo,
      assignedBy: req.staff.uid,
      title,
      description,
      priority: priority || 'medium',
      zoneId:   zoneId || null,
      status:   'pending',
      createdAt: now,
    };

    await db.collection('venues').doc(venueId)
      .collection('tasks').doc(taskId)
      .set(task);

    // Notify assigned staff
    await pubsub.topic('staff-tasks').publishMessage({
      data: Buffer.from(JSON.stringify({ taskType: 'new_task', task })),
    });

    res.status(201).json({ success: true, taskId });
  } catch (err) { next(err); }
});

// ── POST /api/staff/incidents ─────────────────────────────────────────────────
app.post('/api/staff/incidents', staffAuth, async (req, res, next) => {
  try {
    const { venueId, zoneId, severity, description } = req.body;
    if (!venueId || !zoneId || !severity) {
      return res.status(400).json({ error: 'venueId, zoneId and severity required' });
    }

    const incidentId = uuidv4();
    const now = new Date().toISOString();

    const incident = {
      incidentId,
      venueId,
      zoneId,
      severity,     // 1 | 2 | 3  (3 = critical)
      description,
      reportedBy:   req.staff.uid,
      status:       'open',
      createdAt:    now,
    };

    await db.collection('venues').doc(venueId)
      .collection('incidents').doc(incidentId)
      .set(incident);

    // Critical incidents publish to crowd-alerts for Ops Dashboard
    if (severity >= 2) {
      await pubsub.topic('crowd-alerts').publishMessage({
        data: Buffer.from(JSON.stringify({
          alertType: 'staff_incident',
          severity:  severity === 3 ? 'red' : 'amber',
          venueId,
          zoneId,
          incidentId,
          description,
          timestamp: now,
        })),
      });
    }

    logger.info({ action: 'incident_reported', incidentId, zoneId, severity });
    res.status(201).json({ success: true, incidentId });
  } catch (err) { next(err); }
});

// ── GET /api/staff/venue/:venueId/positions ───────────────────────────────────
// Ops Dashboard: all staff GPS positions
app.get('/api/staff/venue/:venueId/positions', staffAuth, async (req, res, next) => {
  try {
    const snapshot = await db.collection('venues').doc(req.params.venueId)
      .collection('staff')
      .where('status', '==', 'active')
      .get();
    const staff = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ staff });
  } catch (err) { next(err); }
});

app.get('/health', (req, res) => res.json({ status: 'healthy', service: 'staff-service' }));
app.use((err, req, res, next) => { logger.error(err.message); res.status(500).json({ error: err.message }); });

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => logger.info(`staff-service listening on :${PORT}`));
