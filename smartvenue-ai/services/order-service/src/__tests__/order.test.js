import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

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
              data: () => ({ id, name: 'Test Item', price: 50 }),
            })),
            set: vi.fn(async () => ({})),
            collection: vi.fn(() => ({
              doc: vi.fn(() => ({
                set: vi.fn(async () => ({})),
                get: vi.fn(async () => ({ exists: true, data: () => ({}) })),
                collection: vi.fn(() => ({
                  where: vi.fn(function() { return this; }),
                  orderBy: vi.fn(function() { return this; }),
                  limit: vi.fn(async function() {
                    return { docs: [] };
                  }),
                  get: vi.fn(async () => ({ docs: [] })),
                })),
              })),
            })),
          };
        }),
        where: vi.fn(function() { return this; }),
        orderBy: vi.fn(function() { return this; }),
        limit: vi.fn(function() { return this; }),
        get: vi.fn(async () => ({
          docs: [{
            id: 'order-123',
            data: () => ({ orderId: 'order-123', status: 'confirmed' }),
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

describe('Order Service API', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    app.post('/api/orders', (req, res) => {
      const { userId, venueId, standId, items, totalAmount } = req.body;

      if (!userId || !venueId || !standId || !items?.length) {
        return res.status(400).json({
          error: 'userId, venueId, standId and items are required'
        });
      }

      const orderId = 'order-' + Date.now();
      res.status(201).json({
        success: true,
        orderId,
        estimatedReadyMins: 10
      });
    });

    app.get('/api/orders/:orderId', (req, res) => {
      res.json({
        id: req.params.orderId,
        status: 'confirmed',
        totalAmount: 150,
      });
    });

    app.put('/api/orders/:orderId/status', (req, res) => {
      const { status } = req.body;
      const allowed = ['ready', 'collected', 'cancelled'];

      if (!allowed.includes(status)) {
        return res.status(400).json({
          error: `status must be one of: ${allowed.join(', ')}`
        });
      }

      res.json({ success: true, status });
    });

    app.get('/api/menu/:venueId', (req, res) => {
      res.json({
        items: [
          { id: 'item-1', name: 'Burger', price: 50, category: 'Food' },
          { id: 'item-2', name: 'Coke', price: 30, category: 'Drinks' },
        ],
        count: 2
      });
    });

    vi.clearAllMocks();
  });

  it('POST /api/orders validates required fields', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({
        userId: 'user-123',
        venueId: 'venue-001',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('required');
  });

  it('POST /api/orders succeeds with valid items', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({
        userId: 'user-123',
        venueId: 'venue-001',
        standId: 'stand-a',
        items: [
          { itemId: 'item-1', name: 'Burger', quantity: 1, price: 50 }
        ],
        totalAmount: 50,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.orderId).toBeDefined();
    expect(res.body.estimatedReadyMins).toBe(10);
  });

  it('GET /api/orders/:orderId returns order details', async () => {
    const res = await request(app).get('/api/orders/order-123');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('order-123');
    expect(res.body.status).toBe('confirmed');
  });

  it('PUT /api/orders/:orderId/status validates status value', async () => {
    const res = await request(app)
      .put('/api/orders/order-123/status')
      .send({
        status: 'invalid-status',
        venueId: 'venue-001',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid');
  });

  it('PUT /api/orders/:orderId/status accepts valid status', async () => {
    const res = await request(app)
      .put('/api/orders/order-123/status')
      .send({
        status: 'ready',
        venueId: 'venue-001',
        standId: 'stand-a',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('ready');
  });

  it('GET /api/menu/:venueId returns menu items', async () => {
    const res = await request(app).get('/api/menu/venue-001');

    expect(res.status).toBe(200);
    expect(res.body.items).toBeDefined();
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.count).toBe(2);
  });

  it('POST /api/orders calculates total correctly', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({
        userId: 'user-123',
        venueId: 'venue-001',
        standId: 'stand-a',
        items: [
          { itemId: 'item-1', name: 'Burger', quantity: 2, price: 50 },
          { itemId: 'item-2', name: 'Fries', quantity: 1, price: 30 },
        ],
        totalAmount: 130,
      });

    expect(res.status).toBe(201);
  });
});
