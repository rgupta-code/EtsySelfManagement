#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Development environment setup script
 * Ensures all necessary directories and files exist for development
 */

console.log('🚀 Setting up development environment...');

// Directories to ensure exist
const directories = [
  'temp',
  'coverage',
  'dist',
  'data/settings',
  'test-data'
];

// Create directories if they don't exist
directories.forEach(dir => {
  const dirPath = path.join(__dirname, '..', dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`✅ Created directory: ${dir}`);
  } else {
    console.log(`📁 Directory exists: ${dir}`);
  }
});

// Check for required environment files
const envTemplate = path.join(__dirname, '..', '.env.template');
const envFile = path.join(__dirname, '..', '.env');
const envTestFile = path.join(__dirname, '..', '.env.test');

if (fs.existsSync(envTemplate) && !fs.existsSync(envFile)) {
  fs.copyFileSync(envTemplate, envFile);
  console.log('✅ Created .env file from template');
  console.log('⚠️  Please update .env file with your actual API keys and configuration');
}

if (fs.existsSync(envTemplate) && !fs.existsSync(envTestFile)) {
  // Create test environment file with safe defaults
  const testEnvContent = `# Test Environment Configuration
NODE_ENV=test
PORT=3002
FRONTEND_URL=http://localhost:3002

# Test API Keys (use test/mock values)
GOOGLE_CLIENT_ID=test_client_id
GOOGLE_CLIENT_SECRET=test_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3002/api/auth/google/callback

ETSY_CLIENT_ID=test_etsy_client_id
ETSY_CLIENT_SECRET=test_etsy_client_secret
ETSY_REDIRECT_URI=http://localhost:3002/api/auth/etsy/callback

GEMINI_API_KEY=test_gemini_key

# JWT Secret for tests
JWT_SECRET=test_jwt_secret_key_for_development_only

# Test Database/Storage
TEMP_DIR=./temp
`;
  
  fs.writeFileSync(envTestFile, testEnvContent);
  console.log('✅ Created .env.test file with test defaults');
}

// Create gitkeep files for empty directories that should be tracked
const gitkeepDirs = ['temp', 'test-data'];
gitkeepDirs.forEach(dir => {
  const gitkeepPath = path.join(__dirname, '..', dir, '.gitkeep');
  if (!fs.existsSync(gitkeepPath)) {
    fs.writeFileSync(gitkeepPath, '# This file ensures the directory is tracked by git\n');
    console.log(`✅ Created .gitkeep in ${dir}`);
  }
});

// Verify package.json scripts
const packageJson = require('../package.json');
const requiredScripts = ['dev', 'test', 'build', 'lint'];
const missingScripts = requiredScripts.filter(script => !packageJson.scripts[script]);

if (missingScripts.length > 0) {
  console.warn(`⚠️  Missing npm scripts: ${missingScripts.join(', ')}`);
} else {
  console.log('✅ All required npm scripts are present');
}

console.log('🎉 Development environment setup complete!');
console.log('\n📋 Next steps:');
console.log('1. Update .env file with your API keys');
console.log('2. Run "npm install" to install dependencies');
console.log('3. Run "npm run dev" to start development server');
console.log('4. Run "npm test" to run the test suite');