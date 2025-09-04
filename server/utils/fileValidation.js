/**
 * File validation utilities for image upload handling
 * Validates file types, sizes, and security constraints
 */

const path = require('path');

// Configuration constants
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'image/webp'
];

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
const MAX_FILES_COUNT = 20; // Maximum number of files per upload

/**
 * Validates if the file type is allowed
 * @param {string} mimetype - The MIME type of the file
 * @param {string} originalname - Original filename
 * @returns {boolean} - True if file type is valid
 */
function isValidFileType(mimetype, originalname) {
  if (!mimetype || !originalname) {
    return false;
  }

  const extension = path.extname(originalname).toLowerCase();
  const normalizedMimetype = mimetype.toLowerCase();
  
  // Check if both mimetype and extension are allowed
  if (!ALLOWED_MIME_TYPES.includes(normalizedMimetype) || !ALLOWED_EXTENSIONS.includes(extension)) {
    return false;
  }
  
  // Check for matching pairs (prevent mismatched extension/mimetype)
  const validPairs = [
    { mime: 'image/jpeg', exts: ['.jpg', '.jpeg'] },
    { mime: 'image/jpg', exts: ['.jpg', '.jpeg'] },
    { mime: 'image/png', exts: ['.png'] },
    { mime: 'image/webp', exts: ['.webp'] }
  ];
  
  return validPairs.some(pair => 
    pair.mime === normalizedMimetype && pair.exts.includes(extension)
  );
}

/**
 * Validates if the file size is within limits
 * @param {number} size - File size in bytes
 * @returns {boolean} - True if file size is valid
 */
function isValidFileSize(size) {
  return typeof size === 'number' && size > 0 && size <= MAX_FILE_SIZE;
}

/**
 * Validates the total number of files
 * @param {number} fileCount - Number of files being uploaded
 * @returns {boolean} - True if file count is valid
 */
function isValidFileCount(fileCount) {
  return typeof fileCount === 'number' && fileCount > 0 && fileCount <= MAX_FILES_COUNT;
}

/**
 * Comprehensive file validation
 * @param {Object} file - Multer file object
 * @returns {Object} - Validation result with success flag and error message
 */
function validateFile(file) {
  if (!file) {
    return {
      isValid: false,
      error: 'No file provided'
    };
  }

  // Check file type
  if (!isValidFileType(file.mimetype, file.originalname)) {
    return {
      isValid: false,
      error: `Invalid file type. Only JPEG, PNG, and WebP images are allowed. Received: ${file.mimetype}`
    };
  }

  // Check file size
  if (!isValidFileSize(file.size)) {
    const sizeMB = file.size ? (file.size / (1024 * 1024)).toFixed(2) : 'unknown';
    return {
      isValid: false,
      error: `File size too large. Maximum allowed: 10MB. Received: ${sizeMB}MB`
    };
  }

  // Check for potential security issues
  const securityCheck = validateFileSecurity(file);
  if (!securityCheck.isValid) {
    return securityCheck;
  }

  return {
    isValid: true,
    error: null
  };
}

/**
 * Validates multiple files
 * @param {Array} files - Array of multer file objects
 * @returns {Object} - Validation result with details for each file
 */
function validateFiles(files) {
  if (!Array.isArray(files)) {
    return {
      isValid: false,
      error: 'Files must be provided as an array',
      fileResults: []
    };
  }

  // Check file count
  if (!isValidFileCount(files.length)) {
    return {
      isValid: false,
      error: `Invalid number of files. Maximum allowed: ${MAX_FILES_COUNT}. Received: ${files.length}`,
      fileResults: []
    };
  }

  const fileResults = [];
  let hasErrors = false;

  files.forEach((file, index) => {
    const validation = validateFile(file);
    fileResults.push({
      index,
      filename: file.originalname,
      isValid: validation.isValid,
      error: validation.error
    });

    if (!validation.isValid) {
      hasErrors = true;
    }
  });

  return {
    isValid: !hasErrors,
    error: hasErrors ? 'One or more files failed validation' : null,
    fileResults
  };
}

/**
 * Basic security validation for uploaded files
 * @param {Object} file - Multer file object
 * @returns {Object} - Security validation result
 */
function validateFileSecurity(file) {
  // Check for suspicious file names
  const suspiciousPatterns = [
    /\.\./,  // Directory traversal
    /[<>:"|?*]/,  // Invalid filename characters
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(file.originalname)) {
      return {
        isValid: false,
        error: 'File name contains invalid or potentially dangerous characters'
      };
    }
  }

  // Check for Windows reserved names (without extension)
  const basename = path.basename(file.originalname, path.extname(file.originalname));
  const reservedPattern = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
  if (reservedPattern.test(basename)) {
    return {
      isValid: false,
      error: 'File name contains invalid or potentially dangerous characters'
    };
  }

  // Check file name length
  if (file.originalname.length > 255) {
    return {
      isValid: false,
      error: 'File name is too long (maximum 255 characters)'
    };
  }

  return {
    isValid: true,
    error: null
  };
}

/**
 * Creates a sanitized filename
 * @param {string} originalname - Original filename
 * @returns {string} - Sanitized filename
 */
function sanitizeFilename(originalname) {
  // Handle special case where filename starts with . (like .jpg)
  if (originalname.startsWith('.') && !originalname.includes('/', 1)) {
    // This is likely a hidden file or extension-only file
    const possibleExt = originalname.substring(1);
    if (ALLOWED_EXTENSIONS.includes('.' + possibleExt)) {
      return `image.${possibleExt}`;
    }
  }
  
  const extension = path.extname(originalname);
  let basename = path.basename(originalname, extension);
  
  // Handle case where basename is empty
  if (!basename || basename === '') {
    return `image${extension || '.jpg'}`;
  }
  
  // Remove or replace invalid characters, including ? and |
  const sanitized = basename
    .replace(/[^a-zA-Z0-9\-_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  
  // Ensure filename is not empty after sanitization
  const finalBasename = sanitized || 'image';
  
  return `${finalBasename}${extension}`;
}

module.exports = {
  isValidFileType,
  isValidFileSize,
  isValidFileCount,
  validateFile,
  validateFiles,
  validateFileSecurity,
  sanitizeFilename,
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE,
  MAX_FILES_COUNT
};