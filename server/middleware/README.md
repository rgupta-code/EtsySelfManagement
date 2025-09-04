# Upload Middleware

This module provides secure file upload middleware for handling image uploads with validation and security measures.

## Features

- **File Type Validation**: Only allows JPEG, PNG, and WebP images
- **File Size Limits**: Maximum 10MB per file
- **File Count Limits**: Maximum 20 files per upload
- **Security Validation**: Prevents directory traversal and malicious filenames
- **Filename Sanitization**: Automatically sanitizes uploaded filenames
- **Error Handling**: Comprehensive error handling with proper HTTP status codes
- **Metadata Addition**: Adds unique IDs, timestamps, and sanitized names to files

## Usage

### Basic Multiple File Upload

```javascript
const express = require('express');
const { createUploadMiddleware, processUploadedFiles, handleUploadErrors } = require('./middleware/uploadMiddleware');

const app = express();

// Create upload route
app.post('/upload', 
  createUploadMiddleware('images', 10), // Field name: 'images', max 10 files
  processUploadedFiles,
  (req, res) => {
    res.json({
      success: true,
      files: req.files,
      summary: req.uploadSummary
    });
  }
);

// Add error handler
app.use(handleUploadErrors);
```

### Single File Upload

```javascript
const { createSingleUploadMiddleware } = require('./middleware/uploadMiddleware');

app.post('/upload-single',
  createSingleUploadMiddleware('image'), // Field name: 'image'
  (req, res) => {
    res.json({
      success: true,
      file: req.file
    });
  }
);
```

### Complete Middleware Chain

```javascript
const { createCompleteUploadMiddleware } = require('./middleware/uploadMiddleware');

// This includes validation, upload, processing, and error handling
app.post('/upload-complete', 
  ...createCompleteUploadMiddleware('images', 5),
  (req, res) => {
    res.json({
      success: true,
      files: req.files,
      summary: req.uploadSummary
    });
  }
);
```

## File Object Structure

After processing, each file object will have the following structure:

```javascript
{
  // Original multer properties
  originalname: 'user-uploaded-name.jpg',
  mimetype: 'image/jpeg',
  size: 1024000,
  buffer: Buffer,
  
  // Added by processUploadedFiles
  id: 'unique-hex-id',
  sanitizedName: 'user_uploaded_name.jpg',
  uploadedAt: '2023-12-01T10:30:00.000Z',
  index: 0
}
```

## Upload Summary

The `req.uploadSummary` object contains:

```javascript
{
  totalFiles: 3,
  totalSize: 3072000,
  fileTypes: ['image/jpeg', 'image/png'],
  uploadedAt: '2023-12-01T10:30:00.000Z'
}
```

## Error Responses

The middleware returns standardized error responses:

```javascript
// File too large
{
  success: false,
  error: "File too large. Maximum size allowed: 10MB",
  code: "LIMIT_FILE_SIZE"
}

// Invalid file type
{
  success: false,
  error: "Invalid file type. Only JPEG, PNG, and WebP images are allowed. Received: image/gif"
}

// Too many files
{
  success: false,
  error: "Too many files. Maximum allowed: 20",
  code: "LIMIT_FILE_COUNT"
}
```

## Configuration

You can modify the limits by updating the constants in `utils/fileValidation.js`:

```javascript
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES_COUNT = 20; // Maximum files per upload
```