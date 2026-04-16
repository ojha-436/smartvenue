/**
 * Standardized response helpers for backend services
 * Ensures consistent success and error response formats across all endpoints
 */

/**
 * Send a success response with data
 * @param {import('express').Response} res Express response object
 * @param {any} data Response data
 * @param {number} [statusCode=200] HTTP status code
 *
 * @example
 * success(res, { userId: 'user123', name: 'John' }, 201);
 */
function success(res, data, statusCode = 200) {
  res.status(statusCode).json({
    success: true,
    data,
  });
}

/**
 * Send an error response
 * @param {import('express').Response} res Express response object
 * @param {string} message Error message
 * @param {number} [statusCode=400] HTTP status code
 * @param {any} [details] Additional error details
 *
 * @example
 * error(res, 'Item not found', 404);
 * error(res, 'Validation failed', 422, { field: 'email', issue: 'invalid format' });
 */
function error(res, message, statusCode = 400, details) {
  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(details && { details }),
    },
  });
}

/**
 * Send a paginated response with metadata
 * @param {import('express').Response} res Express response object
 * @param {Array} data Array of items
 * @param {number} page Current page number (1-indexed)
 * @param {number} limit Items per page
 * @param {number} total Total item count
 *
 * @example
 * const total = await db.collection('users').count();
 * const data = await db.collection('users').skip(page * limit).limit(limit).get();
 * paginated(res, data, page, limit, total);
 */
function paginated(res, data, page, limit, total) {
  const totalPages = Math.ceil(total / limit);
  const hasMore = page < totalPages - 1;

  res.json({
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasMore,
    },
  });
}

module.exports = {
  success,
  error,
  paginated,
};
