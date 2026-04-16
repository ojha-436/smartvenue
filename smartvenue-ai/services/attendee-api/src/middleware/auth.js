'use strict';

const jwt = require('jsonwebtoken');
const { getAuth } = require('firebase-admin/auth');
const winston = require('winston');

// Logger instance
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

// Validate JWT_SECRET is set at startup
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  logger.error('FATAL: JWT_SECRET environment variable is not set');
  process.exit(1);
}

/**
 * Verify Firebase ID token OR local JWT (for testing).
 * Attaches req.user = { uid, email, role }
 */
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
  } catch (err) {
    logger.debug({ action: 'firebase_token_fail', reason: err.message });
    // Fall through to JWT
  }

  // Try local JWT (dev / staff tokens)
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (err) {
    logger.warn({ action: 'auth_failed', reason: 'invalid_token', error: err.message, path: req.path });
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      logger.warn({ action: 'auth_failed', reason: 'insufficient_permissions', uid: req.user?.uid, required_roles: roles });
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
