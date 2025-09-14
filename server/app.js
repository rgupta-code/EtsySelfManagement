const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const contactRoutes = require('./routes/contact');
const { handleUploadErrors } = require('./middleware/uploadMiddleware');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware - disable CSP in development for easier debugging
if (process.env.NODE_ENV === 'production') {
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            'https://cdn.tailwindcss.com',
            'https://cdnjs.cloudflare.com',
          ],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'",
            "'unsafe-eval'",
            'https://cdn.tailwindcss.com',
            'https://cdnjs.cloudflare.com',
            'https://cdn.jsdelivr.net',
          ],
          fontSrc: ["'self'", 'https://cdnjs.cloudflare.com'],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          connectSrc: ["'self'", 'https://api.emailjs.com'],
        },
      },
    })
  );
} else {
  // In development, use helmet without CSP to avoid blocking external resources
  app.use(
    helmet({
      contentSecurityPolicy: false,
    })
  );
}

// CORS configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
  })
);

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Add request logging middleware for debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Serve static files from client directory
const clientPath = path.join(__dirname, '../client');
console.log('Serving static files from:', clientPath);
app.use(express.static(clientPath));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api', apiRoutes);

// Handle 404 for API routes
app.use('/api/*', notFoundHandler);

// Global error handling middleware
app.use(errorHandler);

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
