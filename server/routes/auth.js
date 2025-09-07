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
 * Test Google OAuth token
 */
router.get('/test-google-token', asyncHandler(async (req, res) => {
  const { access_token } = req.query;
  
  if (!access_token) {
    return res.json({
      success: false,
      error: 'Access token required'
    });
  }
  
  try {
    const axios = require('axios');
    const response = await axios.get('https://www.googleapis.com/oauth2/v1/tokeninfo', {
      params: {
        access_token: access_token
      }
    });
    
    res.json({
      success: true,
      tokenInfo: response.data
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      details: error.response?.data
    });
  }
}));

/**
 * Test Etsy OAuth token
 */
router.get('/test-etsy-token', asyncHandler(async (req, res) => {
  const { access_token, client_id } = req.query;
  
  if (!access_token || !client_id) {
    return res.json({
      success: false,
      error: 'Access token and client_id required'
    });
  }
  
  try {
    const axios = require('axios');
    const response = await axios.get('https://openapi.etsy.com/v3/application/user', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'x-api-key': client_id
      }
    });
    
    res.json({
      success: true,
      userInfo: response.data
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      details: error.response?.data
    });
  }
}));

/**
 * Debug OAuth configuration
 */
router.get('/debug', asyncHandler(async (req, res) => {
  const config = {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ? 'configured' : 'missing',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ? 'configured' : 'missing',
      redirectUri: process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/auth/google/callback`
    },
    etsy: {
      clientId: process.env.ETSY_CLIENT_ID ? 'configured' : 'missing',
      clientSecret: process.env.ETSY_CLIENT_SECRET ? 'configured' : 'missing',
      redirectUri: process.env.ETSY_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/auth/etsy/callback`
    },
    server: {
      port: process.env.PORT || 3001,
      nodeEnv: process.env.NODE_ENV || 'development',
      frontendUrl: process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`
    }
  };
  
  res.json({
    success: true,
    config,
    message: 'OAuth configuration debug info'
  });
}));

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
  console.log('Google OAuth initiation requested');
  console.log('GOOGLE_CLIENT_ID exists:', !!process.env.GOOGLE_CLIENT_ID);
  console.log('GOOGLE_CLIENT_SECRET exists:', !!process.env.GOOGLE_CLIENT_SECRET);
  
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new APIError('Google OAuth not configured - GOOGLE_CLIENT_ID missing', 500, 'GOOGLE_OAUTH_NOT_CONFIGURED');
  }
  
  if (!process.env.GOOGLE_CLIENT_SECRET) {
    throw new APIError('Google OAuth not configured - GOOGLE_CLIENT_SECRET missing', 500, 'GOOGLE_OAUTH_NOT_CONFIGURED');
  }
  
  // Initialize Google Drive service
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/auth/google/callback`;
  console.log('Using redirect URI:', redirectUri);
  console.log('Request host:', req.get('host'));
  console.log('Request protocol:', req.protocol);
  
  await googleDriveService.initialize({
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: redirectUri
  });
  
  // Generate state for security
  const userId = req.user?.id || 'anonymous';
  const state = generateOAuthState(userId, 'google');
  console.log('Generated state:', state);
  
  const authUrl = googleDriveService.getAuthUrl(state);
  console.log('Generated auth URL:', authUrl);
  console.log('Auth URL length:', authUrl.length);
  
  res.json({
    success: true,
    authUrl,
    state,
    redirectUri: redirectUri
  });
}));

/**
 * Google OAuth callback
 */
router.get('/google/callback', asyncHandler(async (req, res) => {
  const { code, state, error, error_description } = req.query;
  
  console.log('=== Google OAuth Callback Debug ===');
  console.log('Full URL:', req.url);
  console.log('Full query object:', req.query);
  console.log('- Code:', code ? `present (${code.substring(0, 10)}...)` : 'missing');
  console.log('- State:', state ? `present (${state})` : 'missing');
  console.log('- Error:', error || 'none');
  console.log('- Error Description:', error_description || 'none');
  console.log('- Headers:', req.headers);
  console.log('===================================');
  
  // Check for OAuth errors first
  if (error) {
    console.error('OAuth error from Google:', error, error_description);
    const redirectUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
    res.redirect(`${redirectUrl}/settings.html?auth=error&service=google&error=${encodeURIComponent(error_description || error)}`);
    return;
  }
  
  if (!code) {
    console.error('No authorization code received from Google');
    const redirectUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
    res.redirect(`${redirectUrl}/settings.html?auth=error&service=google&error=${encodeURIComponent('No authorization code received from Google')}`);
    return;
  }
  
  if (!state) {
    // For development, allow missing state but log a warning
    if (process.env.NODE_ENV === 'development') {
      console.warn('OAuth state missing in development mode - allowing callback to proceed');
      // Create a mock state data for development
      const mockStateData = {
        userId: 'anonymous',
        service: 'google',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000)
      };
      
      try {
        // Exchange code for tokens
        const tokens = await googleDriveService.authenticateWithCode(code);
        console.log('Tokens received, waiting 1 second before getting user info...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        const userInfo = await googleDriveService.getUserInfo();
        
        // Create new user session
        const sessionData = await createUserSession(userInfo.email, {
          name: userInfo.name,
          picture: userInfo.picture
        });
        
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
        const finalRedirectUrl = `${redirectUrl}/settings.html?auth=success&service=google&token=${sessionData.accessToken || 'existing'}`;
        console.log('Redirecting to:', finalRedirectUrl);
        res.redirect(finalRedirectUrl);
        return;
      } catch (error) {
        console.error('Google OAuth callback error (dev mode):', error);
        const redirectUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
        res.redirect(`${redirectUrl}/settings.html?auth=error&service=google&error=${encodeURIComponent(error.message)}`);
        return;
      }
    } else {
      throw new APIError('OAuth state required', 400, 'MISSING_OAUTH_STATE');
    }
  }
  
  try {
    // Verify state
    const stateData = verifyOAuthState(state);
    
    // Exchange code for tokens
    const tokens = await googleDriveService.authenticateWithCode(code);
    console.log('Tokens received, waiting 1 second before getting user info...');
    await new Promise(resolve => setTimeout(resolve, 1000));
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
    res.redirect(`${redirectUrl}/settings.html?auth=success&service=google&token=${sessionData.accessToken || 'existing'}`);
    
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    const redirectUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
    res.redirect(`${redirectUrl}/settings.html?auth=error&service=google&error=${encodeURIComponent(error.message)}`);
  }
}));

/**
 * Etsy OAuth initiation
 */
router.get('/etsy', optionalAuth, asyncHandler(async (req, res) => {
  console.log('Etsy OAuth initiation requested');
  console.log('ETSY_CLIENT_ID exists:', !!process.env.ETSY_CLIENT_ID);
  console.log('ETSY_CLIENT_SECRET exists:', !!process.env.ETSY_CLIENT_SECRET);
  
  if (!process.env.ETSY_CLIENT_ID) {
    throw new APIError('Etsy OAuth not configured - ETSY_CLIENT_ID missing', 500, 'ETSY_OAUTH_NOT_CONFIGURED');
  }
  
  if (!process.env.ETSY_CLIENT_SECRET) {
    throw new APIError('Etsy OAuth not configured - ETSY_CLIENT_SECRET missing', 500, 'ETSY_OAUTH_NOT_CONFIGURED');
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
  
  // Generate auth URL with PKCE
  const authData = etsyService.getAuthUrl(state);
  
  // Get existing state data
  const existingState = oauthStates.get(state);
  console.log('Existing state data:', existingState);
  
  // Store PKCE code verifier in OAuth state for later use
  oauthStates.set(state, {
    ...existingState,
    codeVerifier: authData.codeVerifier
  });
  
  console.log('Stored PKCE code verifier for state:', state);
  console.log('Updated state data:', oauthStates.get(state));
  
  res.json({
    success: true,
    authUrl: authData.authUrl,
    state,
    codeChallenge: authData.codeChallenge,
    codeChallengeMethod: authData.codeChallengeMethod
  });
}));

/**
 * Etsy OAuth callback
 */
router.get('/etsy/callback', asyncHandler(async (req, res) => {
  console.log('Etsy OAuth callback received');
  console.log('Request URL:', req.url);
  console.log('Query parameters:', req.query);
  console.log('Headers:', req.headers);
  
  const { code, state, error, error_description } = req.query;
  
  // Check for OAuth errors from Etsy
  if (error) {
    console.error('Etsy OAuth error from callback:', error, error_description);
    const redirectUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
    return res.redirect(`${redirectUrl}/settings.html?auth=error&service=etsy&error=${encodeURIComponent(error_description || error)}`);
  }
  
  if (!code) {
    console.error('No authorization code received from Etsy');
    throw new APIError('Authorization code required', 400, 'MISSING_AUTH_CODE');
  }
  
  if (!state) {
    console.error('No OAuth state received from Etsy');
    throw new APIError('OAuth state required', 400, 'MISSING_OAUTH_STATE');
  }
  
  console.log('Etsy OAuth callback parameters:', {
    code: code ? 'present' : 'missing',
    state: state ? 'present' : 'missing',
    error: error || 'none'
  });
  
  try {
    // Get stored state data before verification (which deletes it)
    console.log('Retrieving stored OAuth state...');
    console.log('Looking for state:', state);
    console.log('Available states:', Array.from(oauthStates.keys()));
    
    const storedState = oauthStates.get(state);
    console.log('Retrieved stored state:', storedState);
    
    if (!storedState) {
      throw new Error('OAuth state not found');
    }
    
    const codeVerifier = storedState.codeVerifier;
    console.log('Code verifier from stored state:', codeVerifier ? 'present' : 'missing');
    
    if (!codeVerifier) {
      throw new Error('PKCE code verifier not found in stored state');
    }
    
    console.log('Retrieved PKCE code verifier from stored state');
    
    // Verify state (this will delete the state)
    console.log('Verifying OAuth state...');
    const stateData = verifyOAuthState(state);
    console.log('State verification successful:', stateData);
    
    // Initialize Etsy service
    console.log('Initializing Etsy service...');
    await etsyService.initialize({
      client_id: process.env.ETSY_CLIENT_ID,
      client_secret: process.env.ETSY_CLIENT_SECRET,
      redirect_uri: process.env.ETSY_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/auth/etsy/callback`
    });
    
    // Exchange code for tokens with PKCE
    console.log('Exchanging code for tokens with PKCE...');
    const tokens = await etsyService.authenticateWithCode(code, codeVerifier);
    console.log('Token exchange successful');
    
    // Add delay to ensure tokens are set
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Get user info
    console.log('Getting user info...');
    const userInfo = await etsyService.getUserInfo();
    console.log('User info retrieved successfully');
    
    // Get user shop
    console.log('Getting user shop...');
    const shop = await etsyService.getUserShop();
    console.log('User shop retrieved successfully');
    
    let sessionData;
    
    if (stateData.userId === 'anonymous') {
      // Create new user session
      console.log('Creating new user session...');
      sessionData = await createUserSession(userInfo.email || `etsy_${userInfo.user_id}@etsy.local`, {
        name: userInfo.first_name + ' ' + userInfo.last_name,
        etsyUserId: userInfo.user_id
      });
      console.log('New user session created:', sessionData.userId);
    } else {
      // Update existing session
      console.log('Updating existing session...');
      sessionData = { userId: stateData.userId };
    }
    
    // Store Etsy authentication in session
    console.log('Storing Etsy authentication in session...');
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
    console.log('Etsy authentication stored successfully');
    
    // Redirect to frontend with success
    const redirectUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
    const finalUrl = `${redirectUrl}/settings.html?auth=success&service=etsy&token=${sessionData.accessToken || 'existing'}&shop=${encodeURIComponent(shop.shop_name)}`;
    console.log('Redirecting to:', finalUrl);
    res.redirect(finalUrl);
    
  } catch (error) {
    console.error('Etsy OAuth callback error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    const redirectUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
    res.redirect(`${redirectUrl}/settings.html?auth=error&service=etsy&error=${encodeURIComponent(error.message)}`);
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