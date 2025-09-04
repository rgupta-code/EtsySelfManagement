# Development Guide

## Quick Start

```bash
# Install dependencies and set up development environment
npm install

# Start development server with hot reloading
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## Available Scripts

### Development Scripts

- **`npm run dev`** - Start development server with hot reloading for both server and client files
- **`npm run dev:server`** - Start server only with hot reloading (watches server files only)
- **`npm run dev:client`** - Client development info (files are served statically)
- **`npm run dev:full`** - Alias for `npm run dev`

### Build Scripts

- **`npm run build`** - Full production build (client + server)
- **`npm run build:client`** - Build and validate client assets
- **`npm run build:server`** - Server build (currently no-op as we use vanilla Node.js)
- **`npm run prebuild`** - Runs before build (lint + test)
- **`npm run postbuild`** - Runs after build (success message)

### Test Scripts

- **`npm test`** - Run all tests
- **`npm run test:watch`** - Run tests in watch mode
- **`npm run test:coverage`** - Run tests with coverage report
- **`npm run test:ci`** - Run tests for CI (no watch, with coverage)
- **`npm run test:integration`** - Run integration tests only
- **`npm run test:unit`** - Run unit tests only

### Code Quality Scripts

- **`npm run lint`** - Run ESLint
- **`npm run lint:fix`** - Run ESLint with auto-fix
- **`npm run format`** - Format code with Prettier
- **`npm run format:check`** - Check code formatting
- **`npm run validate`** - Run format check + lint + tests

### Utility Scripts

- **`npm run clean`** - Remove generated directories (coverage, dist, temp)
- **`npm run setup`** - Full setup (install + validate)
- **`npm start`** - Start production server
- **`npm run serve:prod`** - Start server in production mode

## Hot Reloading Configuration

The development server uses nodemon with the following configuration:

### Watched Files
- `server/` - All server-side code
- `client/` - All client-side code  
- `.env` - Environment configuration

### Watched Extensions
- `.js` - JavaScript files
- `.json` - JSON configuration files
- `.html` - HTML templates
- `.css` - CSS stylesheets

### Ignored Files
- `node_modules/`
- `coverage/`
- `dist/`
- `temp/`
- Test files (`*.test.js`, `*.spec.js`)

## Test Configuration

### Coverage Thresholds
- Branches: 70%
- Functions: 70%
- Lines: 70%
- Statements: 70%

### Test Types
- **Unit Tests**: `*.test.js` files (excluding integration tests)
- **Integration Tests**: `*.integration.test.js` files

### Test Environment
- Uses `.env.test` for test-specific configuration
- Timeout: 10 seconds
- Automatic cleanup of mocks between tests

## Build Process

### Client Build
1. Validates HTML files (DOCTYPE, title tags)
2. Validates JavaScript syntax
3. Copies files to `dist/` directory
4. Creates build info file with timestamp and version

### Server Build
- Currently no transpilation needed (vanilla Node.js)
- Future: Could add TypeScript compilation or other build steps

## Development Environment Setup

The `postinstall` script automatically:
1. Creates necessary directories (`temp`, `coverage`, `dist`, etc.)
2. Copies `.env.template` to `.env` if it doesn't exist
3. Creates `.env.test` with safe test defaults
4. Adds `.gitkeep` files to track empty directories
5. Verifies required npm scripts are present

## File Structure

```
├── scripts/
│   ├── build-client.js     # Client build script
│   └── dev-setup.js        # Development environment setup
├── server/                 # Server-side code
├── client/                 # Client-side code
├── coverage/              # Test coverage reports
├── dist/                  # Built assets
├── temp/                  # Temporary files
├── nodemon.json           # Nodemon configuration
├── jest.config.js         # Jest test configuration
└── DEVELOPMENT.md         # This file
```

## Environment Variables

### Development (.env)
Copy from `.env.template` and update with real values:
- API keys for Google Drive, Etsy, Gemini AI
- JWT secrets
- Port configuration

### Testing (.env.test)
Automatically created with safe test values:
- Mock API keys
- Test-specific configuration
- Separate port to avoid conflicts

## Debugging

### Server Debugging
```bash
# Start with Node.js inspector
node --inspect server/app.js

# Or with nodemon
npm run dev -- --inspect
```

### Client Debugging
- Use browser developer tools
- Files are served statically from `client/` directory
- Source maps available in development

## Performance Monitoring

### Test Performance
- Jest reports test execution times
- Coverage reports show untested code paths
- Integration tests validate end-to-end performance

### Build Performance
- Build script reports file processing times
- Validates assets before deployment

## Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   # Change port in .env file
   PORT=3002
   ```

2. **Tests failing**
   ```bash
   # Run tests with verbose output
   npm run test -- --verbose
   
   # Run specific test file
   npm test -- server/services/imageService.test.js
   ```

3. **Hot reloading not working**
   ```bash
   # Restart nodemon manually
   rs
   
   # Check nodemon configuration
   cat nodemon.json
   ```

4. **Build failures**
   ```bash
   # Clean and rebuild
   npm run clean
   npm run build
   ```

### Getting Help

1. Check this development guide
2. Review error messages in console
3. Check test output for specific failures
4. Verify environment configuration in `.env` files