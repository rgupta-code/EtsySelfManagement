/**
 * Request validation middleware using Joi for schema validation
 * Provides consistent validation across all API endpoints
 */

const Joi = require('joi');
const { ValidationError } = require('../utils/errors');

/**
 * Create validation middleware for request body, query, or params
 * @param {Object} schema - Joi validation schema
 * @param {string} source - 'body', 'query', or 'params'
 * @returns {Function} Express middleware function
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const data = req[source];
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      return next(new ValidationError('Request validation failed', { details }));
    }

    // Replace the original data with validated/sanitized data
    req[source] = value;
    next();
  };
}

// Common validation schemas
const schemas = {
  // File upload validation
  uploadFiles: Joi.object({
    userId: Joi.string().optional(),
    price: Joi.number().min(0.01).max(999999.99).optional(),
    quantity: Joi.number().integer().min(1).max(999).optional()
  }),

  // Settings validation
  settings: Joi.object({
    settings: Joi.object({
      watermark: Joi.object({
        text: Joi.string().max(50).optional(),
        position: Joi.string().valid('bottom-right', 'bottom-left', 'top-right', 'top-left', 'center').optional(),
        opacity: Joi.number().min(0).max(1).optional(),
        fontSize: Joi.number().min(8).max(100).optional(),
        color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional(),
        spacing: Joi.number().min(0).max(500).optional(),
        angle: Joi.number().min(-180).max(180).optional(),
        enabled: Joi.boolean().optional()
      }).optional(),
      
      collage: Joi.object({
        layout: Joi.string().valid('grid', 'mosaic', 'featured').optional(),
        dimensions: Joi.object({
          width: Joi.number().min(500).max(4000).optional(),
          height: Joi.number().min(500).max(4000).optional()
        }).optional(),
        spacing: Joi.number().min(0).max(50).optional(),
        backgroundColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional(),
        enabled: Joi.boolean().optional()
      }).optional(),
      
      googleDrive: Joi.object({
        folderId: Joi.string().optional().allow(null),
        folderName: Joi.string().max(100).optional(),
        autoUpload: Joi.boolean().optional()
      }).optional(),
      
      etsy: Joi.object({
        shopId: Joi.string().optional().allow(null),
        defaultCategory: Joi.string().optional().allow(null),
        autoDraft: Joi.boolean().optional()
      }).optional(),
      
      processing: Joi.object({
        imageQuality: Joi.number().min(10).max(100).optional(),
        maxImageSize: Joi.number().min(1048576).max(52428800).optional(), // 1MB to 50MB
        allowedFormats: Joi.array().items(Joi.string()).optional()
      }).optional()
    }).required()
  }),

  // Settings section update
  settingsSection: Joi.object({
    updates: Joi.object().required()
  }),

  // Image generation
  generateImages: Joi.object({
    prompt: Joi.string().min(1).max(500).required(),
    count: Joi.number().integer().min(1).max(4).default(1),
    style: Joi.string().valid('product', 'lifestyle', 'artistic', 'minimalist').default('product')
  }),

  // Processing ID parameter
  processingId: Joi.object({
    processingId: Joi.string().pattern(/^proc_\d+_[a-z0-9]+$/).required()
  }),

  // Pagination query parameters
  pagination: Joi.object({
    limit: Joi.number().integer().min(1).max(100).default(20),
    offset: Joi.number().integer().min(0).default(0),
    page: Joi.number().integer().min(1).optional(),
    perPage: Joi.number().integer().min(1).max(100).optional()
  }),

  // Dashboard query parameters
  dashboardQuery: Joi.object({
    limit: Joi.number().integer().min(1).max(100).default(50),
    offset: Joi.number().integer().min(0).default(0),
    sortOn: Joi.string().valid('created', 'updated', 'score', 'popularity').optional(),
    sortOrder: Joi.string().valid('asc', 'desc').optional()
  })
};

// Validation middleware factory functions
const validateBody = (schema) => validate(schema, 'body');
const validateQuery = (schema) => validate(schema, 'query');
const validateParams = (schema) => validate(schema, 'params');

// Pre-configured validation middleware
const validators = {
  uploadFiles: validateBody(schemas.uploadFiles),
  settings: validateBody(schemas.settings),
  settingsSection: validateBody(schemas.settingsSection),
  generateImages: validateBody(schemas.generateImages),
  processingId: validateParams(schemas.processingId),
  pagination: validateQuery(schemas.pagination),
  dashboardQuery: validateQuery(schemas.dashboardQuery)
};

module.exports = {
  validate,
  validateBody,
  validateQuery,
  validateParams,
  schemas,
  validators
};