const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GoogleGenAI } = require('@google/genai');
const axios = require('axios');

class AIService {
  constructor() {
    this.genAI = null;
    this.model = null;
    this.imageModel = null;
    this.initialized = false;
    this.apiKey = process.env.GOOGLE_AI_API_KEY;
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
    this.imageModel = this.genAI.getGenerativeModel({
      model: "gemini-2.5-flash-image-preview",
      generationConfig: {
        responseMimeType: "image/png",
      },
    });
    console.log('imageModel:', this.imageModel);
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

  /**
   * Generate images using Gemini AI
   */

  async generateImagesUsingGemini(options) {
    console.log('Image apiKey:', this.apiKey);  
    const { prompt, count = 1, style = 'product' } = options;

    try {
      const genAI = new GoogleGenerativeAI(this.apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash-image-preview"
      });

      // Enhanced prompt based on style
      const stylePrompts = {
        product: 'professional product photography, clean white background, studio lighting, high quality',
        lifestyle: 'lifestyle photography, natural lighting, real environment, warm and inviting',
        artistic: 'artistic photography, creative composition, unique angles, dramatic lighting',
        minimalist: 'minimalist photography, clean composition, simple background, elegant focus'
      };
  
      const enhancedPrompt = `${prompt}, ${stylePrompts[style] || stylePrompts['product']}`;
  
      const images = [];
      // Make a separate call for each image
      for (let i = 0; i < count; i++) {
        const result = await model.generateContent(enhancedPrompt);
        const response = result.response;
        
        if (response && response.candidates && response.candidates.length > 0) {
          const imagePart = response.candidates[0].content.parts[0];
          if (imagePart && imagePart.inlineData) {
            const dataUrl = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
            images.push({
              id: `generated_${Date.now()}_${i}`,
              dataUrl,
              url: dataUrl,
              prompt,
              style,
              generatedAt: new Date().toISOString()
            });
          }
        }
      }
      return images;

    } catch (error) {
      console.error("Error generating images with Gemini:", error.message);
      // Fallback logic for placeholder images
      const images = [];
      for (let i = 0; i < count; i++) {
        const placeholderImage = "https://via.placeholder.com/1024";
        images.push({
          id: `placeholder_${Date.now()}_${i}`,
          dataUrl: placeholderImage,
          url: placeholderImage,
          prompt,
          style,
          generatedAt: new Date().toISOString()
        });
      }
      return images;
    }
  }

  async generateImagesUsingPexels(options) {
    this.pexelApiKey = process.env.PEXELS_API_KEY;
    console.log('Pexels API Key:', this.pexelApiKey);
    const { prompt, count = 1, style = 'product' } = options;
  
    try {
      if (!this.pexelApiKey) {
        throw new Error("Pexels API key not configured");
      }
  
      // Enhanced prompt based on style
      const stylePrompts = {
        product: 'product',
        lifestyle: 'lifestyle',
        artistic: 'artistic',
        minimalist: 'minimalist'
      };
  
      const searchQuery = `${prompt} ${stylePrompts[style] || stylePrompts['product']}`;
  
      // Fetch images from Pexels
      const response = await axios.get('https://api.pexels.com/v1/search', {
        headers: {
          Authorization: this.pexelApiKey
        },
        params: {
          query: searchQuery,
          per_page: count
        }
      });
  
      const photos = response.data.photos || [];
      const images = photos.map((photo, i) => {
        const url = photo.src.original || photo.src.large2x || photo.src.medium;
        return {
          id: `pexels_${photo.id}_${i}`,
          dataUrl: url,
          url,
          prompt,
          style,
          generatedAt: new Date().toISOString()
        };
      });
  
      // Fallback to placeholder if no images found
      if (images.length === 0) {
        for (let i = 0; i < count; i++) {
          const placeholderImage = "https://via.placeholder.com/1024";
          images.push({
            id: `placeholder_${Date.now()}_${i}`,
            dataUrl: placeholderImage,
            url: placeholderImage,
            prompt,
            style,
            generatedAt: new Date().toISOString()
          });
        }
      }
      console.log('images:', images);
      return images;
  
    } catch (error) {
      console.error("Error fetching images from Pexels:", error.message);
  
      // Fallback to placeholder images if API fails
      const images = [];
      for (let i = 0; i < count; i++) {
        const placeholderImage = "https://via.placeholder.com/1024";
        images.push({
          id: `placeholder_${Date.now()}_${i}`,
          dataUrl: placeholderImage,
          url: placeholderImage,
          prompt,
          style,
          generatedAt: new Date().toISOString()
        });
      }
      return images;
    }
  }

  async generateImages(options) {
    console.log('Using Google Imagen for image generation');
    const { prompt, count = 1, style = 'product' } = options;
  
    try {
      if (!this.apiKey) {
        throw new Error("Google API key not configured");
      }
  
      // Init Google Imagen client
      const ai = new GoogleGenAI({
        apiKey: this.apiKey
      });
  
      // Enhanced prompt based on style
      const stylePrompts = {
        product: 'professional product photography, clean white background, studio lighting, high quality',
        lifestyle: 'lifestyle photography, natural lighting, real environment, warm and inviting',
        artistic: 'artistic photography, creative composition, unique angles, dramatic lighting',
        minimalist: 'minimalist photography, clean composition, simple background, elegant focus'
      };
  
      const enhancedPrompt = `${prompt}, ${stylePrompts[style] || stylePrompts['product']}`;
  
      // Generate images with Imagen
      const response = await ai.models.generateImages({
        model: "imagen-4.0-generate-001",
        prompt: enhancedPrompt,
        config: {
          numberOfImages: count,
          size: "1024x1024"
        }
      });
  
      const images = [];
      let idx = 1;
  
      for (const generatedImage of response.generatedImages) {
        if (generatedImage.image?.imageBytes) {
          const base64Data = generatedImage.image.imageBytes;
          const dataUrl = `data:image/png;base64,${base64Data}`;
          images.push({
            id: `imagen_${Date.now()}_${idx}`,
            dataUrl,
            url: dataUrl,
            prompt,
            style,
            generatedAt: new Date().toISOString()
          });
        }
        idx++;
      }
  
      // Fallback if no images returned
      if (images.length === 0) {
        for (let i = 0; i < count; i++) {
          const placeholderImage = "https://via.placeholder.com/1024";
          images.push({
            id: `placeholder_${Date.now()}_${i}`,
            dataUrl: placeholderImage,
            url: placeholderImage,
            prompt,
            style,
            generatedAt: new Date().toISOString()
          });
        }
      }
  
      return images;
  
    } catch (error) {
      console.error("Error generating images with Google Imagen:", error.message);
  
      // Fallback to placeholder images
      const images = [];
      for (let i = 0; i < count; i++) {
        const placeholderImage = "https://via.placeholder.com/1024";
        images.push({
          id: `placeholder_${Date.now()}_${i}`,
          dataUrl: placeholderImage,
          url: placeholderImage,
          prompt,
          style,
          generatedAt: new Date().toISOString()
        });
      }
      return images;
    }
  }

  /**
   * Create a placeholder image for demonstration
   * In production, this would be replaced with actual AI-generated images
   */
  createPlaceholderImage(prompt, index) {
    // Create a simple placeholder image using canvas
    const canvas = require('canvas');
    const { createCanvas } = canvas;
    
    const canvasWidth = 1024;
    const canvasHeight = 1024;
    const canvasElement = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvasElement.getContext('2d');
    
    // Create gradient background
    const gradient = ctx.createLinearGradient(0, 0, canvasWidth, canvasHeight);
    gradient.addColorStop(0, '#f8fafc');
    gradient.addColorStop(1, '#e2e8f0');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // Add text
    ctx.fillStyle = '#374151';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('AI Generated', canvasWidth / 2, canvasHeight / 2 - 50);
    
    ctx.font = '24px Arial';
    ctx.fillText(`Image ${index}`, canvasWidth / 2, canvasHeight / 2 + 20);
    
    ctx.font = '16px Arial';
    ctx.fillStyle = '#6b7280';
    const words = prompt.split(' ');
    const lines = [];
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > canvasWidth - 100) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    lines.push(currentLine);
    
    let y = canvasHeight / 2 + 80;
    for (const line of lines.slice(0, 3)) { // Show max 3 lines
      ctx.fillText(line, canvasWidth / 2, y);
      y += 30;
    }
    
    // Add border
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, canvasWidth - 4, canvasHeight - 4);
    
    return canvasElement.toDataURL('image/png');
  }
}

module.exports = AIService;