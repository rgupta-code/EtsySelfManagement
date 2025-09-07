const sharp = require('sharp');
const path = require('path');

/**
 * Image Processing Service
 * Handles image processing operations including watermarking, resizing, and optimization
 */
class ImageService {
  constructor() {
    this.supportedFormats = ['jpeg', 'jpg', 'png', 'webp'];
    this.maxFileSize = 10 * 1024 * 1024; // 10MB
  }

  /**
   * Validates image files for type and size
   * @param {Array} files - Array of file objects with buffer, mimetype, size properties
   * @returns {Object} - Validation result with valid files and errors
   */
  validateImageFiles(files) {
    const validFiles = [];
    const errors = [];

    files.forEach((file, index) => {
      // Check file size
      if (file.size > this.maxFileSize) {
        errors.push({
          index,
          filename: file.originalname || `file-${index}`,
          error: `File size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds maximum allowed size of 10MB`
        });
        return;
      }

      // Check file type
      const mimeType = file.mimetype.toLowerCase();
      const isValidType = this.supportedFormats.some(format => 
        mimeType.includes(format) || mimeType === `image/${format}`
      );

      if (!isValidType) {
        errors.push({
          index,
          filename: file.originalname || `file-${index}`,
          error: `Unsupported file type: ${file.mimetype}. Supported types: JPEG, PNG, WebP`
        });
        return;
      }

      validFiles.push(file);
    });

    return { validFiles, errors };
  }

  /**
   * Applies watermark to an image
   * @param {Buffer} imageBuffer - Input image buffer
   * @param {Object} watermarkConfig - Watermark configuration
   * @returns {Promise<Buffer>} - Watermarked image buffer
   */
  async watermarkImage(imageBuffer, watermarkConfig = {}) {
    try {
      const {
        text = 'Watermark',
        position = 'bottom-right',
        opacity = 0.7,
        fontSize = 24,
        color = 'white'
      } = watermarkConfig;

      // Get image metadata to calculate positioning
      const image = sharp(imageBuffer);
      const metadata = await image.metadata();
      const { width, height } = metadata;

      // Calculate text positioning based on position parameter
      const positions = this._calculateWatermarkPosition(position, width, height, fontSize);

      // Create SVG watermark
      const svgWatermark = this._createSvgWatermark(text, fontSize, color, opacity, positions);

      // Apply watermark and return processed image
      const watermarkedBuffer = await image
        .composite([{
          input: Buffer.from(svgWatermark),
          gravity: 'northwest'
        }])
        .jpeg({ quality: 90 }) // Maintain high quality
        .toBuffer();

      return watermarkedBuffer;
    } catch (error) {
      throw new Error(`Watermarking failed: ${error.message}`);
    }
  }

  /**
   * Applies watermarks to multiple images
   * @param {Array} images - Array of image objects with buffer property
   * @param {Object} watermarkConfig - Watermark configuration
   * @returns {Promise<Array>} - Array of watermarked image objects
   */
  async watermarkImages(images, watermarkConfig = {}) {
    const watermarkedImages = [];
    const errors = [];

    for (let i = 0; i < images.length; i++) {
      try {
        const image = images[i];
        const watermarkedBuffer = await this.watermarkImage(image.buffer, watermarkConfig);
        
        watermarkedImages.push({
          ...image,
          buffer: watermarkedBuffer,
          watermarked: true,
          originalSize: image.buffer.length,
          processedSize: watermarkedBuffer.length
        });
        console.log('***********watermarked image successfully***********');
      } catch (error) {
        errors.push({
          index: i,
          filename: images[i].originalname || `image-${i}`,
          error: error.message
        });
        
        // Continue processing other images even if one fails
        console.error(`Failed to watermark image ${i}:`, error.message);
      }
    }

    return { watermarkedImages, errors };
  }

  /**
   * Optimizes image for web use
   * @param {Buffer} imageBuffer - Input image buffer
   * @param {Object} options - Optimization options
   * @returns {Promise<Buffer>} - Optimized image buffer
   */
  async optimizeForWeb(imageBuffer, options = {}) {
    try {
      const {
        quality = 85,
        maxWidth = 2000,
        maxHeight = 2000,
        format = 'jpeg'
      } = options;

      const image = sharp(imageBuffer);
      const metadata = await image.metadata();

      // Resize if image is larger than max dimensions
      let processedImage = image;
      if (metadata.width > maxWidth || metadata.height > maxHeight) {
        processedImage = image.resize(maxWidth, maxHeight, {
          fit: 'inside',
          withoutEnlargement: true
        });
      }

      // Apply format-specific optimization
      let optimizedBuffer;
      switch (format.toLowerCase()) {
        case 'png':
          optimizedBuffer = await processedImage
            .png({ quality, compressionLevel: 9 })
            .toBuffer();
          break;
        case 'webp':
          optimizedBuffer = await processedImage
            .webp({ quality })
            .toBuffer();
          break;
        default: // jpeg
          optimizedBuffer = await processedImage
            .jpeg({ quality, progressive: true })
            .toBuffer();
      }

      return optimizedBuffer;
    } catch (error) {
      throw new Error(`Image optimization failed: ${error.message}`);
    }
  }

  /**
   * Creates a collage from multiple images
   * @param {Array} images - Array of image objects with buffer property
   * @param {Object} options - Collage configuration options
   * @returns {Promise<Buffer>} - Collage image buffer
   */
  async createCollage(images, options = {}) {
    try {
      if (!images || images.length < 2) {
        throw new Error('At least 2 images are required to create a collage');
      }

      const {
        width = 2000,
        height = 2000,
        spacing = 10,
        backgroundColor = { r: 255, g: 255, b: 255 },
        layout = 'auto'
      } = options;

      // Calculate optimal grid layout
      const gridLayout = this._calculateGridLayout(images.length, layout);
      const { rows, cols } = gridLayout;

      // Calculate cell dimensions
      const cellWidth = Math.floor((width - (spacing * (cols + 1))) / cols);
      const cellHeight = Math.floor((height - (spacing * (rows + 1))) / rows);

      // Prepare images for compositing
      const processedImages = await this._prepareImagesForCollage(
        images, 
        cellWidth, 
        cellHeight
      );

      // Create composite operations array
      const compositeOps = [];
      let imageIndex = 0;

      for (let row = 0; row < rows && imageIndex < processedImages.length; row++) {
        for (let col = 0; col < cols && imageIndex < processedImages.length; col++) {
          const x = spacing + (col * (cellWidth + spacing));
          const y = spacing + (row * (cellHeight + spacing));

          compositeOps.push({
            input: processedImages[imageIndex],
            left: x,
            top: y
          });

          imageIndex++;
        }
      }

      // Create the collage
      const collageBuffer = await sharp({
        create: {
          width,
          height,
          channels: 3,
          background: backgroundColor
        }
      })
      .composite(compositeOps)
      .jpeg({ quality: 90, progressive: true })
      .toBuffer();

      return collageBuffer;
    } catch (error) {
      throw new Error(`Collage creation failed: ${error.message}`);
    }
  }

  /**
   * Gets image dimensions and metadata
   * @param {Buffer} imageBuffer - Input image buffer
   * @returns {Promise<Object>} - Image metadata
   */
  async getImageMetadata(imageBuffer) {
    try {
      const metadata = await sharp(imageBuffer).metadata();
      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: metadata.size,
        hasAlpha: metadata.hasAlpha,
        channels: metadata.channels
      };
    } catch (error) {
      throw new Error(`Failed to get image metadata: ${error.message}`);
    }
  }

  /**
   * Calculates watermark position coordinates
   * @private
   */
  _calculateWatermarkPosition(position, imageWidth, imageHeight, fontSize) {
    const padding = fontSize;
    
    switch (position) {
      case 'top-left':
        return { x: padding, y: padding };
      case 'top-right':
        return { x: imageWidth - (fontSize * 8) - padding, y: padding };
      case 'bottom-left':
        return { x: padding, y: imageHeight - fontSize - padding };
      case 'bottom-right':
        return { x: imageWidth - (fontSize * 8) - padding, y: imageHeight - fontSize - padding };
      case 'center':
        return { x: imageWidth / 2 - (fontSize * 4), y: imageHeight / 2 };
      default:
        return { x: imageWidth - (fontSize * 8) - padding, y: imageHeight - fontSize - padding };
    }
  }

  /**
   * Creates SVG watermark text
   * @private
   */
  _createSvgWatermark(text, fontSize, color, opacity, positions) {
    return `
      <svg width="100%" height="100%">
        <text 
          x="${positions.x}" 
          y="${positions.y}" 
          font-family="Arial, sans-serif" 
          font-size="${fontSize}" 
          fill="${color}" 
          opacity="${opacity}"
          font-weight="bold"
        >${text}</text>
      </svg>
    `;
  }

  /**
   * Calculates optimal grid layout for collage
   * @private
   * @param {number} imageCount - Number of images to arrange
   * @param {string} layoutType - Layout preference ('auto', 'square', 'horizontal', 'vertical')
   * @returns {Object} - Grid layout with rows and cols
   */
  _calculateGridLayout(imageCount, layoutType = 'auto') {
    if (imageCount === 1) {
      return { rows: 1, cols: 1 };
    }

    switch (layoutType) {
      case 'horizontal':
        return { rows: 1, cols: imageCount };
      
      case 'vertical':
        return { rows: imageCount, cols: 1 };
      
      case 'square':
      case 'auto':
      default:
        // Calculate the most square-like arrangement
        const sqrt = Math.sqrt(imageCount);
        const cols = Math.ceil(sqrt);
        const rows = Math.ceil(imageCount / cols);
        return { rows, cols };
    }
  }

  /**
   * Prepares images for collage by resizing and cropping to fit cells
   * @private
   * @param {Array} images - Array of image objects with buffer property
   * @param {number} cellWidth - Target cell width
   * @param {number} cellHeight - Target cell height
   * @returns {Promise<Array>} - Array of processed image buffers
   */
  async _prepareImagesForCollage(images, cellWidth, cellHeight) {
    const processedImages = [];

    for (const image of images) {
      try {
        // Resize and crop image to fit cell dimensions
        const processedBuffer = await sharp(image.buffer)
          .resize(cellWidth, cellHeight, {
            fit: 'cover', // Crop to fill the entire cell
            position: 'center'
          })
          .jpeg({ quality: 85 })
          .toBuffer();

        processedImages.push(processedBuffer);
      } catch (error) {
        console.error(`Failed to process image for collage: ${error.message}`);
        
        // Create a placeholder image if processing fails
        const placeholderBuffer = await sharp({
          create: {
            width: cellWidth,
            height: cellHeight,
            channels: 3,
            background: { r: 200, g: 200, b: 200 }
          }
        })
        .jpeg()
        .toBuffer();

        processedImages.push(placeholderBuffer);
      }
    }

    return processedImages;
  }
}

module.exports = ImageService;