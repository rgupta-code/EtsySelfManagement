const request = require('supertest');
const express = require('express');
const authRoutes = require('../auth');
const { 
  storeUserSession, 
  getUserSession, 
  removeUserSession,
  generateToken 
} = require('../../middleware/authMiddleware');

// Mock external services
jest.mock('../../services/googleDriveService');
jest.mock('../../services/etsyService');

const GoogleDriveService = require('../../services/googleDriveService');
const EtsyService = require('../../services/etsyService');

describe('Auth Routes', () => {
  let app;
  let mockGoogleService;
  let mockEtsyService;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);

    // Clear all sessions
    const sessions = getUserSession('test');
    if (sessions) {
      removeUserSession('test');
    }

    // Setup mocks
    mockGoogleService = {
      initialize: jest.fn(),
      getAuthUrl: jest.fn(),
      authenticateWithCode: jest.fn(),
      getUserInfo: jest.fn()
    };

    mockEtsyService = {
      initialize: jest.fn(),
      getAuthUrl: jest.fn(),
      authenticateWithCode: jest.fn(),
      getUserInfo: jest.fn(),
      getUserShop: jest.fn()
    };

    GoogleDriveService.mockImplementation(() => mockGoogleService);
    EtsyService.mockImplementation(() => mockEtsyService);

    jest.clearAllMocks();
  });

  describe('GET /status', () => {
    it('should return unauthenticated status when no token', async () => {
      const response = await request(app)
        .get('/api/auth/status')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        authenticated: false,
        user: null,
        services: {
          googleDrive: { connected: false },
          etsy: { connected: false }
        }
      });
    });

    it('should return authenticated status with user info', async () => {
      const userId = 'test-user';
      const token = generateToken({ userId, email: 'test@example.com' });
      
      storeUserSession(userId, {
        id: userId,
        email: 'test@example.com',
        accessToken: token
      });

      const response = await request(app)
        .get('/api/auth/status')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.authenticated).toBe(true);
      expect(response.body.user).toMatchObject({
        id: userId,
        email: 'test@example.com'
      });
    });

    it('should show connected services when authenticated', async () => {
      const userId = 'test-user';
      const token = generateToken({ userId, email: 'test@example.com' });
      
      storeUserSession(userId, {
        id: userId,
        email: 'test@example.com',
        accessToken: token,
        googleAuth: {
          accessToken: 'google-token',
          email: 'test@gmail.com',
          expiresAt: new Date(Date.now() + 3600000).toISOString()
        },
        etsyAuth: {
          accessToken: 'etsy-token',
          shopName: 'Test Shop',
          shopId: '12345',
          expiresAt: new Date(Date.now() + 3600000).toISOString()
        }
      });

      const response = await request(app)
        .get('/api/auth/status')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.services.googleDrive.connected).toBe(true);
      expect(response.body.services.etsy.connected).toBe(true);
      expect(response.body.services.googleDrive.email).toBe('test@gmail.com');
      expect(response.body.services.etsy.shopName).toBe('Test Shop');
    });
  });

  describe('POST /refresh', () => {
    it('should refresh access token with valid refresh token', async () => {
      const userId = 'test-user';
      const refreshToken = generateToken({ userId, type: 'refresh' }, '7d');
      
      storeUserSession(userId, {
        id: userId,
        email: 'test@example.com',
        refreshToken
      });

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.expiresIn).toBe('24h');
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Token refresh failed');
    });

    it('should reject missing refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Refresh token required');
    });
  });

  describe('POST /logout', () => {
    it('should logout authenticated user', async () => {
      const userId = 'test-user';
      const token = generateToken({ userId, email: 'test@example.com' });
      
      storeUserSession(userId, {
        id: userId,
        email: 'test@example.com',
        accessToken: token
      });

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logged out successfully');
      
      // Verify session is removed
      expect(getUserSession(userId)).toBeUndefined();
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /google', () => {
    beforeEach(() => {
      process.env.GOOGLE_CLIENT_ID = 'test-client-id';
      process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
    });

    it('should return Google OAuth URL', async () => {
      mockGoogleService.getAuthUrl.mockReturnValue('https://accounts.google.com/oauth/authorize?...');

      const response = await request(app)
        .get('/api/auth/google')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.authUrl).toBeDefined();
      expect(response.body.state).toBeDefined();
      expect(mockGoogleService.initialize).toHaveBeenCalled();
      expect(mockGoogleService.getAuthUrl).toHaveBeenCalled();
    });

    it('should handle missing Google OAuth configuration', async () => {
      delete process.env.GOOGLE_CLIENT_ID;

      const response = await request(app)
        .get('/api/auth/google')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Google OAuth not configured');
    });
  });

  describe('GET /etsy', () => {
    beforeEach(() => {
      process.env.ETSY_CLIENT_ID = 'test-client-id';
      process.env.ETSY_CLIENT_SECRET = 'test-client-secret';
    });

    it('should return Etsy OAuth URL', async () => {
      mockEtsyService.getAuthUrl.mockReturnValue('https://www.etsy.com/oauth/connect?...');

      const response = await request(app)
        .get('/api/auth/etsy')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.authUrl).toBeDefined();
      expect(response.body.state).toBeDefined();
      expect(mockEtsyService.initialize).toHaveBeenCalled();
      expect(mockEtsyService.getAuthUrl).toHaveBeenCalled();
    });

    it('should handle missing Etsy OAuth configuration', async () => {
      delete process.env.ETSY_CLIENT_ID;

      const response = await request(app)
        .get('/api/auth/etsy')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Etsy OAuth not configured');
    });
  });

  describe('DELETE /disconnect/:service', () => {
    it('should disconnect Google service', async () => {
      const userId = 'test-user';
      const token = generateToken({ userId, email: 'test@example.com' });
      
      storeUserSession(userId, {
        id: userId,
        email: 'test@example.com',
        accessToken: token,
        googleAuth: {
          accessToken: 'google-token',
          email: 'test@gmail.com'
        }
      });

      const response = await request(app)
        .delete('/api/auth/disconnect/google')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('google authentication disconnected');
      
      // Verify Google auth is removed
      const session = getUserSession(userId);
      expect(session.googleAuth).toBeUndefined();
    });

    it('should disconnect Etsy service', async () => {
      const userId = 'test-user';
      const token = generateToken({ userId, email: 'test@example.com' });
      
      storeUserSession(userId, {
        id: userId,
        email: 'test@example.com',
        accessToken: token,
        etsyAuth: {
          accessToken: 'etsy-token',
          shopName: 'Test Shop'
        }
      });

      const response = await request(app)
        .delete('/api/auth/disconnect/etsy')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('etsy authentication disconnected');
      
      // Verify Etsy auth is removed
      const session = getUserSession(userId);
      expect(session.etsyAuth).toBeUndefined();
    });

    it('should reject invalid service', async () => {
      const userId = 'test-user';
      const token = generateToken({ userId, email: 'test@example.com' });
      
      storeUserSession(userId, {
        id: userId,
        email: 'test@example.com',
        accessToken: token
      });

      const response = await request(app)
        .delete('/api/auth/disconnect/invalid')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid service');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .delete('/api/auth/disconnect/google')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /profile', () => {
    it('should return user profile', async () => {
      const userId = 'test-user';
      const token = generateToken({ userId, email: 'test@example.com' });
      
      storeUserSession(userId, {
        id: userId,
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg',
        accessToken: token
      });

      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.profile).toMatchObject({
        id: userId,
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg'
      });
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PATCH /profile', () => {
    it('should update user profile', async () => {
      const userId = 'test-user';
      const token = generateToken({ userId, email: 'test@example.com' });
      
      storeUserSession(userId, {
        id: userId,
        email: 'test@example.com',
        name: 'Old Name',
        accessToken: token
      });

      const response = await request(app)
        .patch('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'New Name',
          preferences: { theme: 'dark' }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Profile updated successfully');
      
      // Verify updates
      const session = getUserSession(userId);
      expect(session.name).toBe('New Name');
      expect(session.preferences).toEqual({ theme: 'dark' });
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .patch('/api/auth/profile')
        .send({ name: 'New Name' })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});