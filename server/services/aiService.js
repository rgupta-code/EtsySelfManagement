const { GoogleGenerativeAI } = require('@google/generative-ai');

class AIService {
  constructor() {
    this.genAI = null;
    this.model = null;
    this.initialized = false;
  }

  /**
   * Initialize the Google Generative AI service
   */
  async initialize() {
    if (this.initialized) return;

    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY environment variable is required');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    this.initialized = true;
  }

  /**
   * Generate a compelling product title based on image analysis
   * @param {Buffer[]} imageBuffers - Array of image buffers to analyze
   * @returns {Promise<string>} Generated title (max 140 characters)
   */
  async generateTitle(imageBuffers) {
    await this.initialize();

    if (!imageBuffers || imageBuffers.length === 0) {
      throw new Error('At least one image is required for title generation');
    }

    // Use up to 2 random images for analysis as per requirements
    const imagesToAnalyze = this._selectRandomImages(imageBuffers, 2);
    
    const prompt = `Analyze these product images and generate a compelling Etsy listing title. 
    The title should be:
    - Maximum 140 characters
    - SEO-friendly with relevant keywords
    - Appealing to potential buyers
    - Descriptive of the product's key features
    - Professional and marketable
    
    Focus on what makes this product unique and desirable. Include style, material, or use case if visible.
    Return only the title text, no additional formatting or explanation.`;

    try {
      const imageParts = imagesToAnalyze.map(buffer => ({
        inlineData: {
          data: buffer.toString('base64'),
          mimeType: 'image/jpeg'
        }
      }));

      const result = await this.model.generateContent([prompt, ...imageParts]);
      const response = await result.response;
      let title = response.text().trim();

      // Ensure title doesn't exceed 140 characters
      if (title.length > 140) {
        title = title.substring(0, 137) + '...';
      }

      return title;
    } catch (error) {
      throw new Error(`Failed to generate title: ${error.message}`);
    }
  }

  /**
   * Generate relevant tags based on image content
   * @param {Buffer[]} imageBuffers - Array of image buffers to analyze
   * @returns {Promise<string[]>} Array of 5-13 relevant tags
   */
  async generateTags(imageBuffers) {
    await this.initialize();

    if (!imageBuffers || imageBuffers.length === 0) {
      throw new Error('At least one image is required for tag generation');
    }

    const imagesToAnalyze = this._selectRandomImages(imageBuffers, 2);
    
    const prompt = `Analyze these product images and generate relevant Etsy tags.
    Requirements:
    - Generate between 5 and 13 tags
    - Tags should be relevant to the product shown
    - Include style, material, color, use case, and target audience tags
    - Use popular Etsy search terms
    - Each tag should be 1-3 words maximum
    - Focus on what buyers would search for
    
    Return the tags as a comma-separated list, no additional formatting or explanation.
    Example format: handmade, vintage style, home decor, gift idea, boho chic`;

    try {
      const imageParts = imagesToAnalyze.map(buffer => ({
        inlineData: {
          data: buffer.toString('base64'),
          mimeType: 'image/jpeg'
        }
      }));

      const result = await this.model.generateContent([prompt, ...imageParts]);
      const response = await result.response;
      const tagsText = response.text().trim();

      // Parse tags and clean them up
      const tags = tagsText
        .split(',')
        .map(tag => tag.trim().toLowerCase())
        .filter(tag => tag.length > 0 && tag.length <= 20) // Etsy tag limit
        .slice(0, 13); // Maximum 13 tags

      // Ensure we have at least 5 tags
      if (tags.length < 5) {
        throw new Error('Generated fewer than 5 tags, please try again');
      }

      return tags;
    } catch (error) {
      throw new Error(`Failed to generate tags: ${error.message}`);
    }
  }

  /**
   * Generate a detailed product description
   * @param {Buffer[]} imageBuffers - Array of image buffers to analyze
   * @param {string} title - Generated title for context
   * @returns {Promise<string>} Generated description (200-500 words)
   */
  async generateDescription(imageBuffers, title = '') {
    await this.initialize();

    if (!imageBuffers || imageBuffers.length === 0) {
      throw new Error('At least one image is required for description generation');
    }

    const imagesToAnalyze = this._selectRandomImages(imageBuffers, 2);
    
    const prompt = `Analyze these product images and generate a compelling Etsy product description.
    ${title ? `Product title for context: "${title}"` : ''}
    
    Requirements:
    - 200-500 words
    - Engaging and persuasive tone
    - Highlight key features and benefits
    - Include materials, dimensions, or care instructions if visible
    - Appeal to the target customer
    - Use descriptive language that helps buyers visualize the product
    - Include potential use cases or gift occasions
    - Professional but warm tone suitable for Etsy marketplace
    
    Structure the description with:
    1. Opening hook that captures attention
    2. Key features and benefits
    3. Details about materials, size, or craftsmanship
    4. Use cases or occasions
    5. Call to action or closing statement
    
    Return only the description text, no additional formatting or headers.`;

    try {
      const imageParts = imagesToAnalyze.map(buffer => ({
        inlineData: {
          data: buffer.toString('base64'),
          mimeType: 'image/jpeg'
        }
      }));

      const result = await this.model.generateContent([prompt, ...imageParts]);
      const response = await result.response;
      let description = response.text().trim();

      // Ensure description is within word count range
      const wordCount = description.split(/\s+/).length;
      if (wordCount < 200) {
        throw new Error('Generated description is too short (less than 200 words)');
      }
      if (wordCount > 500) {
        // Truncate to approximately 500 words
        const words = description.split(/\s+/);
        description = words.slice(0, 500).join(' ') + '...';
      }

      return description;
    } catch (error) {
      throw new Error(`Failed to generate description: ${error.message}`);
    }
  }

  /**
   * Generate complete metadata for a product listing
   * @param {Buffer[]} imageBuffers - Array of image buffers to analyze
   * @returns {Promise<Object>} Complete metadata object with title, tags, and description
   */
  async generateMetadata(imageBuffers) {
    await this.initialize();

    if (!imageBuffers || imageBuffers.length === 0) {
      throw new Error('At least one image is required for metadata generation');
    }

    try {
      // Generate title first
      const title = await this.generateTitle(imageBuffers);
      
      // Generate tags and description in parallel
      const [tags, description] = await Promise.all([
        this.generateTags(imageBuffers),
        this.generateDescription(imageBuffers, title)
      ]);

      return {
        title,
        tags,
        description,
        confidence: 0.85, // Default confidence score
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Failed to generate complete metadata: ${error.message}`);
    }
  }

  /**
   * Analyze images to extract visual features and context
   * @param {Buffer[]} imageBuffers - Array of image buffers to analyze
   * @returns {Promise<Object>} Analysis results with visual features
   */
  async analyzeImages(imageBuffers) {
    await this.initialize();

    if (!imageBuffers || imageBuffers.length === 0) {
      throw new Error('At least one image is required for analysis');
    }

    const imagesToAnalyze = this._selectRandomImages(imageBuffers, 2);
    
    const prompt = `Analyze these product images and provide detailed visual analysis.
    
    Return a JSON object with the following structure:
    {
      "dominantColors": ["color1", "color2", "color3"],
      "detectedObjects": ["object1", "object2"],
      "style": "style description",
      "mood": "mood description",
      "suggestedKeywords": ["keyword1", "keyword2", "keyword3"]
    }
    
    Focus on:
    - Main colors visible in the product
    - Key objects or elements
    - Overall style (modern, vintage, rustic, etc.)
    - Mood or feeling the product conveys
    - Keywords that would help with searchability
    
    Return only valid JSON, no additional text.`;

    try {
      const imageParts = imagesToAnalyze.map(buffer => ({
        inlineData: {
          data: buffer.toString('base64'),
          mimeType: 'image/jpeg'
        }
      }));

      const result = await this.model.generateContent([prompt, ...imageParts]);
      const response = await result.response;
      const analysisText = response.text().trim();

      // Parse JSON response
      const analysis = JSON.parse(analysisText);
      
      return {
        ...analysis,
        analyzedAt: new Date().toISOString(),
        imageCount: imagesToAnalyze.length
      };
    } catch (error) {
      throw new Error(`Failed to analyze images: ${error.message}`);
    }
  }

  /**
   * Select random images from the array for analysis
   * @param {Buffer[]} imageBuffers - Array of all image buffers
   * @param {number} count - Number of images to select
   * @returns {Buffer[]} Selected image buffers
   * @private
   */
  _selectRandomImages(imageBuffers, count) {
    if (imageBuffers.length <= count) {
      return imageBuffers;
    }

    const selected = [];
    const indices = new Set();
    
    while (selected.length < count && indices.size < imageBuffers.length) {
      const randomIndex = Math.floor(Math.random() * imageBuffers.length);
      if (!indices.has(randomIndex)) {
        indices.add(randomIndex);
        selected.push(imageBuffers[randomIndex]);
      }
    }
    
    return selected;
  }
}

module.exports = AIService;