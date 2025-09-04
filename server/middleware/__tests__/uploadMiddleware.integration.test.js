/**
 * Simple integration tests for upload middleware
 */

const {
  createUploadMiddleware,
  handleUploadErrors,
  processUploadedFiles,
  validateUploadRequest
} = require('../uploadMiddleware');

const { validateFile } = require('../../utils/fileValidation');

describe('Upload Middleware Integration', () => {
  describe('validateFile integration', () => {
    test('should validate a proper image file object', () => {
      const mockFile = {
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
        size: 1024 * 1024, // 1MB
        buffer: Buffer.from('fake-image-data')
      };

      const result = validateFile(mockFile);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    test('should reject invalid file type', () => {
      const mockFile = {
        originalname: 'test.txt',
        mimetype: 'text/plain',
        size: 1024,
        buffer: Buffer.from('text-data')
      };

      const result = validateFile(mockFile);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid file type');
    });

    test('should reject oversized file', () => {
      const mockFile = {
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
        size: 11 * 1024 * 1024, // 11MB
        buffer: Buffer.alloc(11 * 1024 * 1024)
      };

      const result = validateFile(mockFile);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('File size too large');
    });
  });

  describe('middleware function creation', () => {
    test('should create upload middleware function', () => {
      const middleware = createUploadMiddleware('images', 5);
      expect(typeof middleware).toBe('function');
      expect(middleware.name).toBe('multerMiddleware');
    });

    test('should create error handler function', () => {
      expect(typeof handleUploadErrors).toBe('function');
      expect(handleUploadErrors.length).toBe(4); // error, req, res, next
    });

    test('should create file processor function', () => {
      expect(typeof processUploadedFiles).toBe('function');
      expect(processUploadedFiles.length).toBe(3); // req, res, next
    });

    test('should create request validator function', () => {
      expect(typeof validateUploadRequest).toBe('function');
      expect(validateUploadRequest.length).toBe(3); // req, res, next
    });
  });

  describe('processUploadedFiles functionality', () => {
    test('should process mock uploaded files', () => {
      const mockReq = {
        files: [
          {
            originalname: 'test1.jpg',
            mimetype: 'image/jpeg',
            size: 1024,
            buffer: Buffer.from('test')
          },
          {
            originalname: 'test2.png',
            mimetype: 'image/png',
            size: 2048,
            buffer: Buffer.from('test2')
          }
        ]
      };

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      const mockNext = jest.fn();

      processUploadedFiles(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.files).toHaveLength(2);
      expect(mockReq.files[0]).toHaveProperty('id');
      expect(mockReq.files[0]).toHaveProperty('sanitizedName');
      expect(mockReq.files[0]).toHaveProperty('uploadedAt');
      expect(mockReq.uploadSummary).toBeDefined();
      expect(mockReq.uploadSummary.totalFiles).toBe(2);
      expect(mockReq.uploadSummary.totalSize).toBe(3072);
    });

    test('should handle no files uploaded', () => {
      const mockReq = {
        files: []
      };

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      const mockNext = jest.fn();

      processUploadedFiles(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'No files uploaded'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('handleUploadErrors functionality', () => {
    test('should handle multer LIMIT_FILE_SIZE error', () => {
      const mockError = new Error('File too large');
      mockError.code = 'LIMIT_FILE_SIZE';
      // Mock multer.MulterError
      Object.setPrototypeOf(mockError, Error.prototype);
      mockError.constructor = { name: 'MulterError' };

      const mockReq = {};
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();

      handleUploadErrors(mockError, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: expect.stringContaining('File too large'),
        code: 'LIMIT_FILE_SIZE'
      });
    });

    test('should handle custom validation errors', () => {
      const mockError = new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed');

      const mockReq = {};
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();

      handleUploadErrors(mockError, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid file type. Only JPEG, PNG, and WebP images are allowed'
      });
    });

    test('should pass through other errors', () => {
      const mockError = new Error('Some other error');

      const mockReq = {};
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();

      // Mock console.error to avoid output during tests
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      handleUploadErrors(mockError, mockReq, mockRes, mockNext);

      expect(consoleSpy).toHaveBeenCalledWith('Upload error:', mockError);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error during file upload'
      });

      consoleSpy.mockRestore();
    });

    test('should handle no error case', () => {
      const mockReq = {};
      const mockRes = {};
      const mockNext = jest.fn();

      handleUploadErrors(null, mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });
});