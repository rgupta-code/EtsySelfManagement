const request = require('supertest');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

// Create a simple test app with just the basic middleware
const app = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Import error handler
const { errorHandler, notFoundHandler } = require('../../middleware/errorHandler');

// Simple test routes
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

// Test error handling
app.get('/api/test-error', (req, res, next) => {
  const error = new Error('Test error');
  error.statusCode = 400;
  next(error);
});

// 404 handler for API routes
app.use('/api/*', notFoundHandler);

// Global error handling middleware
app.use(errorHandler);

describe('API Core Functionality', () => {
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

    it('should handle application errors with proper format', async () => {
      const response = await request(app)
        .get('/api/test-error')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Test error');
      expect(response.body.error.timestamp).toBeDefined();
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      // Helmet should add security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
    });
  });

  describe('CORS', () => {
    it('should handle CORS properly', async () => {
      const response = await request(app)
        .options('/api/health')
        .set('Origin', 'http://localhost:3000')
        .expect(204);

      // CORS headers should be present
      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });
});