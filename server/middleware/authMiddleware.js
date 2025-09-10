const jwt = require('jsonwebtoken');
const { APIError } = require('./errorHandler');

/**
 * JWT Secret - In production, this should be a secure random string
 */
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

/**
 * In-memory token storage (in production, use Redis or database)
 */
const tokenStore = new Map();
const refreshTokenStore = new Map();

/**
 * Generate JWT token
 */
function generateToken(payload, expiresIn = JWT_EXPIRES_IN) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

/**
 * Generate refresh token
 */
function generateRefreshToken(userId) {
  const refreshToken = jwt.sign({ userId, type: 'refresh' }, JWT_SECRET, { 
    expiresIn: REFRESH_TOKEN_EXPIRES_IN 
  });
  
  // Store refresh token
  refreshTokenStore.set(refreshToken, {
    userId,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  });
  
  return refreshToken;
}

/**
 * Verify JWT token
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new APIError('Token expired', 401, 'TOKEN_EXPIRED');
    } else if (error.name === 'JsonWebTokenError') {
      throw new APIError('Invalid token', 401, 'INVALID_TOKEN');
    }
    throw new APIError('Token verification failed', 401, 'TOKEN_VERIFICATION_FAILED');
  }
}

/**
 * Store user session data
 */
function storeUserSession(userId, sessionData) {
  tokenStore.set(userId, {
    ...sessionData,
    lastActivity: new Date(),
    createdAt: new Date()
  });
}

/**
 * Get user session data
 */
function getUserSession(userId) {
  return tokenStore.get(userId);
}

/**
 * Update user session
 */
function updateUserSession(userId, updates) {
  const existing = tokenStore.get(userId) || {};
  tokenStore.set(userId, {
    ...existing,
    ...updates,
    lastActivity: new Date()
  });
}

/**
 * Remove user session
 */
function removeUserSession(userId) {
  tokenStore.delete(userId);
  
  // Remove associated refresh tokens
  for (const [token, data] of refreshTokenStore.entries()) {
    if (data.userId === userId) {
      refreshTokenStore.delete(token);
    }
  }
}

/**
 * Authentication middleware - verifies JWT token
 */
function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new APIError('Authorization token required', 401, 'MISSING_TOKEN');
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const decoded = verifyToken(token);
    
    // Check if user session exists
    const session = getUserSession(decoded.userId);
    if (!session) {
      throw new APIError('Session not found', 401, 'SESSION_NOT_FOUND');
    }
    
    // Update last activity
    updateUserSession(decoded.userId, { lastActivity: new Date() });
    
    // Add user info to request
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      session
    };
    
    next();
  } catch (error) {
    if (error instanceof APIError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }
    
    return res.status(401).json({
      success: false,
      error: 'Authentication failed',
      code: 'AUTH_FAILED'
    });
  }
}

/**
 * Optional authentication middleware - doesn't fail if no token
 */
function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyToken(token);
      const session = getUserSession(decoded.userId);
      
      if (session) {
        updateUserSession(decoded.userId, { lastActivity: new Date() });
        req.user = {
          id: decoded.userId,
          email: decoded.email,
          session
        };
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication for optional auth
    next();
  }
}

/**
 * Require specific service authentication
 */
function requireServiceAuth(serviceName) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }
    
    const session = req.user.session;
    const serviceAuth = session[`${serviceName}Auth`];
    
    if (!serviceAuth || !serviceAuth.accessToken) {
      return res.status(401).json({
        success: false,
        error: `${serviceName} authentication required`,
        code: `${serviceName.toUpperCase()}_AUTH_REQUIRED`,
        authUrl: `/api/auth/${serviceName.toLowerCase()}`
      });
    }
    
    // Check if token is expired
    if (serviceAuth.expiresAt && new Date() > new Date(serviceAuth.expiresAt)) {
      return res.status(401).json({
        success: false,
        error: `${serviceName} token expired`,
        code: `${serviceName.toUpperCase()}_TOKEN_EXPIRED`,
        authUrl: `/api/auth/${serviceName.toLowerCase()}`
      });
    }
    
    req.serviceAuth = serviceAuth;
    next();
  };
}

/**
 * Middleware to check Google Drive authentication
 */
const requireGoogleAuth = requireServiceAuth('google');

/**
 * Middleware to check Etsy authentication
 */
const requireEtsyAuth = requireServiceAuth('etsy');

/**
 * Clean up expired sessions and tokens
 */
function cleanupExpiredSessions() {
  const now = new Date();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  
  // Clean up expired user sessions
  for (const [userId, session] of tokenStore.entries()) {
    if (now - session.lastActivity > maxAge) {
      tokenStore.delete(userId);
    }
  }
  
  // Clean up expired refresh tokens
  for (const [token, data] of refreshTokenStore.entries()) {
    if (now > data.expiresAt) {
      refreshTokenStore.delete(token);
    }
  }
}

// Run cleanup every hour (only in production)
let cleanupInterval;
if (process.env.NODE_ENV === 'production') {
  cleanupInterval = setInterval(cleanupExpiredSessions, 60 * 60 * 1000);
}

// Export cleanup function for testing
const stopCleanup = () => {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
};

module.exports = {
  generateToken,
  generateRefreshToken,
  verifyToken,
  storeUserSession,
  getUserSession,
  updateUserSession,
  removeUserSession,
  requireAuth,
  optionalAuth,
  requireGoogleAuth,
  requireEtsyAuth,
  requireServiceAuth,
  cleanupExpiredSessions,
  stopCleanup
};