const AIService = require('../aiService');
const fs = require('fs');
const path = require('path');

describe('AIService Integration Tests', () => {
  let aiService;

  beforeEach(() => {
    aiService = new AIService();
  });

  describe('Environment Configuration', () => {
    it('should handle missing API key gracefully', async () => {
      // Temporarily remove API key
      const originalKey = process.env.GOOGLE_AI_API_KEY;
      delete process.env.GOOGLE_AI_API_KEY;

      await expect(aiService.initialize()).rejects.toThrow(
        'GOOGLE_AI_API_KEY environment variable is required'
      );

      // Restore API key
      if (originalKey) {
        process.env.GOOGLE_AI_API_KEY = originalKey;
      }
    });

    it('should initialize successfully with valid API key', async () => {
      // Set a test API key
      process.env.GOOGLE_AI_API_KEY = 'test-key';

      await expect(aiService.initialize()).resolves.not.toThrow();
      expect(aiService.initialized).toBe(true);
    });
  });

  describe('Image Buffer Validation', () => {
    it('should validate image buffer requirements', async () => {
      process.env.GOOGLE_AI_API_KEY = 'test-key';

      await expect(aiService.generateTitle(null)).rejects.toThrow(
        'At least one image is required for title generation'
      );

      await expect(aiService.generateTags(undefined)).rejects.toThrow(
        'At least one image is required for tag generation'
      );

      await expect(aiService.generateDescription([])).rejects.toThrow(
        'At least one image is required for description generation'
      );

      await expect(aiService.analyzeImages([])).rejects.toThrow(
        'At least one image is required for analysis'
      );
    });
  });

  describe('Random Image Selection', () => {
    it('should handle various image array sizes', () => {
      const singleImage = [Buffer.from('image1')];
      const multipleImages = [
        Buffer.from('image1'),
        Buffer.from('image2'),
        Buffer.from('image3'),
        Buffer.from('image4'),
        Buffer.from('image5')
      ];

      // Test with single image
      const result1 = aiService._selectRandomImages(singleImage, 2);
      expect(result1).toEqual(singleImage);

      // Test with multiple images
      const result2 = aiService._selectRandomImages(multipleImages, 2);
      expect(result2).toHaveLength(2);
      expect(multipleImages).toEqual(expect.arrayContaining(result2));

      // Test with exact count
      const result3 = aiService._selectRandomImages(multipleImages, 5);
      expect(result3).toEqual(multipleImages);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      process.env.GOOGLE_AI_API_KEY = 'test-key';
    });

    it('should provide meaningful error messages', async () => {
      const mockImages = [Buffer.from('test-image')];

      // Initialize the service first
      await aiService.initialize();

      // Mock the model to throw an error after initialization
      aiService.model = {
        generateContent: jest.fn().mockRejectedValue(new Error('Network timeout'))
      };

      await expect(aiService.generateTitle(mockImages)).rejects.toThrow(
        'Failed to generate title: Network timeout'
      );

      await expect(aiService.generateTags(mockImages)).rejects.toThrow(
        'Failed to generate tags: Network timeout'
      );

      await expect(aiService.generateDescription(mockImages)).rejects.toThrow(
        'Failed to generate description: Network timeout'
      );
    });
  });

  describe('Service Configuration', () => {
    it('should use correct model configuration', async () => {
      process.env.GOOGLE_AI_API_KEY = 'test-key';
      
      await aiService.initialize();
      
      expect(aiService.genAI).toBeDefined();
      expect(aiService.model).toBeDefined();
      expect(aiService.initialized).toBe(true);
    });
  });
});