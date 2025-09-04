#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Build script for client assets
 * Since we're using vanilla HTML/JS/CSS with Tailwind CDN,
 * this script primarily validates and optimizes client files
 */

const clientDir = path.join(__dirname, '../client');
const distDir = path.join(__dirname, '../dist');

console.log('🏗️  Building client assets...');

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Copy client files to dist (for production builds)
function copyClientFiles() {
  const files = fs.readdirSync(clientDir, { withFileTypes: true });
  
  files.forEach(file => {
    const srcPath = path.join(clientDir, file.name);
    const destPath = path.join(distDir, file.name);
    
    if (file.isDirectory()) {
      // Recursively copy directories
      if (!fs.existsSync(destPath)) {
        fs.mkdirSync(destPath, { recursive: true });
      }
      copyDirectory(srcPath, destPath);
    } else {
      // Copy files
      fs.copyFileSync(srcPath, destPath);
      console.log(`✅ Copied: ${file.name}`);
    }
  });
}

function copyDirectory(src, dest) {
  const files = fs.readdirSync(src, { withFileTypes: true });
  
  files.forEach(file => {
    const srcPath = path.join(src, file.name);
    const destPath = path.join(dest, file.name);
    
    if (file.isDirectory()) {
      if (!fs.existsSync(destPath)) {
        fs.mkdirSync(destPath, { recursive: true });
      }
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  });
}

// Validate HTML files
function validateHtmlFiles() {
  const htmlFiles = fs.readdirSync(clientDir)
    .filter(file => file.endsWith('.html'));
  
  htmlFiles.forEach(file => {
    const filePath = path.join(clientDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Basic HTML validation
    if (!content.includes('<!DOCTYPE html>')) {
      console.warn(`⚠️  Warning: ${file} missing DOCTYPE declaration`);
    }
    
    if (!content.includes('<title>')) {
      console.warn(`⚠️  Warning: ${file} missing title tag`);
    }
    
    console.log(`✅ Validated: ${file}`);
  });
}

// Validate JavaScript files
function validateJsFiles() {
  const jsDir = path.join(clientDir, 'js');
  
  if (!fs.existsSync(jsDir)) {
    console.log('📁 No JS directory found, skipping JS validation');
    return;
  }
  
  const jsFiles = fs.readdirSync(jsDir)
    .filter(file => file.endsWith('.js'));
  
  jsFiles.forEach(file => {
    const filePath = path.join(jsDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Basic syntax check (very simple)
    try {
      // This won't catch all syntax errors but will catch some basic ones
      new Function(content);
      console.log(`✅ Validated: js/${file}`);
    } catch (error) {
      console.error(`❌ Syntax error in js/${file}:`, error.message);
      process.exit(1);
    }
  });
}

// Main build process
async function build() {
  try {
    console.log('📋 Validating HTML files...');
    validateHtmlFiles();
    
    console.log('📋 Validating JavaScript files...');
    validateJsFiles();
    
    console.log('📦 Copying client files to dist...');
    copyClientFiles();
    
    console.log('✨ Client build completed successfully!');
    
    // Create build info file
    const buildInfo = {
      timestamp: new Date().toISOString(),
      version: require('../package.json').version,
      environment: process.env.NODE_ENV || 'development'
    };
    
    fs.writeFileSync(
      path.join(distDir, 'build-info.json'),
      JSON.stringify(buildInfo, null, 2)
    );
    
    console.log('📄 Build info created');
    
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }
}

// Run build if called directly
if (require.main === module) {
  build();
}

module.exports = { build };