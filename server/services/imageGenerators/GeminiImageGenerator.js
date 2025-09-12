const ImageGeneratorStrategy = require('./ImageGeneratorStrategy');
const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiImageGenerator extends ImageGeneratorStrategy {
  constructor(apiKey) {
    super();
    this.apiKey = apiKey;
    this.genAI = null;
    this.model = null;
  }

  async initialize() {
    if (!this.apiKey) {
      throw new Error('Google AI API key is required for Gemini image generation');
    }
    
    this.genAI = new GoogleGenerativeAI(this.apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: "gemini-2.5-flash-image-preview",
      generationConfig: {
        responseMimeType: "image/png",
      },
    });
  }

  isAvailable() {
    return !!this.apiKey;
  }

  async generateImages(options) {
    const { prompt, count = 1, style = 'product' } = options;
    
    if (!this.model) {
      await this.initialize();
    }

    const stylePrompts = {
      product: 'professional product photography, clean white background, studio lighting, high quality',
      lifestyle: 'lifestyle photography, natural lighting, real environment, warm and inviting',
      artistic: 'artistic photography, creative composition, unique angles, dramatic lighting',
      minimalist: 'minimalist photography, clean composition, simple background, elegant focus'
    };

    const enhancedPrompt = `${prompt}, ${stylePrompts[style] || stylePrompts['product']}`;
    const images = [];

    for (let i = 0; i < count; i++) {
      try {
        const result = await this.model.generateContent(enhancedPrompt);
        const response = result.response;
        
        if (response?.candidates?.[0]?.content?.parts?.[0]?.inlineData) {
          const imagePart = response.candidates[0].content.parts[0];
          const dataUrl = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
          images.push({
            id: `gemini_${Date.now()}_${i}`,
            dataUrl,
            url: dataUrl,
            prompt,
            style,
            generatedAt: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error(`Failed to generate image ${i + 1}:`, error.message);
      }
    }

    return images;
  }
}

module.exports = GeminiImageGenerator;