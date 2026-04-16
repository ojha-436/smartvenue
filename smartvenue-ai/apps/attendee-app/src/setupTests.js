import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock environment variables
process.env.VITE_ATTENDEE_API = 'http://localhost:8080';
process.env.VITE_CROWD_API = 'http://localhost:8081';
process.env.VITE_QUEUE_API = 'http://localhost:8082';
process.env.VITE_ORDER_API = 'http://localhost:8083';
process.env.VITE_FIREBASE_PROJECT_ID = 'test-project';

// Suppress console output during tests
global.console = {
  ...console,
  error: vi.fn(),
  warn: vi.fn(),
  log: vi.fn(),
};
