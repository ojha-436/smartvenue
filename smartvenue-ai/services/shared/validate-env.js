/**
 * Environment variable validation utility
 * Ensures required environment variables are set and properly formatted
 */

/**
 * Validate that all required environment variables are present
 * Throws a clear error on startup if any are missing
 * Optionally validates format of known environment variables
 *
 * @param {Array<string>} required Array of required environment variable names
 * @param {Object} [formats] Optional object mapping env var names to validation functions
 * @throws {Error} If any required variable is missing or validation fails
 *
 * @example
 * validateEnv(['FIREBASE_KEY', 'PROJECT_ID', 'PORT'], {
 *   PORT: (val) => {
 *     const port = parseInt(val);
 *     if (isNaN(port) || port < 1 || port > 65535) {
 *       throw new Error('PORT must be a valid number between 1 and 65535');
 *     }
 *   },
 *   FIREBASE_KEY: (val) => {
 *     try {
 *       JSON.parse(val);
 *     } catch {
 *       throw new Error('FIREBASE_KEY is not valid JSON');
 *     }
 *   },
 * });
 */
function validateEnv(required = [], formats = {}) {
  const missing = [];
  const invalid = [];

  // Check for missing variables
  for (const varName of required) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  // Report missing variables immediately
  if (missing.length > 0) {
    const missingList = missing.map((v) => `  - ${v}`).join('\n');
    throw new Error(
      `Missing required environment variables:\n${missingList}\n` +
      'Please set these variables before starting the service.'
    );
  }

  // Validate formats if provided
  for (const [varName, validator] of Object.entries(formats)) {
    if (process.env[varName]) {
      try {
        validator(process.env[varName]);
      } catch (err) {
        invalid.push(`${varName}: ${err.message}`);
      }
    }
  }

  // Report invalid variables
  if (invalid.length > 0) {
    const invalidList = invalid.map((v) => `  - ${v}`).join('\n');
    throw new Error(`Invalid environment variable format:\n${invalidList}`);
  }

  console.log(
    `Environment validation passed. Loaded ${required.length} required variables.`
  );
}

/**
 * Common format validators for standard environment variables
 */
const validators = {
  /**
   * Validate PORT is a number between 1 and 65535
   */
  port: (val) => {
    const port = parseInt(val, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      throw new Error('PORT must be a valid number between 1 and 65535');
    }
  },

  /**
   * Validate JSON format (used for FIREBASE_KEY, etc.)
   */
  json: (val) => {
    try {
      JSON.parse(val);
    } catch (err) {
      throw new Error(`Not valid JSON: ${err.message}`);
    }
  },

  /**
   * Validate PROJECT_ID format (GCP project ID pattern)
   */
  projectId: (val) => {
    if (!/^[a-z0-9-]+$/.test(val) || val.length > 30) {
      throw new Error(
        'PROJECT_ID must be lowercase alphanumeric with hyphens, max 30 chars'
      );
    }
  },

  /**
   * Validate URL format
   */
  url: (val) => {
    try {
      new URL(val);
    } catch (err) {
      throw new Error(`Not a valid URL: ${err.message}`);
    }
  },

  /**
   * Validate non-empty string
   */
  nonEmpty: (val) => {
    if (!val || typeof val !== 'string' || val.trim().length === 0) {
      throw new Error('Must be a non-empty string');
    }
  },
};

module.exports = validateEnv;
module.exports.validators = validators;
