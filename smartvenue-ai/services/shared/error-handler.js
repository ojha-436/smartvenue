/**
 * Unified error handling utilities for backend services
 * Provides consistent error response format and Express middleware
 */

const winston = require('winston');

/**
 * Standard error response format used across all services
 * @typedef {Object} ErrorResponse
 * @property {boolean} success - Always false for errors
 * @property {Object} error
 * @property {string} error.code - Machine-readable error code
 * @property {string} error.message - Human-readable error message
 * @property {any} [error.details] - Additional error details
 */

/**
 * Create a standardized error response
 * @param {number} statusCode HTTP status code
 * @param {string} message Human-readable error message
 * @param {string} [code] Machine-readable error code (defaults to HTTP status text)
 * @param {any} [details] Additional error context
 * @returns {ErrorResponse}
 */
function createErrorResponse(statusCode, message, code, details) {
  const statusTexts = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    422: 'UNPROCESSABLE_ENTITY',
    429: 'RATE_LIMITED',
    500: 'INTERNAL_ERROR',
    503: 'SERVICE_UNAVAILABLE',
  };

  return {
    success: false,
    error: {
      code: code || statusTexts[statusCode] || 'UNKNOWN_ERROR',
      message: message || 'An unexpected error occurred',
      ...(details && { details }),
    },
  };
}

/**
 * Send error response
 * @param {import('express').Response} res Express response object
 * @param {string} message Error message
 * @param {number} [statusCode=500] HTTP status code
 * @param {string} [code] Machine-readable error code
 * @param {any} [details] Additional details
 */
function sendError(res, message, statusCode = 500, code, details) {
  res.status(statusCode).json(
    createErrorResponse(statusCode, message, code, details)
  );
}

/**
 * Map common error types to HTTP status codes
 * @param {Error} err Error object to classify
 * @returns {{ statusCode: number, code: string, message: string }}
 */
function classifyError(err) {
  // Validation errors
  if (err.name === 'ValidationError' || err.statusCode === 400) {
    return {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: err.message || 'Invalid request data',
    };
  }

  // Authentication errors
  if (err.name === 'AuthenticationError' || err.statusCode === 401) {
    return {
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message: 'Authentication failed. Please provide valid credentials.',
    };
  }

  // Authorization errors
  if (err.name === 'AuthorizationError' || err.statusCode === 403) {
    return {
      statusCode: 403,
      code: 'FORBIDDEN',
      message: 'You do not have permission to access this resource.',
    };
  }

  // Not found errors
  if (err.name === 'NotFoundError' || err.statusCode === 404) {
    return {
      statusCode: 404,
      code: 'NOT_FOUND',
      message: err.message || 'The requested resource was not found.',
    };
  }

  // Firestore errors
  if (err.code === 'PERMISSION_DENIED') {
    return {
      statusCode: 403,
      code: 'PERMISSION_DENIED',
      message: 'Insufficient permissions to perform this operation.',
    };
  }

  if (err.code === 'NOT_FOUND') {
    return {
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Document not found.',
    };
  }

  if (err.code === 'ALREADY_EXISTS') {
    return {
      statusCode: 409,
      code: 'CONFLICT',
      message: 'A resource with this ID already exists.',
    };
  }

  // Rate limiting
  if (err.statusCode === 429 || err.code === 'RATE_LIMITED') {
    return {
      statusCode: 429,
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please try again later.',
    };
  }

  // Default: Internal server error
  return {
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    message: 'An internal server error occurred. Please try again later.',
  };
}

/**
 * Express error handling middleware
 * Should be added as the last middleware in the app
 * Catches all errors and responds with standardized format
 *
 * @param {Error} err Error object
 * @param {import('express').Request} req Express request object
 * @param {import('express').Response} res Express response object
 * @param {Function} next Express next function
 *
 * @example
 * app.use(errorHandler());
 */
function errorHandler(logger = console) {
  return (err, req, res, next) => {
    const { statusCode, code, message } = classifyError(err);

    // Log error with context
    const logLevel = statusCode >= 500 ? 'error' : 'warn';
    const logData = {
      message,
      code,
      status: statusCode,
      path: req.path,
      method: req.method,
      originalError: err.message,
    };

    if (logger.error) {
      logger[logLevel](logData);
    } else {
      console.error(`[${logLevel.toUpperCase()}]`, logData);
    }

    // Send error response
    res.status(statusCode).json(
      createErrorResponse(statusCode, message, code)
    );
  };
}

module.exports = {
  createErrorResponse,
  sendError,
  classifyError,
  errorHandler,
};
