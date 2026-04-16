/**
 * Global constants for the attendee application
 * Centralized configuration for colors, statuses, zones, endpoints, and storage keys
 */

/**
 * Color mapping for crowd status levels (text colors)
 * @type {Object}
 */
export const STATUS_COLORS = {
  clear: '#22C55E',
  busy: '#F97316',
  critical: '#EF4444',
};

/**
 * Background color mapping for crowd status levels
 * @type {Object}
 */
export const STATUS_BG_COLORS = {
  clear: '#DCFCE7',
  busy: '#FFEDD5',
  critical: '#FEE2E2',
};

/**
 * List of available venue zones
 * @type {Array<string>}
 */
export const ZONE_LIST = [
  'gate-1',
  'gate-2',
  'gate-3',
  'gate-4',
  'gate-5',
  'gate-6',
  'gate-7',
  'gate-8',
  'north-stand',
  'south-stand',
  'east-concourse',
  'west-concourse',
  'food-court-a',
  'food-court-b',
  'vip-lounge',
  'main-entry',
];

/**
 * API endpoint base URLs for microservices
 * All are fetched from environment variables with fallbacks
 * @type {Object}
 */
export const API_ENDPOINTS = {
  crowd: import.meta.env.VITE_CROWD_API || 'http://localhost:3001',
  queue: import.meta.env.VITE_QUEUE_API || 'http://localhost:3002',
  order: import.meta.env.VITE_ORDER_API || 'http://localhost:3003',
  attendee: import.meta.env.VITE_ATTENDEE_API || 'http://localhost:3004',
};

/**
 * LocalStorage key for queue membership tracking
 * Format: { [amenityId]: entryId }
 * @type {string}
 */
export const QUEUE_STORAGE_KEY = 'myQueues';

/**
 * Default venue ID used throughout the app
 * Can be overridden by localStorage or environment
 * @type {string}
 */
export const DEFAULT_VENUE_ID = 'venue-001';
