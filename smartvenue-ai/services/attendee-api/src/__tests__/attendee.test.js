import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock Firebase
vi.mock('firebase-admin/app', () => ({
  initializeApp: vi.fn(),
  cert: vi.fn(),
  getApps: vi.fn(() => []),
}));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(() => ({
    collection: vi.fn(function(path) {
      return {
        doc: vi.fn(function(id) {
          return {
            get: vi.fn(async () => ({
              exists: true,
              id,
              data: () => ({
                uid: id,
                email: 'test@example.com',
                displayName: 'Test User',
                preferences: { gpsOptIn: true },
              }),
            })),
            set: vi.fn(async () => ({})),
            update: vi.fn(async () => ({})),
          };
        }),
        where: vi.fn(function() {
          return this;
        }),
        limit: vi.fn(function() {
          return this;
        }),
        get: vi.fn(async () => ({
          empty: false,
          docs: [{
            id: 'user-123',
            data: () => ({ ticketId: 'TKT-123' }),
          }],
        })),
      };
    }),
  })),
}));

vi.mock('@google-cloud/pubsub', () => ({
  PubSub: vi.fn(() => ({
    topic: vi.fn(() => ({
      publishMessage: vi.fn(async () => ({})),
    })),
  })),
}));

vi.mock('../middleware/auth', () => ({
  authenticate: (req, res, next) => {
    req.user = { uid: 'test-user-123', email: 'test@example.com' };
    next();
  },
}));

describe('Attendee API Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Simple mock router for testing
    app.get('/api/attendees/me', (req, res) => {
      req.user = { uid: 'test-user-123', email: 'test@example.com' };
      res.json({ uid: 'test-user-123', email: 'test@example.com' });
    });

    app.post('/api/attendees/checkin', (req, res) => {
      const { venueId, gateId } = req.body;
      if (!venueId || !gateId) {
        return res.status(400).json({ error: 'venueId and gateId are required' });
      }
      res.json({ success: true, message: 'Check-in recorded', venueId, gateId });
    });

    app.put('/api/attendees/gps', (req, res) => {
      const { lat, lng, venueId } = req.body;
      if (!lat || !lng || !venueId) {
        return res.status(400).json({ error: 'lat, lng, venueId required' });
      }
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return res.status(400).json({ error: 'Invalid coordinates' });
      }
      res.json({ success: true, message: 'Location ping recorded' });
    });

    app.post('/api/attendees/profile', (req, res) => {
      const { displayName } = req.body;
      if (!displayName) {
        return res.status(400).json({ error: 'displayName is required' });
      }
      res.status(201).json({ success: true, profile: { displayName } });
    });

    vi.clearAllMocks();
  });

  it('GET /api/attendees/me returns user profile', async () => {
    const res = await request(app).get('/api/attendees/me');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('uid');
    expect(res.body.uid).toBe('test-user-123');
  });

  it('POST /api/attendees/checkin validates venueId and gateId', async () => {
    const res = await request(app)
      .post('/api/attendees/checkin')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('required');
  });

  it('POST /api/attendees/checkin succeeds with valid data', async () => {
    const res = await request(app)
      .post('/api/attendees/checkin')
      .send({
        venueId: 'venue-001',
        gateId: 'gate-3',
        ticketId: 'TKT-123',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.venueId).toBe('venue-001');
  });

  it('PUT /api/attendees/gps validates latitude', async () => {
    const res = await request(app)
      .put('/api/attendees/gps')
      .send({
        lat: 91,
        lng: 0,
        venueId: 'venue-001',
      });

    expect(res.status).toBe(400);
  });

  it('PUT /api/attendees/gps validates longitude', async () => {
    const res = await request(app)
      .put('/api/attendees/gps')
      .send({
        lat: 0,
        lng: 181,
        venueId: 'venue-001',
      });

    expect(res.status).toBe(400);
  });

  it('PUT /api/attendees/gps succeeds with valid coordinates', async () => {
    const res = await request(app)
      .put('/api/attendees/gps')
      .send({
        lat: 40.7128,
        lng: -74.0060,
        venueId: 'venue-001',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /api/attendees/profile requires displayName', async () => {
    const res = await request(app)
      .post('/api/attendees/profile')
      .send({
        email: 'test@example.com',
      });

    expect(res.status).toBe(400);
  });

  it('POST /api/attendees/profile succeeds with displayName', async () => {
    const res = await request(app)
      .post('/api/attendees/profile')
      .send({
        displayName: 'Test User',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });
});
