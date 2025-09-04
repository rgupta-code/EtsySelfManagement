const ImageService = require('./imageService');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

describe('ImageService', () => {
  let imageService;
  let testImageBuffer;
  let testImageSmall;

  beforeAll(async () => {
    imageService = new ImageService();
    
    // Create test images using Sharp
    testImageBuffer = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 255, g: 0, b: 0 }
      }
    })
    .jpeg()
    .toBuffer();

    testImageSmall = await sharp({
      create: {
        width: 200,
        height: 150,
        channels: 3,
        background: { r: 0, g: 255, b: 0 }
      }
    })
    .png()
    .toBuffer();
  });

  describe('validateImageFiles', () => {
    it('should validate correct image files', () => {
      const files = [
        {
          originalname: 'test1.jpg',
          mimetype: 'image/jpeg',
          size: 1024 * 1024, // 1MB
          buffer: testImageBuffer
        },
        {
          originalname: 'test2.png',
          mimetype: 'image/png',
          size: 2 * 1024 * 1024, // 2MB
          buffer: testImageSmall
        }
      ];

      const result = imageService.validateImageFiles(files);
      
      expect(result.validFiles).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject files that are too large', () => {
      const files = [
        {
          originalname: 'large.jpg',
          mimetype: 'image/jpeg',
          size: 15 * 1024 * 1024, // 15MB - exceeds 10MB limit
          buffer: testImageBuffer
        }
      ];

      const result = imageService.validateImageFiles(files);
      
      expect(result.validFiles).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain('exceeds maximum allowed size');
    });

    it('should reject unsupported file types', () => {
      const files = [
        {
          originalname: 'document.pdf',
          mimetype: 'application/pdf',
          size: 1024,
          buffer: Buffer.from('fake pdf content')
        },
        {
          originalname: 'video.mp4',
          mimetype: 'video/mp4',
          size: 1024,
          buffer: Buffer.from('fake video content')
        }
      ];

      const result = imageService.validateImageFiles(files);
      
      expect(result.validFiles).toHaveLength(0);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].error).toContain('Unsupported file type');
      expect(result.errors[1].error).toContain('Unsupported file type');
    });

    it('should handle mixed valid and invalid files', () => {
      const files = [
        {
          originalname: 'valid.jpg',
          mimetype: 'image/jpeg',
          size: 1024 * 1024,
          buffer: testImageBuffer
        },
        {
          originalname: 'invalid.txt',
          mimetype: 'text/plain',
          size: 1024,
          buffer: Buffer.from('text content')
        },
        {
          originalname: 'toolarge.png',
          mimetype: 'image/png',
          size: 12 * 1024 * 1024, // 12MB
          buffer: testImageSmall
        }
      ];

      const result = imageService.validateImageFiles(files);
      
      expect(result.validFiles).toHaveLength(1);
      expect(result.errors).toHaveLength(2);
    });
  });

  describe('watermarkImage', () => {
    it('should apply watermark with default settings', async () => {
      const watermarkedBuffer = await imageService.watermarkImage(testImageBuffer);
      
      expect(watermarkedBuffer).toBeInstanceOf(Buffer);
      expect(watermarkedBuffer.length).toBeGreaterThan(0);
      
      // Verify the watermarked image is still a valid image
      const metadata = await sharp(watermarkedBuffer).metadata();
      expect(metadata.format).toBe('jpeg');
    });

    it('should apply watermark with custom text', async () => {
      const config = {
        text: 'Custom Watermark',
        position: 'center',
        opacity: 0.5
      };

      const watermarkedBuffer = await imageService.watermarkImage(testImageBuffer, config);
      
      expect(watermarkedBuffer).toBeInstanceOf(Buffer);
      
      // Verify image is still valid
      const metadata = await sharp(watermarkedBuffer).metadata();
      expect(metadata.format).toBe('jpeg');
    });

    it('should handle different watermark positions', async () => {
      const positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'];
      
      for (const position of positions) {
        const config = { position, text: 'Test' };
        const watermarkedBuffer = await imageService.watermarkImage(testImageBuffer, config);
        
        expect(watermarkedBuffer).toBeInstanceOf(Buffer);
        
        // Verify image is still valid
        const metadata = await sharp(watermarkedBuffer).metadata();
        expect(metadata.format).toBe('jpeg');
      }
    });

    it('should handle different opacity levels', async () => {
      const opacities = [0.1, 0.3, 0.5, 0.7, 1.0];
      
      for (const opacity of opacities) {
        const config = { opacity, text: 'Opacity Test' };
        const watermarkedBuffer = await imageService.watermarkImage(testImageBuffer, config);
        
        expect(watermarkedBuffer).toBeInstanceOf(Buffer);
        
        // Verify image is still valid
        const metadata = await sharp(watermarkedBuffer).metadata();
        expect(metadata.format).toBe('jpeg');
      }
    });

    it('should handle different font sizes', async () => {
      const fontSizes = [12, 18, 24, 36, 48];
      
      for (const fontSize of fontSizes) {
        const config = { fontSize, text: 'Size Test' };
        const watermarkedBuffer = await imageService.watermarkImage(testImageBuffer, config);
        
        expect(watermarkedBuffer).toBeInstanceOf(Buffer);
        
        // Verify image is still valid
        const metadata = await sharp(watermarkedBuffer).metadata();
        expect(metadata.format).toBe('jpeg');
      }
    });

    it('should throw error for invalid image buffer', async () => {
      const invalidBuffer = Buffer.from('not an image');
      
      await expect(imageService.watermarkImage(invalidBuffer))
        .rejects
        .toThrow('Watermarking failed');
    });
  });

  describe('watermarkImages', () => {
    it('should watermark multiple images successfully', async () => {
      const images = [
        {
          originalname: 'image1.jpg',
          buffer: testImageBuffer
        },
        {
          originalname: 'image2.png',
          buffer: testImageSmall
        }
      ];

      const config = {
        text: 'Batch Watermark',
        position: 'bottom-right',
        opacity: 0.7
      };

      const result = await imageService.watermarkImages(images, config);
      
      expect(result.watermarkedImages).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
      
      // Verify each watermarked image
      for (const watermarkedImage of result.watermarkedImages) {
        expect(watermarkedImage.buffer).toBeInstanceOf(Buffer);
        expect(watermarkedImage.watermarked).toBe(true);
        expect(watermarkedImage.originalSize).toBeGreaterThan(0);
        expect(watermarkedImage.processedSize).toBeGreaterThan(0);
        
        // Verify image is still valid
        const metadata = await sharp(watermarkedImage.buffer).metadata();
        expect(['jpeg', 'png']).toContain(metadata.format);
      }
    });

    it('should handle errors gracefully and continue processing', async () => {
      const images = [
        {
          originalname: 'valid.jpg',
          buffer: testImageBuffer
        },
        {
          originalname: 'invalid.jpg',
          buffer: Buffer.from('invalid image data')
        },
        {
          originalname: 'valid2.png',
          buffer: testImageSmall
        }
      ];

      const result = await imageService.watermarkImages(images);
      
      expect(result.watermarkedImages).toHaveLength(2); // 2 valid images processed
      expect(result.errors).toHaveLength(1); // 1 error for invalid image
      expect(result.errors[0].filename).toBe('invalid.jpg');
    });

    it('should handle empty image array', async () => {
      const result = await imageService.watermarkImages([]);
      
      expect(result.watermarkedImages).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('optimizeForWeb', () => {
    it('should optimize image with default settings', async () => {
      const optimizedBuffer = await imageService.optimizeForWeb(testImageBuffer);
      
      expect(optimizedBuffer).toBeInstanceOf(Buffer);
      
      const metadata = await sharp(optimizedBuffer).metadata();
      expect(metadata.format).toBe('jpeg');
    });

    it('should resize large images', async () => {
      // Create a large test image
      const largeImageBuffer = await sharp({
        create: {
          width: 3000,
          height: 2500,
          channels: 3,
          background: { r: 100, g: 150, b: 200 }
        }
      })
      .jpeg()
      .toBuffer();

      const optimizedBuffer = await imageService.optimizeForWeb(largeImageBuffer, {
        maxWidth: 1500,
        maxHeight: 1500
      });
      
      const metadata = await sharp(optimizedBuffer).metadata();
      expect(metadata.width).toBeLessThanOrEqual(1500);
      expect(metadata.height).toBeLessThanOrEqual(1500);
    });

    it('should handle different output formats', async () => {
      const formats = ['jpeg', 'png', 'webp'];
      
      for (const format of formats) {
        const optimizedBuffer = await imageService.optimizeForWeb(testImageBuffer, { format });
        
        const metadata = await sharp(optimizedBuffer).metadata();
        expect(metadata.format).toBe(format);
      }
    });

    it('should apply quality settings', async () => {
      const highQuality = await imageService.optimizeForWeb(testImageBuffer, { quality: 95 });
      const lowQuality = await imageService.optimizeForWeb(testImageBuffer, { quality: 30 });
      
      // Low quality should result in smaller file size
      expect(lowQuality.length).toBeLessThan(highQuality.length);
    });

    it('should throw error for invalid image buffer', async () => {
      const invalidBuffer = Buffer.from('not an image');
      
      await expect(imageService.optimizeForWeb(invalidBuffer))
        .rejects
        .toThrow('Image optimization failed');
    });
  });

  describe('getImageMetadata', () => {
    it('should return correct metadata for JPEG image', async () => {
      const metadata = await imageService.getImageMetadata(testImageBuffer);
      
      expect(metadata).toHaveProperty('width');
      expect(metadata).toHaveProperty('height');
      expect(metadata).toHaveProperty('format');
      expect(metadata).toHaveProperty('size');
      expect(metadata).toHaveProperty('channels');
      
      expect(metadata.width).toBe(800);
      expect(metadata.height).toBe(600);
      expect(metadata.format).toBe('jpeg');
    });

    it('should return correct metadata for PNG image', async () => {
      const metadata = await imageService.getImageMetadata(testImageSmall);
      
      expect(metadata.width).toBe(200);
      expect(metadata.height).toBe(150);
      expect(metadata.format).toBe('png');
    });

    it('should throw error for invalid image buffer', async () => {
      const invalidBuffer = Buffer.from('not an image');
      
      await expect(imageService.getImageMetadata(invalidBuffer))
        .rejects
        .toThrow('Failed to get image metadata');
    });
  });

  describe('_calculateWatermarkPosition', () => {
    it('should calculate correct positions for different settings', () => {
      const imageWidth = 800;
      const imageHeight = 600;
      const fontSize = 24;
      
      // Test all position options
      const topLeft = imageService._calculateWatermarkPosition('top-left', imageWidth, imageHeight, fontSize);
      expect(topLeft.x).toBe(fontSize); // padding
      expect(topLeft.y).toBe(fontSize); // padding
      
      const bottomRight = imageService._calculateWatermarkPosition('bottom-right', imageWidth, imageHeight, fontSize);
      expect(bottomRight.x).toBe(imageWidth - (fontSize * 8) - fontSize); // width - text width - padding
      expect(bottomRight.y).toBe(imageHeight - fontSize - fontSize); // height - font size - padding
      
      const center = imageService._calculateWatermarkPosition('center', imageWidth, imageHeight, fontSize);
      expect(center.x).toBe(imageWidth / 2 - (fontSize * 4));
      expect(center.y).toBe(imageHeight / 2);
    });
  });

  describe('createCollage', () => {
    let testImages;

    beforeEach(async () => {
      // Create multiple test images with different colors
      testImages = [];
      const colors = [
        { r: 255, g: 0, b: 0 },    // Red
        { r: 0, g: 255, b: 0 },    // Green
        { r: 0, g: 0, b: 255 },    // Blue
        { r: 255, g: 255, b: 0 },  // Yellow
        { r: 255, g: 0, b: 255 },  // Magenta
        { r: 0, g: 255, b: 255 }   // Cyan
      ];

      for (let i = 0; i < colors.length; i++) {
        const buffer = await sharp({
          create: {
            width: 400,
            height: 300,
            channels: 3,
            background: colors[i]
          }
        })
        .jpeg()
        .toBuffer();

        testImages.push({
          originalname: `test${i + 1}.jpg`,
          buffer
        });
      }
    });

    it('should create collage with 2 images', async () => {
      const images = testImages.slice(0, 2);
      const collageBuffer = await imageService.createCollage(images);
      
      expect(collageBuffer).toBeInstanceOf(Buffer);
      
      // Verify collage dimensions
      const metadata = await sharp(collageBuffer).metadata();
      expect(metadata.width).toBe(2000);
      expect(metadata.height).toBe(2000);
      expect(metadata.format).toBe('jpeg');
    });

    it('should create collage with 4 images in 2x2 grid', async () => {
      const images = testImages.slice(0, 4);
      const collageBuffer = await imageService.createCollage(images);
      
      expect(collageBuffer).toBeInstanceOf(Buffer);
      
      const metadata = await sharp(collageBuffer).metadata();
      expect(metadata.width).toBe(2000);
      expect(metadata.height).toBe(2000);
      expect(metadata.format).toBe('jpeg');
    });

    it('should create collage with 6 images in optimal grid', async () => {
      const images = testImages.slice(0, 6);
      const collageBuffer = await imageService.createCollage(images);
      
      expect(collageBuffer).toBeInstanceOf(Buffer);
      
      const metadata = await sharp(collageBuffer).metadata();
      expect(metadata.width).toBe(2000);
      expect(metadata.height).toBe(2000);
      expect(metadata.format).toBe('jpeg');
    });

    it('should create collage with custom dimensions', async () => {
      const images = testImages.slice(0, 3);
      const options = {
        width: 1500,
        height: 1500,
        spacing: 20
      };
      
      const collageBuffer = await imageService.createCollage(images, options);
      
      const metadata = await sharp(collageBuffer).metadata();
      expect(metadata.width).toBe(1500);
      expect(metadata.height).toBe(1500);
    });

    it('should create horizontal layout collage', async () => {
      const images = testImages.slice(0, 3);
      const options = {
        layout: 'horizontal',
        width: 2000,
        height: 800
      };
      
      const collageBuffer = await imageService.createCollage(images, options);
      
      expect(collageBuffer).toBeInstanceOf(Buffer);
      
      const metadata = await sharp(collageBuffer).metadata();
      expect(metadata.width).toBe(2000);
      expect(metadata.height).toBe(800);
    });

    it('should create vertical layout collage', async () => {
      const images = testImages.slice(0, 3);
      const options = {
        layout: 'vertical',
        width: 800,
        height: 2000
      };
      
      const collageBuffer = await imageService.createCollage(images, options);
      
      expect(collageBuffer).toBeInstanceOf(Buffer);
      
      const metadata = await sharp(collageBuffer).metadata();
      expect(metadata.width).toBe(800);
      expect(metadata.height).toBe(2000);
    });

    it('should handle custom background color', async () => {
      const images = testImages.slice(0, 2);
      const options = {
        backgroundColor: { r: 100, g: 150, b: 200 }
      };
      
      const collageBuffer = await imageService.createCollage(images, options);
      
      expect(collageBuffer).toBeInstanceOf(Buffer);
      
      const metadata = await sharp(collageBuffer).metadata();
      expect(metadata.format).toBe('jpeg');
    });

    it('should handle custom spacing', async () => {
      const images = testImages.slice(0, 4);
      const options = {
        spacing: 50
      };
      
      const collageBuffer = await imageService.createCollage(images, options);
      
      expect(collageBuffer).toBeInstanceOf(Buffer);
      
      const metadata = await sharp(collageBuffer).metadata();
      expect(metadata.width).toBe(2000);
      expect(metadata.height).toBe(2000);
    });

    it('should throw error for insufficient images', async () => {
      const images = [testImages[0]]; // Only 1 image
      
      await expect(imageService.createCollage(images))
        .rejects
        .toThrow('At least 2 images are required to create a collage');
    });

    it('should throw error for empty image array', async () => {
      await expect(imageService.createCollage([]))
        .rejects
        .toThrow('At least 2 images are required to create a collage');
    });

    it('should throw error for null/undefined images', async () => {
      await expect(imageService.createCollage(null))
        .rejects
        .toThrow('At least 2 images are required to create a collage');
      
      await expect(imageService.createCollage(undefined))
        .rejects
        .toThrow('At least 2 images are required to create a collage');
    });

    it('should handle corrupted images gracefully', async () => {
      const images = [
        testImages[0], // Valid image
        { 
          originalname: 'corrupted.jpg',
          buffer: Buffer.from('invalid image data') 
        }, // Corrupted image
        testImages[1] // Valid image
      ];
      
      const collageBuffer = await imageService.createCollage(images);
      
      expect(collageBuffer).toBeInstanceOf(Buffer);
      
      // Should still create collage with placeholder for corrupted image
      const metadata = await sharp(collageBuffer).metadata();
      expect(metadata.width).toBe(2000);
      expect(metadata.height).toBe(2000);
    });

    it('should optimize collage for Etsy dimensions by default', async () => {
      const images = testImages.slice(0, 4);
      const collageBuffer = await imageService.createCollage(images);
      
      const metadata = await sharp(collageBuffer).metadata();
      
      // Default Etsy dimensions
      expect(metadata.width).toBe(2000);
      expect(metadata.height).toBe(2000);
      
      // Should be optimized JPEG
      expect(metadata.format).toBe('jpeg');
    });
  });

  describe('_calculateGridLayout', () => {
    it('should return 1x1 for single image', () => {
      const layout = imageService._calculateGridLayout(1);
      expect(layout).toEqual({ rows: 1, cols: 1 });
    });

    it('should calculate optimal square layout for various image counts', () => {
      // 2 images: 1x2 or 2x1
      const layout2 = imageService._calculateGridLayout(2);
      expect(layout2.rows * layout2.cols).toBeGreaterThanOrEqual(2);
      
      // 4 images: 2x2
      const layout4 = imageService._calculateGridLayout(4);
      expect(layout4).toEqual({ rows: 2, cols: 2 });
      
      // 6 images: 2x3 or 3x2
      const layout6 = imageService._calculateGridLayout(6);
      expect(layout6.rows * layout6.cols).toBeGreaterThanOrEqual(6);
      
      // 9 images: 3x3
      const layout9 = imageService._calculateGridLayout(9);
      expect(layout9).toEqual({ rows: 3, cols: 3 });
    });

    it('should handle horizontal layout', () => {
      const layout = imageService._calculateGridLayout(5, 'horizontal');
      expect(layout).toEqual({ rows: 1, cols: 5 });
    });

    it('should handle vertical layout', () => {
      const layout = imageService._calculateGridLayout(4, 'vertical');
      expect(layout).toEqual({ rows: 4, cols: 1 });
    });

    it('should handle square layout explicitly', () => {
      const layout = imageService._calculateGridLayout(6, 'square');
      expect(layout.rows * layout.cols).toBeGreaterThanOrEqual(6);
      
      // Should be as close to square as possible
      const aspectRatio = Math.abs(layout.rows - layout.cols);
      expect(aspectRatio).toBeLessThanOrEqual(1);
    });
  });

  describe('_prepareImagesForCollage', () => {
    let testImages;

    beforeEach(async () => {
      testImages = [
        {
          buffer: await sharp({
            create: { width: 800, height: 600, channels: 3, background: { r: 255, g: 0, b: 0 } }
          }).jpeg().toBuffer()
        },
        {
          buffer: await sharp({
            create: { width: 400, height: 800, channels: 3, background: { r: 0, g: 255, b: 0 } }
          }).jpeg().toBuffer()
        }
      ];
    });

    it('should resize images to specified cell dimensions', async () => {
      const cellWidth = 300;
      const cellHeight = 300;
      
      const processedImages = await imageService._prepareImagesForCollage(
        testImages, 
        cellWidth, 
        cellHeight
      );
      
      expect(processedImages).toHaveLength(2);
      
      for (const processedBuffer of processedImages) {
        const metadata = await sharp(processedBuffer).metadata();
        expect(metadata.width).toBe(cellWidth);
        expect(metadata.height).toBe(cellHeight);
        expect(metadata.format).toBe('jpeg');
      }
    });

    it('should handle corrupted images with placeholders', async () => {
      const imagesWithCorrupted = [
        testImages[0],
        { buffer: Buffer.from('invalid image data') }
      ];
      
      const cellWidth = 200;
      const cellHeight = 200;
      
      const processedImages = await imageService._prepareImagesForCollage(
        imagesWithCorrupted, 
        cellWidth, 
        cellHeight
      );
      
      expect(processedImages).toHaveLength(2);
      
      // First image should be processed normally
      const firstMetadata = await sharp(processedImages[0]).metadata();
      expect(firstMetadata.width).toBe(cellWidth);
      expect(firstMetadata.height).toBe(cellHeight);
      
      // Second image should be a placeholder
      const secondMetadata = await sharp(processedImages[1]).metadata();
      expect(secondMetadata.width).toBe(cellWidth);
      expect(secondMetadata.height).toBe(cellHeight);
      expect(secondMetadata.format).toBe('jpeg');
    });

    it('should handle empty image array', async () => {
      const processedImages = await imageService._prepareImagesForCollage([], 300, 300);
      expect(processedImages).toHaveLength(0);
    });
  });

  describe('_createSvgWatermark', () => {
    it('should create valid SVG watermark', () => {
      const svg = imageService._createSvgWatermark('Test Text', 24, 'white', 0.7, { x: 100, y: 200 });
      
      expect(svg).toContain('<svg');
      expect(svg).toContain('<text');
      expect(svg).toContain('Test Text');
      expect(svg).toContain('font-size="24"');
      expect(svg).toContain('fill="white"');
      expect(svg).toContain('opacity="0.7"');
      expect(svg).toContain('x="100"');
      expect(svg).toContain('y="200"');
    });
  });
});