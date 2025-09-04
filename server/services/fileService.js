const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const archiver = require('archiver');
const { v4: uuidv4 } = require('uuid');

class FileService {
  constructor() {
    this.tempDirectories = new Set();
    this.cleanupInterval = null;
    this.startCleanupScheduler();
  }

  /**
   * Create a secure temporary directory for file operations
   * @returns {Promise<string>} Path to the created temporary directory
   */
  async createTempDirectory() {
    const tempDir = path.join(os.tmpdir(), 'etsy-listing-', uuidv4());
    
    try {
      await fs.mkdir(tempDir, { recursive: true, mode: 0o700 });
      this.tempDirectories.add(tempDir);
      return tempDir;
    } catch (error) {
      throw new Error(`Failed to create temporary directory: ${error.message}`);
    }
  }

  /**
   * Package original images into a ZIP archive
   * @param {Array} images - Array of image objects with buffer and filename
   * @param {string} archiveName - Name for the ZIP file (without extension)
   * @returns {Promise<Buffer>} ZIP file buffer
   */
  async packageOriginals(images, archiveName = 'original-images') {
    if (!Array.isArray(images) || images.length === 0) {
      throw new Error('Images array is required and must not be empty');
    }

    return new Promise((resolve, reject) => {
      const archive = archiver('zip', {
        zlib: { level: 6 } // Compression level (0-9)
      });

      const chunks = [];

      archive.on('data', (chunk) => {
        chunks.push(chunk);
      });

      archive.on('end', () => {
        const zipBuffer = Buffer.concat(chunks);
        resolve(zipBuffer);
      });

      archive.on('error', (error) => {
        reject(new Error(`Archive creation failed: ${error.message}`));
      });

      // Add each image to the archive
      images.forEach((image, index) => {
        if (!image.buffer || !Buffer.isBuffer(image.buffer)) {
          reject(new Error(`Invalid image buffer at index ${index}`));
          return;
        }

        const filename = image.originalName || image.filename || `image-${index + 1}.jpg`;
        archive.append(image.buffer, { name: filename });
      });

      // Finalize the archive
      archive.finalize();
    });
  }

  /**
   * Save a buffer to a temporary file
   * @param {Buffer} buffer - File buffer to save
   * @param {string} filename - Name for the file
   * @param {string} tempDir - Temporary directory path (optional)
   * @returns {Promise<string>} Path to the saved file
   */
  async saveTempFile(buffer, filename, tempDir = null) {
    if (!Buffer.isBuffer(buffer)) {
      throw new Error('Buffer is required');
    }

    if (!filename) {
      throw new Error('Filename is required');
    }

    const targetDir = tempDir || await this.createTempDirectory();
    const filePath = path.join(targetDir, filename);

    try {
      await fs.writeFile(filePath, buffer);
      return filePath;
    } catch (error) {
      throw new Error(`Failed to save temporary file: ${error.message}`);
    }
  }

  /**
   * Clean up a specific temporary directory
   * @param {string} tempDir - Path to the temporary directory
   * @returns {Promise<void>}
   */
  async cleanupTempFiles(tempDir) {
    if (!tempDir) {
      return;
    }

    try {
      const stats = await fs.stat(tempDir);
      if (stats.isDirectory()) {
        await fs.rm(tempDir, { recursive: true, force: true });
        this.tempDirectories.delete(tempDir);
      }
    } catch (error) {
      // Log error but don't throw - cleanup should be non-blocking
      console.warn(`Failed to cleanup temporary directory ${tempDir}:`, error.message);
    }
  }

  /**
   * Clean up all tracked temporary directories
   * @returns {Promise<void>}
   */
  async cleanupAllTempFiles() {
    const cleanupPromises = Array.from(this.tempDirectories).map(dir => 
      this.cleanupTempFiles(dir)
    );
    
    await Promise.allSettled(cleanupPromises);
    this.tempDirectories.clear();
  }

  /**
   * Start automatic cleanup scheduler for old temporary files
   * @private
   */
  startCleanupScheduler() {
    // Clean up every 30 minutes
    this.cleanupInterval = setInterval(async () => {
      await this.cleanupOldTempFiles();
    }, 30 * 60 * 1000);
  }

  /**
   * Clean up temporary files older than specified age
   * @param {number} maxAgeMs - Maximum age in milliseconds (default: 2 hours)
   * @returns {Promise<void>}
   * @private
   */
  async cleanupOldTempFiles(maxAgeMs = 2 * 60 * 60 * 1000) {
    const now = Date.now();
    const tempDirsToCheck = Array.from(this.tempDirectories);

    for (const tempDir of tempDirsToCheck) {
      try {
        const stats = await fs.stat(tempDir);
        const ageMs = now - stats.birthtimeMs;
        
        if (ageMs > maxAgeMs) {
          await this.cleanupTempFiles(tempDir);
        }
      } catch (error) {
        // Directory might already be deleted, remove from tracking
        this.tempDirectories.delete(tempDir);
      }
    }
  }

  /**
   * Validate upload security for files
   * @param {Array} files - Array of file objects to validate
   * @returns {Promise<Object>} Validation result with valid files and errors
   */
  async validateUploadSecurity(files) {
    const validFiles = [];
    const errors = [];
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxFileSize = 10 * 1024 * 1024; // 10MB

    for (const file of files) {
      try {
        // Check file type
        if (!allowedMimeTypes.includes(file.mimetype)) {
          errors.push({
            filename: file.originalname,
            error: `Invalid file type: ${file.mimetype}. Allowed types: ${allowedMimeTypes.join(', ')}`
          });
          continue;
        }

        // Check file size
        if (file.size > maxFileSize) {
          errors.push({
            filename: file.originalname,
            error: `File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum allowed: ${maxFileSize / 1024 / 1024}MB`
          });
          continue;
        }

        // Basic buffer validation
        if (!file.buffer || !Buffer.isBuffer(file.buffer)) {
          errors.push({
            filename: file.originalname,
            error: 'Invalid file buffer'
          });
          continue;
        }

        validFiles.push(file);
      } catch (error) {
        errors.push({
          filename: file.originalname || 'unknown',
          error: `Validation error: ${error.message}`
        });
      }
    }

    return { validFiles, errors };
  }

  /**
   * Get information about a temporary directory
   * @param {string} tempDir - Path to the temporary directory
   * @returns {Promise<Object>} Directory information
   */
  async getTempDirInfo(tempDir) {
    try {
      const stats = await fs.stat(tempDir);
      const files = await fs.readdir(tempDir);
      
      return {
        path: tempDir,
        exists: true,
        created: stats.birthtime,
        fileCount: files.length,
        files: files
      };
    } catch (error) {
      return {
        path: tempDir,
        exists: false,
        error: error.message
      };
    }
  }

  /**
   * Cleanup resources and stop scheduler
   */
  async destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    await this.cleanupAllTempFiles();
  }
}

// Create singleton instance
const fileService = new FileService();

// Graceful shutdown cleanup
process.on('SIGINT', async () => {
  await fileService.destroy();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await fileService.destroy();
  process.exit(0);
});

module.exports = fileService;