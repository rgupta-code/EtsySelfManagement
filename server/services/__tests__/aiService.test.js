const AIService = require('../aiService');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Mock the Google Generative AI module
jest.mock('@google/generative-ai');

describe('AIService', () => {
  let aiService;
  let mockModel;
  let mockGenAI;
  let mockResult;
  let mockResponse;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create mock objects
    mockResponse = {
      text: jest.fn()
    };
    
    mockResult = {
      response: Promise.resolve(mockResponse)
    };
    
    mockModel = {
      generateContent: jest.fn().mockResolvedValue(mockResult)
    };
    
    mockGenAI = {
      getGenerativeModel: jest.fn().mockReturnValue(mockModel)
    };
    
    GoogleGenerativeAI.mockImplementation(() => mockGenAI);
    
    // Set up environment variable
    process.env.GOOGLE_AI_API_KEY = 'test-api-key';
    
    aiService = new AIService();
  });

  afterEach(() => {
    delete process.env.GOOGLE_AI_API_KEY;
  });

  describe('initialization', () => {
    it('should initialize with Google AI API key', async () => {
      await aiService.initialize();
      
      expect(GoogleGenerativeAI).toHaveBeenCalledWith('test-api-key');
      expect(mockGenAI.getGenerativeModel).toHaveBeenCalledWith({ model: 'gemini-1.5-flash' });
      expect(aiService.initialized).toBe(true);
    });

    it('should throw error if API key is missing', async () => {
      delete process.env.GOOGLE_AI_API_KEY;
      
      await expect(aiService.initialize()).rejects.toThrow(
        'GOOGLE_AI_API_KEY environment variable is required'
      );
    });

    it('should not reinitialize if already initialized', async () => {
      await aiService.initialize();
      await aiService.initialize();
      
      expect(GoogleGenerativeAI).toHaveBeenCalledTimes(1);
    });
  });

  describe('generateTitle', () => {
    const mockImageBuffers = [
      Buffer.from('fake-image-data-1'),
      Buffer.from('fake-image-data-2')
    ];

    it('should generate a title within character limit', async () => {
      const mockTitle = 'Beautiful Handmade Ceramic Vase - Perfect Home Decor Gift';
      mockResponse.text.mockReturnValue(mockTitle);
      
      const result = await aiService.generateTitle(mockImageBuffers);
      
      expect(result).toBe(mockTitle);
      expect(result.length).toBeLessThanOrEqual(140);
      expect(mockModel.generateContent).toHaveBeenCalledWith([
        expect.stringContaining('Maximum 140 characters'),
        expect.objectContaining({
          inlineData: {
            data: mockImageBuffers[0].toString('base64'),
            mimeType: 'image/jpeg'
          }
        }),
        expect.objectContaining({
          inlineData: {
            data: mockImageBuffers[1].toString('base64'),
            mimeType: 'image/jpeg'
          }
        })
      ]);
    });

    it('should truncate title if it exceeds 140 characters', async () => {
      const longTitle = 'A'.repeat(150);
      mockResponse.text.mockReturnValue(longTitle);
      
      const result = await aiService.generateTitle(mockImageBuffers);
      
      expect(result).toBe('A'.repeat(137) + '...');
      expect(result.length).toBe(140);
    });

    it('should handle single image', async () => {
      const singleImage = [mockImageBuffers[0]];
      const mockTitle = 'Single Image Product Title';
      mockResponse.text.mockReturnValue(mockTitle);
      
      const result = await aiService.generateTitle(singleImage);
      
      expect(result).toBe(mockTitle);
      expect(mockModel.generateContent).toHaveBeenCalledWith([
        expect.any(String),
        expect.objectContaining({
          inlineData: expect.objectContaining({
            data: singleImage[0].toString('base64')
          })
        })
      ]);
    });

    it('should throw error if no images provided', async () => {
      await expect(aiService.generateTitle([])).rejects.toThrow(
        'At least one image is required for title generation'
      );
    });

    it('should handle API errors gracefully', async () => {
      mockModel.generateContent.mockRejectedValue(new Error('API Error'));
      
      await expect(aiService.generateTitle(mockImageBuffers)).rejects.toThrow(
        'Failed to generate title: API Error'
      );
    });
  });

  describe('generateTags', () => {
    const mockImageBuffers = [Buffer.from('fake-image-data')];

    it('should generate tags within valid range', async () => {
      const mockTagsText = 'handmade, ceramic, vase, home decor, gift, modern, white, minimalist';
      mockResponse.text.mockReturnValue(mockTagsText);
      
      const result = await aiService.generateTags(mockImageBuffers);
      
      expect(result).toEqual([
        'handmade', 'ceramic', 'vase', 'home decor', 'gift', 'modern', 'white', 'minimalist'
      ]);
      expect(result.length).toBeGreaterThanOrEqual(5);
      expect(result.length).toBeLessThanOrEqual(13);
    });

    it('should clean and filter tags properly', async () => {
      const mockTagsText = 'handmade, , CERAMIC, vase, gift, modern, style, decor, beautiful';
      mockResponse.text.mockReturnValue(mockTagsText);
      
      const result = await aiService.generateTags(mockImageBuffers);
      
      expect(result).toEqual(['handmade', 'ceramic', 'vase', 'gift', 'modern', 'style', 'decor', 'beautiful']);
      expect(result).not.toContain('');
      expect(result.length).toBeGreaterThanOrEqual(5);
    });

    it('should limit to maximum 13 tags', async () => {
      const mockTagsText = Array.from({ length: 20 }, (_, i) => `tag${i + 1}`).join(', ');
      mockResponse.text.mockReturnValue(mockTagsText);
      
      const result = await aiService.generateTags(mockImageBuffers);
      
      expect(result.length).toBe(13);
    });

    it('should throw error if fewer than 5 tags generated', async () => {
      const mockTagsText = 'tag1, tag2, tag3';
      mockResponse.text.mockReturnValue(mockTagsText);
      
      await expect(aiService.generateTags(mockImageBuffers)).rejects.toThrow(
        'Generated fewer than 5 tags, please try again'
      );
    });

    it('should throw error if no images provided', async () => {
      await expect(aiService.generateTags([])).rejects.toThrow(
        'At least one image is required for tag generation'
      );
    });
  });

  describe('generateDescription', () => {
    const mockImageBuffers = [Buffer.from('fake-image-data')];
    const mockTitle = 'Beautiful Ceramic Vase';

    it('should generate description within word count range', async () => {
      const mockDescription = 'This beautiful ceramic vase ' + 'word '.repeat(250) + 'perfect for any home.';
      mockResponse.text.mockReturnValue(mockDescription);
      
      const result = await aiService.generateDescription(mockImageBuffers, mockTitle);
      
      expect(result).toBe(mockDescription);
      const wordCount = result.split(/\s+/).length;
      expect(wordCount).toBeGreaterThanOrEqual(200);
      expect(wordCount).toBeLessThanOrEqual(500);
    });

    it('should truncate description if too long', async () => {
      const longDescription = 'word '.repeat(600) + 'end';
      mockResponse.text.mockReturnValue(longDescription);
      
      const result = await aiService.generateDescription(mockImageBuffers, mockTitle);
      
      const wordCount = result.split(/\s+/).length;
      expect(wordCount).toBeLessThanOrEqual(501); // 500 words + "..."
      expect(result).toMatch(/\.\.\.$/);
    });

    it('should work without title context', async () => {
      const mockDescription = 'This amazing product ' + 'word '.repeat(250) + 'is perfect.';
      mockResponse.text.mockReturnValue(mockDescription);
      
      const result = await aiService.generateDescription(mockImageBuffers);
      
      expect(result).toBe(mockDescription);
    });

    it('should throw error if description too short', async () => {
      const shortDescription = 'Short description with only few words here.';
      mockResponse.text.mockReturnValue(shortDescription);
      
      await expect(aiService.generateDescription(mockImageBuffers, mockTitle)).rejects.toThrow(
        'Generated description is too short (less than 200 words)'
      );
    });

    it('should throw error if no images provided', async () => {
      await expect(aiService.generateDescription([])).rejects.toThrow(
        'At least one image is required for description generation'
      );
    });
  });

  describe('generateMetadata', () => {
    const mockImageBuffers = [Buffer.from('fake-image-data')];

    it('should generate complete metadata object', async () => {
      const mockTitle = 'Beautiful Ceramic Vase';
      const mockTagsText = 'handmade, ceramic, vase, home decor, gift, modern';
      const mockDescription = 'This beautiful ceramic vase ' + 'word '.repeat(250) + 'perfect.';
      
      mockResponse.text
        .mockReturnValueOnce(mockTitle)
        .mockReturnValueOnce(mockTagsText)
        .mockReturnValueOnce(mockDescription);
      
      const result = await aiService.generateMetadata(mockImageBuffers);
      
      expect(result).toEqual({
        title: mockTitle,
        tags: ['handmade', 'ceramic', 'vase', 'home decor', 'gift', 'modern'],
        description: mockDescription,
        confidence: 0.85,
        generatedAt: expect.any(String)
      });
      expect(new Date(result.generatedAt)).toBeInstanceOf(Date);
    });

    it('should handle errors in metadata generation', async () => {
      mockModel.generateContent.mockRejectedValue(new Error('API Error'));
      
      await expect(aiService.generateMetadata(mockImageBuffers)).rejects.toThrow(
        'Failed to generate complete metadata: Failed to generate title: API Error'
      );
    });
  });

  describe('analyzeImages', () => {
    const mockImageBuffers = [Buffer.from('fake-image-data')];

    it('should analyze images and return structured data', async () => {
      const mockAnalysis = {
        dominantColors: ['blue', 'white', 'gray'],
        detectedObjects: ['vase', 'flowers'],
        style: 'modern minimalist',
        mood: 'calm and serene',
        suggestedKeywords: ['home decor', 'ceramic', 'handmade']
      };
      mockResponse.text.mockReturnValue(JSON.stringify(mockAnalysis));
      
      const result = await aiService.analyzeImages(mockImageBuffers);
      
      expect(result).toEqual({
        ...mockAnalysis,
        analyzedAt: expect.any(String),
        imageCount: 1
      });
    });

    it('should handle invalid JSON response', async () => {
      mockResponse.text.mockReturnValue('invalid json response');
      
      await expect(aiService.analyzeImages(mockImageBuffers)).rejects.toThrow(
        'Failed to analyze images:'
      );
    });

    it('should throw error if no images provided', async () => {
      await expect(aiService.analyzeImages([])).rejects.toThrow(
        'At least one image is required for analysis'
      );
    });
  });

  describe('_selectRandomImages', () => {
    it('should return all images if count is greater than available', () => {
      const images = [Buffer.from('1'), Buffer.from('2')];
      const result = aiService._selectRandomImages(images, 5);
      
      expect(result).toEqual(images);
    });

    it('should return requested count of images', () => {
      const images = [Buffer.from('1'), Buffer.from('2'), Buffer.from('3'), Buffer.from('4')];
      const result = aiService._selectRandomImages(images, 2);
      
      expect(result).toHaveLength(2);
      expect(images).toEqual(expect.arrayContaining(result));
    });

    it('should return unique images', () => {
      const images = Array.from({ length: 10 }, (_, i) => Buffer.from(`image-${i}`));
      const result = aiService._selectRandomImages(images, 3);
      
      expect(result).toHaveLength(3);
      expect(new Set(result.map(img => img.toString()))).toHaveProperty('size', 3);
    });
  });
});