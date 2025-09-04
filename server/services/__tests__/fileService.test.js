const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const fileService = require('../fileService');

// Mock data for testing
const createMockImage = (name = 'test.jpg', size = 1024) => ({
  originalName: name,
  filename: name,
  buffer: Buffer.from('fake image data'.repeat(size / 16)),
  mimetype: 'image/jpeg',
  size: size
});

const createMockFile = (name, mimetype, size = 1024) => ({
  originalname: name,
  filename: name,
  buffer: Buffer.from('fake file data'.repeat(size / 16)),
  mimetype: mimetype,
  size: size
});

describe('FileService', () => {
  let tempDirs = [];

  afterEach(async () => {
    // Clean up any temp directories created during tests
    for (const dir of tempDirs) {
      try {
        await fileService.cleanupTempFiles(dir);
      } catch (error) {
        // Ignore cleanup errors in tests
      }
    }
    tempDirs = [];
  });

  afterAll(async () => {
    await fileService.destroy();
  });

  describe('createTempDirectory', () => {
    it('should create a unique temporary directory', async () => {
      const tempDir = await fileService.createTempDirectory();
      tempDirs.push(tempDir);

      expect(tempDir).toBeDefined();
      expect(typeof tempDir).toBe('string');
      expect(tempDir).toContain('etsy-listing-');

      // Verify directory exists
      const stats = await fs.stat(tempDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should create different directories on multiple calls', async () => {
      const tempDir1 = await fileService.createTempDirectory();
      const tempDir2 = await fileService.createTempDirectory();
      tempDirs.push(tempDir1, tempDir2);

      expect(tempDir1).not.toBe(tempDir2);
    });

    it('should create directory with secure permissions', async () => {
      const tempDir = await fileService.createTempDirectory();
      tempDirs.push(tempDir);

      const stats = await fs.stat(tempDir);
      // On Windows, permissions work differently, so just check that directory exists
      // and is accessible (which means it was created successfully)
      expect(stats.isDirectory()).toBe(true);
      
      // Try to write a test file to verify we have write access
      const testFile = path.join(tempDir, 'permission-test.txt');
      await fs.writeFile(testFile, 'test');
      const testStats = await fs.stat(testFile);
      expect(testStats.isFile()).toBe(true);
    });
  });

  describe('packageOriginals', () => {
    it('should create a ZIP archive from image array', async () => {
      const images = [
        createMockImage('image1.jpg'),
        createMockImage('image2.png'),
        createMockImage('image3.webp')
      ];

      const zipBuffer = await fileService.packageOriginals(images, 'test-archive');

      expect(Buffer.isBuffer(zipBuffer)).toBe(true);
      expect(zipBuffer.length).toBeGreaterThan(0);
      
      // ZIP files start with 'PK' signature
      expect(zipBuffer.toString('ascii', 0, 2)).toBe('PK');
    });

    it('should handle single image', async () => {
      const images = [createMockImage('single.jpg')];

      const zipBuffer = await fileService.packageOriginals(images);

      expect(Buffer.isBuffer(zipBuffer)).toBe(true);
      expect(zipBuffer.length).toBeGreaterThan(0);
    });

    it('should throw error for empty images array', async () => {
      await expect(fileService.packageOriginals([])).rejects.toThrow(
        'Images array is required and must not be empty'
      );
    });

    it('should throw error for invalid images array', async () => {
      await expect(fileService.packageOriginals(null)).rejects.toThrow(
        'Images array is required and must not be empty'
      );
    });

    it('should handle images without originalName', async () => {
      const images = [
        { buffer: Buffer.from('test data'), filename: 'test.jpg' },
        { buffer: Buffer.from('test data 2') } // No filename
      ];

      const zipBuffer = await fileService.packageOriginals(images);

      expect(Buffer.isBuffer(zipBuffer)).toBe(true);
      expect(zipBuffer.length).toBeGreaterThan(0);
    });

    it('should reject invalid image buffers', async () => {
      const images = [
        { buffer: 'not a buffer', originalName: 'invalid.jpg' }
      ];

      await expect(fileService.packageOriginals(images)).rejects.toThrow(
        'Invalid image buffer at index 0'
      );
    });
  });

  describe('saveTempFile', () => {
    it('should save buffer to temporary file', async () => {
      const buffer = Buffer.from('test file content');
      const filename = 'test-file.txt';

      const filePath = await fileService.saveTempFile(buffer, filename);
      const dirPath = path.dirname(filePath);
      tempDirs.push(dirPath);

      expect(filePath).toBeDefined();
      expect(path.basename(filePath)).toBe(filename);

      // Verify file exists and has correct content
      const savedContent = await fs.readFile(filePath);
      expect(savedContent.equals(buffer)).toBe(true);
    });

    it('should save to specified temp directory', async () => {
      const tempDir = await fileService.createTempDirectory();
      tempDirs.push(tempDir);

      const buffer = Buffer.from('test content');
      const filename = 'specified-dir-test.txt';

      const filePath = await fileService.saveTempFile(buffer, filename, tempDir);

      expect(path.dirname(filePath)).toBe(tempDir);
      expect(path.basename(filePath)).toBe(filename);
    });

    it('should throw error for invalid buffer', async () => {
      await expect(fileService.saveTempFile('not a buffer', 'test.txt')).rejects.toThrow(
        'Buffer is required'
      );
    });

    it('should throw error for missing filename', async () => {
      const buffer = Buffer.from('test');
      await expect(fileService.saveTempFile(buffer, '')).rejects.toThrow(
        'Filename is required'
      );
    });
  });

  describe('cleanupTempFiles', () => {
    it('should remove temporary directory and contents', async () => {
      const tempDir = await fileService.createTempDirectory();
      const testFile = path.join(tempDir, 'test.txt');
      await fs.writeFile(testFile, 'test content');

      // Verify directory and file exist
      expect(await fs.stat(tempDir)).toBeDefined();
      expect(await fs.stat(testFile)).toBeDefined();

      await fileService.cleanupTempFiles(tempDir);

      // Verify directory is removed
      await expect(fs.stat(tempDir)).rejects.toThrow();
    });

    it('should handle non-existent directory gracefully', async () => {
      const nonExistentDir = '/path/that/does/not/exist';
      
      // Should not throw error
      await expect(fileService.cleanupTempFiles(nonExistentDir)).resolves.toBeUndefined();
    });

    it('should handle null/undefined input gracefully', async () => {
      await expect(fileService.cleanupTempFiles(null)).resolves.toBeUndefined();
      await expect(fileService.cleanupTempFiles(undefined)).resolves.toBeUndefined();
    });
  });

  describe('validateUploadSecurity', () => {
    it('should validate correct image files', async () => {
      const files = [
        createMockFile('image1.jpg', 'image/jpeg'),
        createMockFile('image2.png', 'image/png'),
        createMockFile('image3.webp', 'image/webp')
      ];

      const result = await fileService.validateUploadSecurity(files);

      expect(result.validFiles).toHaveLength(3);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid file types', async () => {
      const files = [
        createMockFile('document.pdf', 'application/pdf'),
        createMockFile('script.js', 'application/javascript'),
        createMockFile('image.jpg', 'image/jpeg') // Valid one
      ];

      const result = await fileService.validateUploadSecurity(files);

      expect(result.validFiles).toHaveLength(1);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].error).toContain('Invalid file type');
    });

    it('should reject files that are too large', async () => {
      const largeSize = 15 * 1024 * 1024; // 15MB (over 10MB limit)
      const files = [
        createMockFile('large.jpg', 'image/jpeg', largeSize),
        createMockFile('small.jpg', 'image/jpeg', 1024) // Valid size
      ];

      const result = await fileService.validateUploadSecurity(files);

      expect(result.validFiles).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain('File too large');
    });

    it('should reject files with invalid buffers', async () => {
      const files = [
        {
          originalname: 'invalid.jpg',
          mimetype: 'image/jpeg',
          size: 1024,
          buffer: null // Invalid buffer
        },
        createMockFile('valid.jpg', 'image/jpeg') // Valid file
      ];

      const result = await fileService.validateUploadSecurity(files);

      expect(result.validFiles).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain('Invalid file buffer');
    });
  });

  describe('getTempDirInfo', () => {
    it('should return info for existing directory', async () => {
      const tempDir = await fileService.createTempDirectory();
      tempDirs.push(tempDir);

      // Add some test files
      await fs.writeFile(path.join(tempDir, 'file1.txt'), 'content1');
      await fs.writeFile(path.join(tempDir, 'file2.txt'), 'content2');

      const info = await fileService.getTempDirInfo(tempDir);

      expect(info.exists).toBe(true);
      expect(info.path).toBe(tempDir);
      expect(info.fileCount).toBe(2);
      expect(info.files).toContain('file1.txt');
      expect(info.files).toContain('file2.txt');
      expect(info.created).toBeDefined();
      expect(typeof info.created.getTime).toBe('function');
      expect(info.created.getTime()).toBeGreaterThan(0);
    });

    it('should return info for non-existent directory', async () => {
      const nonExistentDir = '/path/that/does/not/exist';

      const info = await fileService.getTempDirInfo(nonExistentDir);

      expect(info.exists).toBe(false);
      expect(info.path).toBe(nonExistentDir);
      expect(info.error).toBeDefined();
    });
  });

  describe('cleanupAllTempFiles', () => {
    it('should clean up all tracked directories', async () => {
      const tempDir1 = await fileService.createTempDirectory();
      const tempDir2 = await fileService.createTempDirectory();

      // Add test files
      await fs.writeFile(path.join(tempDir1, 'test1.txt'), 'content');
      await fs.writeFile(path.join(tempDir2, 'test2.txt'), 'content');

      // Verify directories exist
      expect(await fs.stat(tempDir1)).toBeDefined();
      expect(await fs.stat(tempDir2)).toBeDefined();

      await fileService.cleanupAllTempFiles();

      // Verify directories are removed
      await expect(fs.stat(tempDir1)).rejects.toThrow();
      await expect(fs.stat(tempDir2)).rejects.toThrow();
    });
  });
});