/**
 * Centralized configuration management
 * Handles environment variables, validation, and default values
 */

const { ValidationError } = require('../utils/errors');

class ConfigService {
  constructor() {
    this.config = this.loadConfig();
    this.validateConfig();
  }

  loadConfig() {
    return {
      // Server Configuration
      server: {
        port: parseInt(process.env.PORT) || 3000,
        host: process.env.HOST || 'localhost',
        nodeEnv: process.env.NODE_ENV || 'development',
        corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000'
      },

      // Google Services
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback',
        aiApiKey: process.env.GOOGLE_AI_API_KEY
      },

      // Etsy API
      etsy: {
        clientId: process.env.ETSY_CLIENT_ID,
        clientSecret: process.env.ETSY_CLIENT_SECRET,
        redirectUri: process.env.ETSY_REDIRECT_URI || 'http://localhost:3000/api/auth/etsy/callback'
      },

      // Pexels API
      pexels: {
        apiKey: process.env.PEXELS_API_KEY
      },

      // File Processing
      fileProcessing: {
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
        allowedMimeTypes: (process.env.ALLOWED_MIME_TYPES || 'image/jpeg,image/png,image/webp').split(','),
        tempDirCleanupInterval: parseInt(process.env.TEMP_CLEANUP_INTERVAL) || 30 * 60 * 1000, // 30 minutes
        maxTempFileAge: parseInt(process.env.MAX_TEMP_FILE_AGE) || 2 * 60 * 60 * 1000 // 2 hours
      },

      // Image Processing
      imageProcessing: {
        defaultQuality: parseInt(process.env.IMAGE_QUALITY) || 90,
        maxDimensions: {
          width: parseInt(process.env.MAX_IMAGE_WIDTH) || 4000,
          height: parseInt(process.env.MAX_IMAGE_HEIGHT) || 4000
        },
        watermark: {
          defaultOpacity: parseFloat(process.env.WATERMARK_OPACITY) || 0.2,
          defaultFontSize: parseInt(process.env.WATERMARK_FONT_SIZE) || 40
        }
      },

      // Security
      security: {
        sessionSecret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
        jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret',
        bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12
      }
    };
  }

  validateConfig() {
    const errors = [];

    // Validate required production settings
    if (this.config.server.nodeEnv === 'production') {
      if (!this.config.google.clientId) {
        errors.push('GOOGLE_CLIENT_ID is required in production');
      }
      if (!this.config.google.clientSecret) {
        errors.push('GOOGLE_CLIENT_SECRET is required in production');
      }
      if (this.config.security.sessionSecret === 'dev-secret-change-in-production') {
        errors.push('SESSION_SECRET must be set in production');
      }
    }

    // Validate numeric values
    if (this.config.server.port < 1 || this.config.server.port > 65535) {
      errors.push('PORT must be between 1 and 65535');
    }

    if (this.config.fileProcessing.maxFileSize < 1024) {
      errors.push('MAX_FILE_SIZE must be at least 1KB');
    }

    if (errors.length > 0) {
      throw new ValidationError('Configuration validation failed', { errors });
    }
  }

  get(path) {
    return path.split('.').reduce((obj, key) => obj?.[key], this.config);
  }

  isDevelopment() {
    return this.config.server.nodeEnv === 'development';
  }

  isProduction() {
    return this.config.server.nodeEnv === 'production';
  }

  isTest() {
    return this.config.server.nodeEnv === 'test';
  }

  // Service availability checks
  isGoogleConfigured() {
    return !!(this.config.google.clientId && this.config.google.clientSecret);
  }

  isEtsyConfigured() {
    return !!(this.config.etsy.clientId && this.config.etsy.clientSecret);
  }

  isAIConfigured() {
    return !!this.config.google.aiApiKey;
  }

  isPexelsConfigured() {
    return !!this.config.pexels.apiKey;
  }
}

// Create singleton instance
const configService = new ConfigService();

module.exports = configService;