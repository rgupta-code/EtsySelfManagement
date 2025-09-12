/**
 * Custom error classes for better error handling and debugging
 */

class BaseError extends Error {
  constructor(message, statusCode = 500, errorCode = null, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
    
    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      errorCode: this.errorCode,
      details: this.details,
      timestamp: this.timestamp
    };
  }
}

class ValidationError extends BaseError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

class AuthenticationError extends BaseError {
  constructor(message, details = null) {
    super(message, 401, 'AUTHENTICATION_ERROR', details);
  }
}

class AuthorizationError extends BaseError {
  constructor(message, details = null) {
    super(message, 403, 'AUTHORIZATION_ERROR', details);
  }
}

class NotFoundError extends BaseError {
  constructor(resource, identifier = null) {
    const message = identifier 
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(message, 404, 'NOT_FOUND_ERROR', { resource, identifier });
  }
}

class ExternalServiceError extends BaseError {
  constructor(serviceName, originalError, isRetryable = false) {
    super(
      `${serviceName} service error: ${originalError.message}`,
      502,
      'EXTERNAL_SERVICE_ERROR',
      {
        serviceName,
        originalError: originalError.message,
        isRetryable,
        stack: originalError.stack
      }
    );
  }
}

class FileProcessingError extends BaseError {
  constructor(message, filename = null, details = null) {
    super(message, 422, 'FILE_PROCESSING_ERROR', { filename, ...details });
  }
}

class RateLimitError extends BaseError {
  constructor(service, retryAfter = null) {
    super(
      `Rate limit exceeded for ${service}`,
      429,
      'RATE_LIMIT_ERROR',
      { service, retryAfter }
    );
  }
}

module.exports = {
  BaseError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ExternalServiceError,
  FileProcessingError,
  RateLimitError
};