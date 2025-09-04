const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { APIError, asyncHandler, createExternalAPIError } = require('../middleware/errorHandler');
const { 
  generateToken, 
  generateRefreshToken, 
  verifyToken,
  storeUserSession,
  getUserSession,
  updateUserSession,
  removeUserSession,
  requireAuth,
  optionalAuth
} = require('../middleware/authMiddleware');
const GoogleDriveService = require('../services/googleDriveService');
const EtsyService = require('../services/etsyService');

const router = express.Router();

// Service instances
const googleDriveService = new GoogleDriveService();
const etsyService = new EtsyService();

/**
 * OAuth state storage for security (in production, use Redis)
 */
const oauthStates = new Map();

/**
 * Generate secure OAuth state
 */
function generateOAuthState(userId, service) {
  const state = uuidv4();
  oauthStates.set(state, {
    userId,
    service,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
  });
  return state;
}

/**
 * Verify OAuth state
 */
function verifyOAuthState(state) {
  const stateData = oauthStates.get(state);
  if (!stateData) {
    throw new APIError('Invalid OAuth state', 400, 'INVALID_OAUTH_STATE');
  }
  
  if (new Date() > stateData.expiresAt) {
    oauthStates.delete(state);
    throw new APIError('OAuth state expired', 400, 'OAUTH_STATE_EXPIRED');
  }
  
  oauthStates.delete(state);
  return stateData;
}

/**
 * Create or get user session
 */
async function createUserSession(email, userData = {}) {
  const userId = userData.id || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Generate tokens
  const accessToken = generateToken({ userId, email });
  const refreshToken = generateRefreshToken(userId);
  
  // Store session
  storeUserSession(userId, {
    id: userId,
    email,
    accessToken,
    refreshToken,
    ...userData
  });
  
  return {
    userId,
    accessToken,
    refreshToken,
    expiresIn: '24h'
  };
}

/**
 * Get authentication status
 */
router.get('/status', optionalAuth, asyncHandler(async (req, res) => {
  const isAuthenticated = !!req.user;
  let googleDriveStatus = { connected: false };
  let etsyStatus = { connected: false };
  
  if (isAuthenticated) {
    const session = req.user.session;
    
    // Check Google Drive authentication
    if (session.googleAuth && session.googleAuth.accessToken) {
      googleDriveStatus = {
        connected: true,
        email: session.googleAuth.email,
        expiresAt: session.googleAuth.expiresAt
      };
    }
    
    // Check Etsy authentication
    if (session.etsyAuth && session.etsyAuth.accessToken) {
      etsyStatus = {
        connected: true,
        shopName: session.etsyAuth.shopName,
        shopId: session.etsyAuth.shopId,
        expiresAt: session.etsyAuth.expiresAt
      };
    }
  }
  
  res.json({
    success: true,
    authenticated: isAuthenticated,
    user: isAuthenticated ? {
      id: req.user.id,
      email: req.user.email
    } : null,
    services: {
      googleDrive: googleDriveStatus,
      etsy: etsyStatus
    }
  });
}));

/**
 * Refresh access token
 */
router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    throw new APIError('Refresh token required', 400, 'MISSING_REFRESH_TOKEN');
  }
  
  try {
    const decoded = verifyToken(refreshToken);
    
    if (decoded.type !== 'refresh') {
      throw new APIError('Invalid refresh token', 400, 'INVALID_REFRESH_TOKEN');
    }
    
    const session = getUserSession(decoded.userId);
    if (!session || session.refreshToken !== refreshToken) {
      throw new APIError('Refresh token not found', 401, 'REFRESH_TOKEN_NOT_FOUND');
    }
    
    // Generate new access token
    const newAccessToken = generateToken({ 
      userId: decoded.userId, 
      email: session.email 
    });
    
    // Update session
    updateUserSession(decoded.userId, { accessToken: newAccessToken });
    
    res.json({
      success: true,
      accessToken: newAccessToken,
      expiresIn: '24h'
    });
    
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    throw new APIError('Token refresh failed', 401, 'REFRESH_FAILED');
  }
}));

/**
 * Logout endpoint
 */
router.post('/logout', requireAuth, asyncHandler(async (req, res) => {
  removeUserSession(req.user.id);
  
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
}));

/**
 * Google OAuth initiation
 */
router.get('/google', optionalAuth, asyncHandler(async (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new APIError('Google OAuth not configured', 500, 'GOOGLE_OAUTH_NOT_CONFIGURED');
  }
  
  // Initialize Google Drive service
  await googleDriveService.initialize({
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/auth/google/callback`
  });
  
  // Generate state for security
  const userId = req.user?.id || 'anonymous';
  const state = generateOAuthState(userId, 'google');
  
  const authUrl = googleDriveService.getAuthUrl(state);
  
  res.json({
    success: true,
    authUrl,
    state
  });
}));

/**
 * Google OAuth callback
 */
router.get('/google/callback', asyncHandler(async (req, res) => {
  const { code, state } = req.query;
  
  if (!code) {
    throw new APIError('Authorization code required', 400, 'MISSING_AUTH_CODE');
  }
  
  if (!state) {
    throw new APIError('OAuth state required', 400, 'MISSING_OAUTH_STATE');
  }
  
  try {
    // Verify state
    const stateData = verifyOAuthState(state);
    
    // Exchange code for tokens
    const tokens = await googleDriveService.authenticateWithCode(code);
    const userInfo = await googleDriveService.getUserInfo();
    
    let sessionData;
    
    if (stateData.userId === 'anonymous') {
      // Create new user session
      sessionData = await createUserSession(userInfo.email, {
        name: userInfo.name,
        picture: userInfo.picture
      });
    } else {
      // Update existing session
      sessionData = { userId: stateData.userId };
    }
    
    // Store Google authentication in session
    updateUserSession(sessionData.userId, {
      googleAuth: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + (tokens.expires_in * 1000)),
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture
      }
    });
    
    // Redirect to frontend with success
    const redirectUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
    res.redirect(`${redirectUrl}/auth/success?service=google&token=${sessionData.accessToken || 'existing'}`);
    
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    const redirectUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
    res.redirect(`${redirectUrl}/auth/error?service=google&error=${encodeURIComponent(error.message)}`);
  }
}));

/**
 * Etsy OAuth initiation
 */
router.get('/etsy', optionalAuth, asyncHandler(async (req, res) => {
  if (!process.env.ETSY_CLIENT_ID) {
    throw new APIError('Etsy OAuth not configured', 500, 'ETSY_OAUTH_NOT_CONFIGURED');
  }
  
  // Initialize Etsy service
  await etsyService.initialize({
    client_id: process.env.ETSY_CLIENT_ID,
    client_secret: process.env.ETSY_CLIENT_SECRET,
    redirect_uri: process.env.ETSY_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/auth/etsy/callback`
  });
  
  // Generate state for security
  const userId = req.user?.id || 'anonymous';
  const state = generateOAuthState(userId, 'etsy');
  
  const authUrl = etsyService.getAuthUrl(state);
  
  res.json({
    success: true,
    authUrl,
    state
  });
}));

/**
 * Etsy OAuth callback
 */
router.get('/etsy/callback', asyncHandler(async (req, res) => {
  const { code, state } = req.query;
  
  if (!code) {
    throw new APIError('Authorization code required', 400, 'MISSING_AUTH_CODE');
  }
  
  if (!state) {
    throw new APIError('OAuth state required', 400, 'MISSING_OAUTH_STATE');
  }
  
  try {
    // Verify state
    const stateData = verifyOAuthState(state);
    
    // Exchange code for tokens
    const tokens = await etsyService.authenticateWithCode(code);
    const userInfo = await etsyService.getUserInfo();
    const shop = await etsyService.getUserShop();
    
    let sessionData;
    
    if (stateData.userId === 'anonymous') {
      // Create new user session
      sessionData = await createUserSession(userInfo.email || `etsy_${userInfo.user_id}@etsy.local`, {
        name: userInfo.first_name + ' ' + userInfo.last_name,
        etsyUserId: userInfo.user_id
      });
    } else {
      // Update existing session
      sessionData = { userId: stateData.userId };
    }
    
    // Store Etsy authentication in session
    updateUserSession(sessionData.userId, {
      etsyAuth: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + (tokens.expires_in * 1000)),
        userId: userInfo.user_id,
        shopId: shop.shop_id,
        shopName: shop.shop_name,
        shopUrl: shop.url
      }
    });
    
    // Redirect to frontend with success
    const redirectUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
    res.redirect(`${redirectUrl}/auth/success?service=etsy&token=${sessionData.accessToken || 'existing'}&shop=${encodeURIComponent(shop.shop_name)}`);
    
  } catch (error) {
    console.error('Etsy OAuth callback error:', error);
    const redirectUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
    res.redirect(`${redirectUrl}/auth/error?service=etsy&error=${encodeURIComponent(error.message)}`);
  }
}));

/**
 * Disconnect service authentication
 */
router.delete('/disconnect/:service', requireAuth, asyncHandler(async (req, res) => {
  const { service } = req.params;
  const userId = req.user.id;
  
  if (!['google', 'etsy'].includes(service)) {
    throw new APIError('Invalid service', 400, 'INVALID_SERVICE');
  }
  
  const session = getUserSession(userId);
  if (session) {
    delete session[`${service}Auth`];
    updateUserSession(userId, session);
  }
  
  res.json({
    success: true,
    message: `${service} authentication disconnected`
  });
}));

/**
 * Get user profile
 */
router.get('/profile', requireAuth, asyncHandler(async (req, res) => {
  const session = req.user.session;
  
  const profile = {
    id: req.user.id,
    email: req.user.email,
    name: session.name,
    picture: session.picture,
    createdAt: session.createdAt,
    lastActivity: session.lastActivity
  };
  
  res.json({
    success: true,
    profile
  });
}));

/**
 * Update user profile
 */
router.patch('/profile', requireAuth, asyncHandler(async (req, res) => {
  const { name, preferences } = req.body;
  const userId = req.user.id;
  
  const updates = {};
  if (name) updates.name = name;
  if (preferences) updates.preferences = preferences;
  
  updateUserSession(userId, updates);
  
  res.json({
    success: true,
    message: 'Profile updated successfully'
  });
}));

// Clean up expired OAuth states every 5 minutes
setInterval(() => {
  const now = new Date();
  for (const [state, data] of oauthStates.entries()) {
    if (now > data.expiresAt) {
      oauthStates.delete(state);
    }
  }
}, 5 * 60 * 1000);

module.exports = router;