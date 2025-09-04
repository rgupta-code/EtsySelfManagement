/**
 * Error handling middleware for detailed error responses
 * Provides consistent error formatting and logging
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * Custom error class for API errors
 */
class APIError extends Error {
  constructor(message, statusCode = 500, code = null, details = null) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Error logging function
 */
async function logError(error, req = null) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      statusCode: error.statusCode,
      code: error.code,
      details: error.details
    },
    request: req ? {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
      params: req.params,
      query: req.query,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    } : null
  };

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error('API Error:', JSON.stringify(logEntry, null, 2));
  }

  // In production, you might want to log to a file or external service
  if (process.env.NODE_ENV === 'production') {
    try {
      const logDir = path.join(process.cwd(), 'logs');
      await fs.mkdir(logDir, { recursive: true });
      
      const logFile = path.join(logDir, `error-${new Date().toISOString().split('T')[0]}.log`);
      await fs.appendFile(logFile, JSON.stringify(logEntry) + '\n');
    } catch (logError) {
      console.error('Failed to write error log:', logError);
    }
  }
}

/**
 * Main error handling middleware
 */
function errorHandler(error, req, res, next) {
  // If response already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(error);
  }

  // Log the error
  logError(error, req);

  // Determine status code
  let statusCode = 500;
  if (error.statusCode) {
    statusCode = error.statusCode;
  } else if (error.name === 'ValidationError') {
    statusCode = 400;
  } else if (error.name === 'UnauthorizedError') {
    statusCode = 401;
  } else if (error.name === 'ForbiddenError') {
    statusCode = 403;
  } else if (error.name === 'NotFoundError') {
    statusCode = 404;
  }

  // Prepare error response
  const errorResponse = {
    success: false,
    error: {
      message: error.message || 'Internal server error',
      code: error.code || 'INTERNAL_ERROR',
      timestamp: error.timestamp || new Date().toISOString()
    }
  };

  // Add additional details in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error.stack = error.stack;
    errorResponse.error.details = error.details;
  }

  // Add specific error details if available
  if (error.details) {
    errorResponse.error.details = error.details;
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
}

/**
 * 404 handler for API routes
 */
function notFoundHandler(req, res) {
  const error = new APIError(
    `API endpoint not found: ${req.method} ${req.path}`,
    404,
    'ENDPOINT_NOT_FOUND',
    {
      method: req.method,
      path: req.path,
      availableEndpoints: [
        'POST /api/upload',
        'GET /api/status/:processingId',
        'GET /api/settings',
        'PUT /api/settings',
        'PATCH /api/settings/:section',
        'GET /api/auth/google',
        'GET /api/auth/google/callback',
        'GET /api/auth/etsy',
        'GET /api/auth/etsy/callback',
        'GET /api/health'
      ]
    }
  );

  res.status(404).json({
    success: false,
    error: {
      message: error.message,
      code: error.code,
      details: error.details,
      timestamp: error.timestamp
    }
  });
}

/**
 * Async error wrapper for route handlers
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Validation error handler
 */
function validationErrorHandler(validationResult) {
  return (req, res, next) => {
    if (!validationResult.isEmpty()) {
      const errors = validationResult.array();
      const error = new APIError(
        'Validation failed',
        400,
        'VALIDATION_ERROR',
        {
          fields: errors.map(err => ({
            field: err.param,
            message: err.msg,
            value: err.value
          }))
        }
      );
      return next(error);
    }
    next();
  };
}

/**
 * Rate limiting error handler
 */
function rateLimitErrorHandler(req, res) {
  const error = new APIError(
    'Too many requests, please try again later',
    429,
    'RATE_LIMIT_EXCEEDED',
    {
      retryAfter: '60 seconds',
      limit: req.rateLimit?.limit,
      remaining: req.rateLimit?.remaining,
      resetTime: req.rateLimit?.resetTime
    }
  );

  res.status(429).json({
    success: false,
    error: {
      message: error.message,
      code: error.code,
      details: error.details,
      timestamp: error.timestamp
    }
  });
}

/**
 * Service unavailable error handler
 */
function serviceUnavailableHandler(serviceName, originalError) {
  return new APIError(
    `${serviceName} service is currently unavailable`,
    503,
    'SERVICE_UNAVAILABLE',
    {
      service: serviceName,
      originalError: originalError.message,
      retryAfter: '5 minutes'
    }
  );
}

/**
 * Create error response for external API failures
 */
function createExternalAPIError(serviceName, originalError, fallbackData = null) {
  return new APIError(
    `${serviceName} API error: ${originalError.message}`,
    502,
    'EXTERNAL_API_ERROR',
    {
      service: serviceName,
      originalError: originalError.message,
      fallbackAvailable: !!fallbackData,
      fallbackData
    }
  );
}

module.exports = {
  APIError,
  errorHandler,
  notFoundHandler,
  asyncHandler,
  validationErrorHandler,
  rateLimitErrorHandler,
  serviceUnavailableHandler,
  createExternalAPIError,
  logError
};