const fileService = require('../fileService');

describe('FileService Integration Tests', () => {
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

  describe('Complete workflow integration', () => {
    it('should handle complete file packaging workflow', async () => {
      // Step 1: Create mock images
      const mockImages = [
        {
          originalName: 'product1.jpg',
          buffer: Buffer.from('fake jpeg data for product 1'),
          mimetype: 'image/jpeg',
          size: 1024
        },
        {
          originalName: 'product2.png',
          buffer: Buffer.from('fake png data for product 2'),
          mimetype: 'image/png',
          size: 2048
        },
        {
          originalName: 'product3.webp',
          buffer: Buffer.from('fake webp data for product 3'),
          mimetype: 'image/webp',
          size: 1536
        }
      ];

      // Step 2: Validate files (simulating upload validation)
      const validation = await fileService.validateUploadSecurity(mockImages);
      expect(validation.validFiles).toHaveLength(3);
      expect(validation.errors).toHaveLength(0);

      // Step 3: Create temporary directory for processing
      const tempDir = await fileService.createTempDirectory();
      tempDirs.push(tempDir);

      // Step 4: Save individual files to temp directory
      const savedFiles = [];
      for (const image of validation.validFiles) {
        const filePath = await fileService.saveTempFile(
          image.buffer, 
          image.originalName, 
          tempDir
        );
        savedFiles.push(filePath);
      }

      expect(savedFiles).toHaveLength(3);

      // Step 5: Package originals into ZIP
      const zipBuffer = await fileService.packageOriginals(
        validation.validFiles, 
        'product-images'
      );

      expect(Buffer.isBuffer(zipBuffer)).toBe(true);
      expect(zipBuffer.length).toBeGreaterThan(0);

      // Step 6: Save ZIP to temp directory
      const zipPath = await fileService.saveTempFile(
        zipBuffer, 
        'product-images.zip', 
        tempDir
      );

      expect(zipPath).toContain('product-images.zip');

      // Step 7: Verify temp directory contents
      const dirInfo = await fileService.getTempDirInfo(tempDir);
      expect(dirInfo.exists).toBe(true);
      expect(dirInfo.fileCount).toBe(4); // 3 images + 1 zip
      expect(dirInfo.files).toContain('product1.jpg');
      expect(dirInfo.files).toContain('product2.png');
      expect(dirInfo.files).toContain('product3.webp');
      expect(dirInfo.files).toContain('product-images.zip');

      // Step 8: Cleanup (this will be done in afterEach, but we can test it here too)
      await fileService.cleanupTempFiles(tempDir);
      
      const cleanedDirInfo = await fileService.getTempDirInfo(tempDir);
      expect(cleanedDirInfo.exists).toBe(false);
    });

    it('should handle partial failures gracefully', async () => {
      // Mix of valid and invalid files
      const mixedFiles = [
        {
          originalname: 'valid.jpg',
          buffer: Buffer.from('valid image data'),
          mimetype: 'image/jpeg',
          size: 1024
        },
        {
          originalname: 'invalid.pdf',
          buffer: Buffer.from('pdf data'),
          mimetype: 'application/pdf',
          size: 2048
        },
        {
          originalname: 'toolarge.jpg',
          buffer: Buffer.from('large image data'),
          mimetype: 'image/jpeg',
          size: 15 * 1024 * 1024 // 15MB - too large
        }
      ];

      // Validation should filter out invalid files
      const validation = await fileService.validateUploadSecurity(mixedFiles);
      expect(validation.validFiles).toHaveLength(1);
      expect(validation.errors).toHaveLength(2);

      // Should still be able to package the valid file
      const zipBuffer = await fileService.packageOriginals(validation.validFiles);
      expect(Buffer.isBuffer(zipBuffer)).toBe(true);
      expect(zipBuffer.length).toBeGreaterThan(0);
    });

    it('should handle concurrent operations safely', async () => {
      // Create multiple temp directories concurrently
      const createPromises = Array(5).fill().map(() => fileService.createTempDirectory());
      const tempDirs = await Promise.all(createPromises);
      
      // All should be unique
      const uniqueDirs = new Set(tempDirs);
      expect(uniqueDirs.size).toBe(5);

      // Clean up all concurrently
      const cleanupPromises = tempDirs.map(dir => fileService.cleanupTempFiles(dir));
      await Promise.all(cleanupPromises);

      // Verify all are cleaned up
      for (const dir of tempDirs) {
        const info = await fileService.getTempDirInfo(dir);
        expect(info.exists).toBe(false);
      }
    });
  });
});