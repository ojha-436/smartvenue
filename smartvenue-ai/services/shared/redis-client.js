'use strict';

/**
 * @module redis-client
 * @description Shared Redis (Cloud Memorystore) client for SmartVenue services.
 * Provides caching utilities with TTL support and connection error handling.
 */

const redis = require('redis');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const REDIS_AUTH = process.env.REDIS_AUTH || undefined;

let client = null;
let isConnected = false;

/**
 * Initialize and return the Redis client singleton.
 * @returns {Promise<object>} Redis client instance
 */
async function getClient() {
  if (client && isConnected) return client;

  client = redis.createClient({
    socket: { host: REDIS_HOST, port: REDIS_PORT, reconnectStrategy: (retries) => Math.min(retries * 100, 5000) },
    password: REDIS_AUTH,
  });

  client.on('error', (err) => {
    logger.error({ msg: 'Redis connection error', error: err.message });
    isConnected = false;
  });

  client.on('connect', () => {
    logger.info({ msg: 'Redis connected', host: REDIS_HOST, port: REDIS_PORT });
    isConnected = true;
  });

  await client.connect();
  return client;
}

/**
 * Get a cached value by key.
 * @param {string} key - Cache key
 * @returns {Promise<string|null>} Cached value or null
 */
async function get(key) {
  try {
    const c = await getClient();
    return await c.get(key);
  } catch (err) {
    logger.warn({ msg: 'Redis GET failed, falling back', key, error: err.message });
    return null;
  }
}

/**
 * Get a cached value parsed as JSON.
 * @param {string} key - Cache key
 * @returns {Promise<object|null>} Parsed object or null
 */
async function getJSON(key) {
  const val = await get(key);
  if (!val) return null;
  try { return JSON.parse(val); } catch { return null; }
}

/**
 * Set a value in the cache.
 * @param {string} key - Cache key
 * @param {string} value - Value to cache
 * @param {number} [ttlSeconds=300] - Time to live in seconds (default 5 min)
 * @returns {Promise<void>}
 */
async function set(key, value, ttlSeconds = 300) {
  try {
    const c = await getClient();
    await c.set(key, value, { EX: ttlSeconds });
  } catch (err) {
    logger.warn({ msg: 'Redis SET failed', key, error: err.message });
  }
}

/**
 * Set a JSON value in the cache.
 * @param {string} key - Cache key
 * @param {object} value - Object to cache
 * @param {number} [ttlSeconds=300] - Time to live in seconds
 * @returns {Promise<void>}
 */
async function setJSON(key, value, ttlSeconds = 300) {
  return set(key, JSON.stringify(value), ttlSeconds);
}

/**
 * Delete a cached value.
 * @param {string} key - Cache key
 * @returns {Promise<void>}
 */
async function del(key) {
  try {
    const c = await getClient();
    await c.del(key);
  } catch (err) {
    logger.warn({ msg: 'Redis DEL failed', key, error: err.message });
  }
}

/**
 * Check if Redis is connected and healthy.
 * @returns {Promise<boolean>}
 */
async function isHealthy() {
  try {
    const c = await getClient();
    const pong = await c.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}

/**
 * Gracefully close the Redis connection.
 * @returns {Promise<void>}
 */
async function disconnect() {
  if (client) {
    await client.quit();
    isConnected = false;
    client = null;
  }
}

module.exports = { get, getJSON, set, setJSON, del, isHealthy, disconnect, getClient };
