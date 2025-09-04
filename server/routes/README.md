# API Routes Implementation

## Overview

This document describes the implementation of the main API endpoints and request orchestration for the Etsy Listing Management application.

## Implemented Components

### 1. Main Express Application (`server/app.js`)

- **Security**: Helmet middleware for security headers
- **CORS**: Configured for frontend communication
- **Body Parsing**: JSON and URL-encoded with 50MB limit
- **Static Files**: Serves client directory
- **Error Handling**: Global error handler with detailed responses
- **404 Handling**: Custom 404 handler for API routes

### 2. API Router (`server/routes/api.js`)

#### Main Upload Endpoint
- **POST /api/upload**: Main processing endpoint that orchestrates all services
- **Features**:
  - File validation and processing
  - Progress tracking with unique processing IDs
  - Asynchronous processing pipeline
  - Service coordination (Image, File, Google Drive, AI, Etsy)
  - Comprehensive error handling

#### Processing Status
- **GET /api/status/:processingId**: Returns real-time processing status
- **Features**:
  - Step-by-step progress tracking
  - Error reporting for individual steps
  - Processing time tracking

#### Settings Management
- **GET /api/settings**: Load user settings
- **PUT /api/settings**: Save complete settings
- **PATCH /api/settings/:section**: Update specific settings section
- **Features**:
  - User-specific settings (default user support)
  - Validation and error handling
  - Section-based updates

#### Authentication Endpoints
- **GET /api/auth/google**: Initiate Google Drive OAuth
- **GET /api/auth/google/callback**: Handle Google OAuth callback
- **GET /api/auth/etsy**: Initiate Etsy OAuth
- **GET /api/auth/etsy/callback**: Handle Etsy OAuth callback
- **Features**:
  - OAuth 2.0 flow handling
  - Configuration validation
  - Token management

#### Health Check
- **GET /api/health**: System health and service status
- **Features**:
  - Service availability status
  - Configuration status for external services
  - Timestamp and system information

### 3. Error Handling Middleware (`server/middleware/errorHandler.js`)

#### Custom Error Class
- **APIError**: Structured error class with status codes and details
- **Features**:
  - Consistent error formatting
  - Error codes and timestamps
  - Development vs production error details

#### Error Handlers
- **errorHandler**: Main error handling middleware
- **notFoundHandler**: 404 handler for API routes
- **asyncHandler**: Wrapper for async route handlers
- **Features**:
  - Comprehensive error logging
  - Environment-specific error details
  - Structured error responses

### 4. Request Orchestration

#### Processing Pipeline
The main upload endpoint orchestrates the following services in sequence:

1. **Validation**: File type, size, and security validation
2. **Settings Loading**: User preferences and configuration
3. **Image Processing**: Watermarking with user settings
4. **Collage Creation**: Multi-image collage generation (if enabled)
5. **File Packaging**: ZIP archive creation of original files
6. **Google Drive Upload**: Secure cloud storage (if configured)
7. **AI Metadata Generation**: Title, tags, and description generation
8. **Etsy Listing Creation**: Draft listing with processed assets (if configured)
9. **Finalization**: Results compilation and cleanup

#### Progress Tracking
- Real-time status updates for each processing step
- Error tracking and recovery mechanisms
- Processing time measurement
- Detailed step information

#### Error Recovery
- Graceful degradation when external services fail
- Fallback mechanisms for Google Drive and Etsy API failures
- Partial processing completion support
- Comprehensive error reporting

## Testing

### Unit Tests (`server/routes/__tests__/api.test.js`)
- Service mocking and isolation testing
- Endpoint behavior validation
- Error handling verification

### Integration Tests (`server/routes/__tests__/api.integration.test.js`)
- End-to-end API testing
- Real service integration
- File upload and processing validation

### Core Functionality Tests (`server/routes/__tests__/api.simple.test.js`)
- Basic API functionality
- Error handling middleware
- Security headers and CORS
- Health check validation

## Configuration

### Environment Variables
- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret
- `GOOGLE_REDIRECT_URI`: Google OAuth redirect URI
- `ETSY_CLIENT_ID`: Etsy OAuth client ID
- `ETSY_CLIENT_SECRET`: Etsy OAuth client secret
- `ETSY_REDIRECT_URI`: Etsy OAuth redirect URI
- `GOOGLE_AI_API_KEY`: Google Gemini AI API key
- `NODE_ENV`: Environment (development/production)
- `PORT`: Server port (default: 3000)

### Service Dependencies
- **ImageService**: Image processing and watermarking
- **FileService**: File management and ZIP creation
- **GoogleDriveService**: Cloud storage integration
- **AIService**: Metadata generation with Google Gemini
- **EtsyService**: Etsy marketplace integration
- **SettingsService**: User preferences management

## Security Features

### File Upload Security
- File type validation (JPEG, PNG, WebP only)
- File size limits (10MB maximum)
- Filename sanitization
- Security scanning for malicious patterns

### Authentication Security
- OAuth 2.0 for external service authentication
- Secure token storage and refresh
- Environment-based configuration
- CORS protection

### Error Handling Security
- Sanitized error messages in production
- Detailed logging for debugging
- No sensitive information exposure
- Rate limiting support

## Performance Considerations

### Asynchronous Processing
- Non-blocking upload processing
- Progress tracking without blocking
- Efficient resource utilization
- Automatic cleanup of temporary files

### Memory Management
- Streaming file processing where possible
- Temporary file cleanup
- Buffer management for large files
- Service instance reuse

### Scalability
- Stateless design for horizontal scaling
- Processing status stored in memory (can be moved to Redis)
- Service-oriented architecture
- Configurable processing limits

## Future Enhancements

### Recommended Improvements
1. **Database Integration**: Persistent storage for processing status and user data
2. **Queue System**: Redis-based job queue for high-volume processing
3. **Caching**: Response caching for frequently accessed data
4. **Rate Limiting**: Request rate limiting per user/IP
5. **Monitoring**: Application performance monitoring and alerting
6. **WebSocket Support**: Real-time progress updates via WebSocket
7. **Batch Processing**: Support for bulk operations
8. **API Versioning**: Version management for API evolution

### Security Enhancements
1. **JWT Authentication**: User session management
2. **API Key Management**: Service-to-service authentication
3. **Input Sanitization**: Enhanced input validation
4. **Audit Logging**: Comprehensive audit trail
5. **Encryption**: Data encryption at rest and in transit