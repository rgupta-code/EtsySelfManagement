const request = require('supertest');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

// Create a test app with just the core API functionality
const app = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Import error handler
const { errorHandler, notFoundHandler, APIError, asyncHandler } = require('../../middleware/errorHandler');

// Mock settings service for testing
const mockSettings = {
  watermark: { text: 'Test Brand', position: 'bottom-right', enabled: true },
  collage: { layout: 'grid', enabled: true },
  googleDrive: { autoUpload: false },
  etsy: { autoDraft: false },
  processing: { imageQuality: 90 }
};

// Test routes that simulate the main API functionality
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      imageProcessing: 'available',
      fileManagement: 'available',
      googleDrive: process.env.GOOGLE_CLIENT_ID ? 'configured' : 'not_configured',
      etsy: process.env.ETSY_CLIENT_ID ? 'configured' : 'not_configured',
      ai: process.env.GOOGLE_AI_API_KEY ? 'configured' : 'not_configured'
    }
  });
});

app.get('/api/settings', asyncHandler(async (req, res) => {
  res.json({
    success: true,
    settings: mockSettings
  });
}));

app.put('/api/settings', asyncHandler(async (req, res) => {
  if (!req.body.settings) {
    throw new APIError('Settings data is required', 400, 'MISSING_SETTINGS');
  }
  
  // Simulate validation error for invalid settings
  if (req.body.settings.watermark && req.body.settings.watermark.opacity > 1) {
    throw new APIError('Watermark opacity must be between 0 and 1', 400, 'VALIDATION_ERROR');
  }
  
  res.json({
    success: true,
    settings: { ...mockSettings, ...req.body.settings }
  });
}));

app.patch('/api/settings/:section', asyncHandler(async (req, res) => {
  const { section } = req.params;
  const updates = req.body.updates;
  
  if (!updates) {
    throw new APIError('Updates data is required', 400, 'MISSING_UPDATES');
  }
  
  const updatedSettings = { ...mockSettings };
  updatedSettings[section] = { ...updatedSettings[section], ...updates };
  
  res.json({
    success: true,
    settings: updatedSettings
  });
}));

app.get('/api/auth/google', asyncHandler(async (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new APIError('Google OAuth not configured', 500, 'GOOGLE_OAUTH_NOT_CONFIGURED');
  }
  
  res.json({
    success: true,
    authUrl: 'https://accounts.google.com/oauth/authorize?mock=true'
  });
}));

app.get('/api/auth/google/callback', asyncHandler(async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    throw new APIError('Authorization code required', 400, 'MISSING_AUTH_CODE');
  }
  
  res.json({
    success: true,
    message: 'Google Drive authentication successful',
    authenticated: true
  });
}));

app.get('/api/auth/etsy', asyncHandler(async (req, res) => {
  if (!process.env.ETSY_CLIENT_ID) {
    throw new APIError('Etsy OAuth not configured', 500, 'ETSY_OAUTH_NOT_CONFIGURED');
  }
  
  res.json({
    success: true,
    authUrl: 'https://www.etsy.com/oauth/connect?mock=true'
  });
}));

app.get('/api/auth/etsy/callback', asyncHandler(async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    throw new APIError('Authorization code required', 400, 'MISSING_AUTH_CODE');
  }
  
  res.json({
    success: true,
    message: 'Etsy authentication successful',
    shop: { id: '12345', name: 'Test Shop' },
    authenticated: true
  });
}));

// Processing status simulation
const mockProcessingStatus = new Map();

app.get('/api/status/:processingId', (req, res) => {
  const { processingId } = req.params;
  const status = mockProcessingStatus.get(processingId);
  
  if (!status) {
    return res.status(404).json({
      success: false,
      error: 'Processing ID not found'
    });
  }
  
  res.json({
    success: true,
    status
  });
});

// Test endpoint to create mock processing status
app.post('/api/test/create-processing', (req, res) => {
  const processingId = `test_${Date.now()}`;
  mockProcessingStatus.set(processingId, {
    id: processingId,
    startTime: new Date().toISOString(),
    currentStep: 'validation',
    currentStatus: 'completed',
    steps: [
      { step: 'validation', status: 'completed', timestamp: new Date().toISOString() }
    ]
  });
  
  res.json({ success: true, processingId });
});

// 404 handler for API routes
app.use('/api/*', notFoundHandler);

// Global error handling middleware
app.use(errorHandler);

describe('API Core Functionality Tests', () => {
  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.status).toBe('healthy');
      expect(response.body.services).toHaveProperty('imageProcessing');
      expect(response.body.services).toHaveProperty('fileManagement');
      expect(response.body.timestamp).toBeDefined();
    });

    it('should show service configuration status', async () => {
      process.env.GOOGLE_CLIENT_ID = 'test';
      process.env.ETSY_CLIENT_ID = 'test';
      process.env.GOOGLE_AI_API_KEY = 'test';

      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.services.googleDrive).toBe('configured');
      expect(response.body.services.etsy).toBe('configured');
      expect(response.body.services.ai).toBe('configured');

      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.ETSY_CLIENT_ID;
      delete process.env.GOOGLE_AI_API_KEY;
    });
  });

  describe('Settings Management', () => {
    it('should load default settings', async () => {
      const response = await request(app)
        .get('/api/settings')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.settings).toHaveProperty('watermark');
      expect(response.body.settings).toHaveProperty('collage');
      expect(response.body.settings).toHaveProperty('googleDrive');
      expect(response.body.settings).toHaveProperty('etsy');
    });

    it('should save user settings', async () => {
      const newSettings = {
        watermark: { text: 'New Brand', position: 'center' }
      };

      const response = await request(app)
        .put('/api/settings')
        .send({ settings: newSettings })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.settings.watermark.text).toBe('New Brand');
    });

    it('should handle missing settings data', async () => {
      const response = await request(app)
        .put('/api/settings')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Settings data is required');
      expect(response.body.error.code).toBe('MISSING_SETTINGS');
    });

    it('should validate settings data', async () => {
      const invalidSettings = {
        watermark: { opacity: 2.0 } // Invalid: should be between 0 and 1
      };

      const response = await request(app)
        .put('/api/settings')
        .send({ settings: invalidSettings })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('opacity');
    });

    it('should update specific settings section', async () => {
      const updates = { text: 'Updated Brand' };

      const response = await request(app)
        .patch('/api/settings/watermark')
        .send({ updates })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.settings.watermark.text).toBe('Updated Brand');
    });

    it('should handle missing updates data', async () => {
      const response = await request(app)
        .patch('/api/settings/watermark')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Updates data is required');
    });
  });

  describe('Authentication Endpoints', () => {
    describe('Google Drive Authentication', () => {
      it('should return Google auth URL when configured', async () => {
        process.env.GOOGLE_CLIENT_ID = 'test_client_id';

        const response = await request(app)
          .get('/api/auth/google')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.authUrl).toContain('accounts.google.com');

        delete process.env.GOOGLE_CLIENT_ID;
      });

      it('should handle missing Google OAuth configuration', async () => {
        const response = await request(app)
          .get('/api/auth/google')
          .expect(500);

        expect(response.body.success).toBe(false);
        expect(response.body.error.message).toBe('Google OAuth not configured');
        expect(response.body.error.code).toBe('GOOGLE_OAUTH_NOT_CONFIGURED');
      });

      it('should handle Google OAuth callback', async () => {
        const response = await request(app)
          .get('/api/auth/google/callback?code=test_code')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.authenticated).toBe(true);
      });

      it('should handle missing authorization code', async () => {
        const response = await request(app)
          .get('/api/auth/google/callback')
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error.message).toBe('Authorization code required');
      });
    });

    describe('Etsy Authentication', () => {
      it('should return Etsy auth URL when configured', async () => {
        process.env.ETSY_CLIENT_ID = 'test_etsy_client_id';

        const response = await request(app)
          .get('/api/auth/etsy')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.authUrl).toContain('etsy.com');

        delete process.env.ETSY_CLIENT_ID;
      });

      it('should handle missing Etsy OAuth configuration', async () => {
        const response = await request(app)
          .get('/api/auth/etsy')
          .expect(500);

        expect(response.body.success).toBe(false);
        expect(response.body.error.message).toBe('Etsy OAuth not configured');
      });

      it('should handle Etsy OAuth callback', async () => {
        const response = await request(app)
          .get('/api/auth/etsy/callback?code=test_code')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.authenticated).toBe(true);
        expect(response.body.shop.id).toBe('12345');
      });
    });
  });

  describe('Processing Status', () => {
    it('should return 404 for invalid processing ID', async () => {
      const response = await request(app)
        .get('/api/status/invalid_id')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Processing ID not found');
    });

    it('should return processing status for valid ID', async () => {
      // Create a mock processing status
      const createResponse = await request(app)
        .post('/api/test/create-processing')
        .expect(200);

      const processingId = createResponse.body.processingId;

      // Get the status
      const response = await request(app)
        .get(`/api/status/${processingId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.status).toHaveProperty('id', processingId);
      expect(response.body.status).toHaveProperty('startTime');
      expect(response.body.status).toHaveProperty('steps');
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for non-existent API endpoints', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('API endpoint not found');
      expect(response.body.error.code).toBe('ENDPOINT_NOT_FOUND');
    });

    it('should provide detailed error information', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      expect(response.body.error).toHaveProperty('message');
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('timestamp');
      expect(response.body.error).toHaveProperty('details');
    });
  });

  describe('Security Features', () => {
    it('should include security headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
    });

    it('should handle CORS properly', async () => {
      const response = await request(app)
        .options('/api/health')
        .set('Origin', 'http://localhost:3000')
        .expect(204);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });

  describe('Request Orchestration Features', () => {
    it('should handle async errors properly', async () => {
      const response = await request(app)
        .put('/api/settings')
        .send({ settings: { watermark: { opacity: 5 } } })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should provide consistent response format', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
    });
  });
});