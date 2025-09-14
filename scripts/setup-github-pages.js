#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

/**
 * Setup script for GitHub Pages deployment
 * Updates demo notices with the correct GitHub repository URL
 */

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function setupGitHubPages() {
  console.log('🚀 GitHub Pages Setup for ListGenie\n');
  
  try {
    // Get repository information
    const username = await question('Enter your GitHub username: ');
    const repoName = await question('Enter your repository name (default: EtsySelfManagement): ') || 'EtsySelfManagement';
    
    const githubUrl = `https://github.com/${username}/${repoName}`;
    const pagesUrl = `https://${username}.github.io/${repoName}`;
    
    console.log(`\n📋 Configuration:`);
    console.log(`   Repository: ${githubUrl}`);
    console.log(`   GitHub Pages URL: ${pagesUrl}`);
    
    const confirm = await question('\nProceed with setup? (y/N): ');
    if (confirm.toLowerCase() !== 'y') {
      console.log('Setup cancelled.');
      process.exit(0);
    }
    
    // Update HTML files with correct GitHub URL
    const htmlFiles = [
      'client/home.html',
      'client/upload.html',
      'client/settings.html',
      'client/about.html',
      'client/contact.html'
    ];
    
    let updatedFiles = 0;
    
    for (const filePath of htmlFiles) {
      if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Replace placeholder GitHub URL
        const updated = content.replace(
          /https:\/\/github\.com\/rgupta-code\/EtsySelfManagement/g,
          githubUrl
        );
        
        if (updated !== content) {
          fs.writeFileSync(filePath, updated);
          updatedFiles++;
          console.log(`✅ Updated: ${filePath}`);
        }
      }
    }
    
    // Update README with deployment info
    const readmePath = 'README.md';
    if (fs.existsSync(readmePath)) {
      let readme = fs.readFileSync(readmePath, 'utf8');
      
      // Add deployment badge if not present
      const badgeUrl = `[![Deploy to GitHub Pages](https://github.com/${username}/${repoName}/actions/workflows/deploy.yml/badge.svg)](https://github.com/${username}/${repoName}/actions/workflows/deploy.yml)`;
      
      if (!readme.includes('Deploy to GitHub Pages')) {
        readme = readme.replace(
          '# Etsy Listing Management',
          `# Etsy Listing Management\n\n${badgeUrl}\n\n🌐 **Live Demo:** [${pagesUrl}](${pagesUrl})`
        );
        
        fs.writeFileSync(readmePath, readme);
        console.log(`✅ Updated: ${readmePath}`);
        updatedFiles++;
      }
    }
    
    // Create CNAME file if custom domain is provided
    const customDomain = await question('\nEnter custom domain (optional, press Enter to skip): ');
    if (customDomain.trim()) {
      fs.writeFileSync('client/CNAME', customDomain.trim());
      console.log(`✅ Created: client/CNAME with domain ${customDomain}`);
      updatedFiles++;
    }
    
    console.log(`\n🎉 Setup complete! Updated ${updatedFiles} files.`);
    console.log('\n📋 Next steps:');
    console.log('1. Commit and push your changes to GitHub');
    console.log('2. Go to your repository Settings → Pages');
    console.log('3. Select "GitHub Actions" as the source');
    console.log(`4. Your site will be available at: ${pagesUrl}`);
    
    if (customDomain.trim()) {
      console.log(`5. Configure DNS for your custom domain: ${customDomain}`);
    }
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run setup if called directly
if (require.main === module) {
  setupGitHubPages();
}

module.exports = { setupGitHubPages };