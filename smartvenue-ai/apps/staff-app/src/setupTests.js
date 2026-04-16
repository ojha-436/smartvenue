import '@testing-library/jest-dom';
import { vi } from 'vitest';

process.env.VITE_STAFF_API = 'http://localhost:8084';
process.env.VITE_CROWD_API = 'http://localhost:8081';
process.env.VITE_VENUE_ID = 'venue-001';
process.env.VITE_FIREBASE_PROJECT_ID = 'test-project';

global.console = {
  ...console,
  error: vi.fn(),
  warn: vi.fn(),
  log: vi.fn(),
};
