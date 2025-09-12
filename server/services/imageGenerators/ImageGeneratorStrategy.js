/**
 * Strategy interface for different image generation providers
 */
class ImageGeneratorStrategy {
  async generateImages(options) {
    throw new Error('generateImages method must be implemented');
  }

  isAvailable() {
    throw new Error('isAvailable method must be implemented');
  }
}

module.exports = ImageGeneratorStrategy;