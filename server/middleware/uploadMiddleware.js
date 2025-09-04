/**
 * Secure file upload middleware using multer
 * Handles image uploads with validation and security measures
 */

const multer = require('multer');
const crypto = require('crypto');
const { validateFile, sanitizeFilename, MAX_FILE_SIZE, MAX_FILES_COUNT } = require('../utils/fileValidation');

// Configure memory storage for temporary file handling
const storage = multer.memoryStorage();

/**
 * File filter function for multer
 * Performs initial validation before storing the file
 */
const fileFilter = (req, file, cb) => {
  const validation = validateFile(file);
  
  if (validation.isValid) {
    cb(null, true);
  } else {
    cb(new Error(validation.error), false);
  }
};

/**
 * Configure multer with security settings
 */
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES_COUNT,
    fields: 10, // Limit number of non-file fields
    fieldNameSize: 100, // Limit field name size
    fieldSize: 1024 * 1024 // Limit field value size to 1MB
  }
});

/**
 * Middleware for handling multiple image uploads
 * @param {string} fieldName - The name of the form field for files
 * @param {number} maxCount - Maximum number of files (optional)
 */
function createUploadMiddleware(fieldName = 'images', maxCount = MAX_FILES_COUNT) {
  return upload.array(fieldName, maxCount);
}

/**
 * Middleware for handling single image upload
 * @param {string} fieldName - The name of the form field for the file
 */
function createSingleUploadMiddleware(fieldName = 'image') {
  return upload.single(fieldName);
}

/**
 * Error handling middleware for multer errors
 */
function handleUploadErrors(error, req, res, next) {
  if (!error) {
    return next();
  }

  // Check if it's a multer error by checking the code property
  if (error.code && (error.code.startsWith('LIMIT_') || error instanceof multer.MulterError)) {
    let message = 'File upload error';
    let statusCode = 400;

    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        message = `File too large. Maximum size allowed: ${MAX_FILE_SIZE / (1024 * 1024)}MB`;
        break;
      case 'LIMIT_FILE_COUNT':
        message = `Too many files. Maximum allowed: ${MAX_FILES_COUNT}`;
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected file field';
        break;
      case 'LIMIT_FIELD_COUNT':
        message = 'Too many form fields';
        break;
      case 'LIMIT_FIELD_KEY':
        message = 'Field name too long';
        break;
      case 'LIMIT_FIELD_VALUE':
        message = 'Field value too long';
        break;
      default:
        message = `Upload error: ${error.message}`;
    }

    return res.status(statusCode).json({
      success: false,
      error: message,
      code: error.code
    });
  }

  // Handle custom validation errors
  if (error.message && error.message.includes('Invalid file type')) {
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }

  // Handle other errors
  console.error('Upload error:', error);
  return res.status(500).json({
    success: false,
    error: 'Internal server error during file upload'
  });
}

/**
 * Middleware to process uploaded files after multer
 * Adds additional metadata and performs post-upload validation
 */
function processUploadedFiles(req, res, next) {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'No files uploaded'
    });
  }

  try {
    // Add metadata to each file
    req.files = req.files.map((file, index) => {
      // Generate unique ID for each file
      const fileId = crypto.randomBytes(16).toString('hex');
      
      // Create sanitized filename
      const sanitizedName = sanitizeFilename(file.originalname);
      
      return {
        ...file,
        id: fileId,
        sanitizedName: sanitizedName,
        uploadedAt: new Date().toISOString(),
        index: index
      };
    });

    // Add summary to request
    req.uploadSummary = {
      totalFiles: req.files.length,
      totalSize: req.files.reduce((sum, file) => sum + file.size, 0),
      fileTypes: [...new Set(req.files.map(file => file.mimetype))],
      uploadedAt: new Date().toISOString()
    };

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Error processing uploaded files'
    });
  }
}

/**
 * Middleware to validate request before upload
 * Checks for required fields and basic request structure
 */
function validateUploadRequest(req, res, next) {
  // Check content type
  if (!req.is('multipart/form-data')) {
    return res.status(400).json({
      success: false,
      error: 'Content-Type must be multipart/form-data'
    });
  }

  next();
}

/**
 * Complete upload middleware chain
 * Combines all upload-related middleware in the correct order
 */
function createCompleteUploadMiddleware(fieldName = 'images', maxCount = MAX_FILES_COUNT) {
  return [
    validateUploadRequest,
    createUploadMiddleware(fieldName, maxCount),
    processUploadedFiles,
    handleUploadErrors
  ];
}

module.exports = {
  createUploadMiddleware,
  createSingleUploadMiddleware,
  createCompleteUploadMiddleware,
  handleUploadErrors,
  processUploadedFiles,
  validateUploadRequest
};