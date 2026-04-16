'use strict';

const express  = require('express');
const helmet   = require('helmet');
const cors     = require('cors');
const rateLimit = require('express-rate-limit');
const Joi      = require('joi');
const jwt      = require('jsonwebtoken');
const bcrypt   = require('bcrypt');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore }        = require('firebase-admin/firestore');
const { getAuth }             = require('firebase-admin/auth');
const { PubSub }              = require('@google-cloud/pubsub');
const { v4: uuidv4 }          = require('uuid');
const winston  = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

// Validate JWT_SECRET is set at startup
const JWT_KEY = process.env.JWT_SECRET;
if (!JWT_KEY) {
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

const db      = getFirestore();
const pubsub  = new PubSub({ projectId: process.env.PROJECT_ID });

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

// ── Middleware: Verify staff JWT ───────────────────────────────────────────────
function staffAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) {
    logger.warn({ action: 'auth_failed', reason: 'missing_auth_header', path: req.path });
    return res.status(401).json({ error: 'Unauthorised' });
  }
  try {
    req.staff = jwt.verify(auth.slice(7), JWT_KEY);
    next();
  } catch (err) {
    logger.warn({ action: 'auth_failed', reason: 'invalid_token', error: err.message, path: req.path });
    res.status(401).json({ error: 'Invalid staff token' });
  }
}

// ── Joi Schemas ───────────────────────────────────────────────────────────────
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  venueId: Joi.string().required(),
});

const positionSchema = Joi.object({
  lat: Joi.number().min(-90).max(90).required(),
  lng: Joi.number().min(-180).max(180).required(),
  venueId: Joi.string().required(),
});

const taskCreateSchema = Joi.object({
  venueId: Joi.string().required(),
  assignedTo: Joi.string().required(),
  title: Joi.string().min(1).max(255).required(),
  description: Joi.string().max(1000).optional(),
  priority: Joi.string().valid('low', 'medium', 'high').optional(),
  zoneId: Joi.string().optional(),
});

const taskUpdateSchema = Joi.object({
  venueId: Joi.string().required(),
  status: Joi.string().valid('in_progress', 'completed', 'rejected').required(),
});

const incidentSchema = Joi.object({
  venueId: Joi.string().required(),
  zoneId: Joi.string().required(),
  severity: Joi.number().min(1).max(3).required(),
  description: Joi.string().max(1000).optional(),
});

// ── POST /api/staff/login ─────────────────────────────────────────────────────
app.post('/api/staff/login', async (req, res, next) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    // Look up staff by email
    const snapshot = await db.collection('staff')
      .where('email', '==', value.email.toLowerCase())
      .where('venueId', '==', value.venueId)
      .limit(1).get();

    if (snapshot.empty) {
      logger.warn({ action: 'login_failed', reason: 'user_not_found', email: value.email });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const staffDoc  = snapshot.docs[0];
    const staffData = staffDoc.data();

    // Use bcrypt to compare hashed password
    const passwordMatch = await bcrypt.compare(value.password, staffData.passwordHash);
    if (!passwordMatch) {
      logger.warn({ action: 'login_failed', reason: 'invalid_password', email: value.email });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({
      uid:     staffDoc.id,
      email:   staffData.email,
      role:    staffData.role,
      venueId: staffData.venueId,
    }, JWT_KEY, { expiresIn: '12h' });

    res.json({ token, role: staffData.role, displayName: staffData.displayName });
  } catch (err) { next(err); }
});

// ── PUT /api/staff/position ───────────────────────────────────────────────────
app.put('/api/staff/position', staffAuth, async (req, res, next) => {
  try {
    const { error, value } = positionSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    await db.collection('venues').doc(value.venueId)
      .collection('staff').doc(req.staff.uid)
      .set({
        staffId:     req.staff.uid,
        email:       req.staff.email,
        role:        req.staff.role,
        lat:         value.lat,
        lng:         value.lng,
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
    if (!venueId) return res.status(400).json({ error: 'venueId query parameter required' });

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
    const { error, value } = taskUpdateSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    await db.collection('venues').doc(value.venueId)
      .collection('tasks').doc(req.params.taskId)
      .update({ status: value.status, updatedAt: new Date().toISOString(), updatedBy: req.staff.uid });

    res.json({ success: true, taskId: req.params.taskId, status: value.status });
  } catch (err) { next(err); }
});

// ── POST /api/staff/tasks ─────────────────────────────────────────────────────
// Manager creates a task for staff
app.post('/api/staff/tasks', staffAuth, async (req, res, next) => {
  try {
    if (!['manager', 'security'].includes(req.staff.role)) {
      logger.warn({ action: 'task_creation_denied', uid: req.staff.uid, role: req.staff.role });
      return res.status(403).json({ error: 'Only managers can assign tasks' });
    }

    const { error, value } = taskCreateSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const taskId = uuidv4();
    const now = new Date().toISOString();

    const task = {
      taskId,
      venueId: value.venueId,
      assignedTo: value.assignedTo,
      assignedBy: req.staff.uid,
      title: value.title,
      description: value.description || '',
      priority: value.priority || 'medium',
      zoneId:   value.zoneId || null,
      status:   'pending',
      createdAt: now,
    };

    await db.collection('venues').doc(value.venueId)
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
    const { error, value } = incidentSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const incidentId = uuidv4();
    const now = new Date().toISOString();

    const incident = {
      incidentId,
      venueId: value.venueId,
      zoneId: value.zoneId,
      severity:     value.severity,
      description:  value.description || '',
      reportedBy:   req.staff.uid,
      status:       'open',
      createdAt:    now,
    };

    await db.collection('venues').doc(value.venueId)
      .collection('incidents').doc(incidentId)
      .set(incident);

    // Critical incidents publish to crowd-alerts for Ops Dashboard
    if (value.severity >= 2) {
      await pubsub.topic('crowd-alerts').publishMessage({
        data: Buffer.from(JSON.stringify({
          alertType: 'staff_incident',
          severity:  value.severity === 3 ? 'red' : 'amber',
          venueId:   value.venueId,
          zoneId:    value.zoneId,
          incidentId,
          description: value.description,
          timestamp: now,
        })),
      });
    }

    logger.info({ action: 'incident_reported', incidentId, zoneId: value.zoneId, severity: value.severity });
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
    const staff = snapshot.docs.map(d => {
      const data = d.data();
      // Don't expose email to dashboard, only public staff info
      return { id: d.id, staffId: data.staffId, role: data.role, lat: data.lat, lng: data.lng, updatedAt: data.updatedAt };
    });
    res.json({ staff });
  } catch (err) { next(err); }
});

app.get('/health', (req, res) => res.json({ status: 'healthy', service: 'staff-service' }));
app.use((err, req, res, next) => { logger.error({ error: err.message, stack: err.stack }); res.status(500).json({ error: err.message }); });

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => logger.info(`staff-service listening on :${PORT}`));
