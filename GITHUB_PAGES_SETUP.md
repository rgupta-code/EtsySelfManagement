# GitHub Pages Deployment Guide

This guide explains how to deploy the ListGenie frontend as a static site on GitHub Pages.

## Overview

The ListGenie application consists of:
- **Frontend**: Static HTML/CSS/JS with Tailwind CSS (can run standalone)
- **Backend**: Node.js/Express server (required for full functionality)

GitHub Pages deployment creates a **demo version** with simulated functionality.

## Deployment Steps

### 1. Repository Setup

1. Push your code to a GitHub repository
2. Make sure the repository is public (required for free GitHub Pages)

### 2. Enable GitHub Pages

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Pages**
3. Under "Source", select **GitHub Actions**
4. The workflow will automatically deploy when you push to main/master

### 3. Automatic Deployment

The included GitHub Actions workflow (`.github/workflows/deploy.yml`) will:
- Install dependencies
- Build the client files
- Deploy to GitHub Pages
- Your site will be available at: `https://yourusername.github.io/repositoryname`

## What Works in Static Mode

✅ **Fully Functional:**
- Navigation between pages
- UI components and styling
- Form interfaces
- Settings page (with local storage)

⚠️ **Simulated/Demo Mode:**
- File upload (shows progress but doesn't process)
- API calls (return mock responses)
- Authentication flows (demo only)

❌ **Not Available:**
- Actual image processing
- Google Drive integration
- Etsy API integration
- AI-generated content

## Configuration

### Custom Domain (Optional)

To use a custom domain:
1. Add a `CNAME` file to the `client/` directory with your domain
2. Configure DNS settings with your domain provider

### Environment Variables

For static deployment, sensitive configuration is handled client-side:
- API endpoints default to demo mode
- No server-side environment variables needed

## Development vs Production

| Feature | Local Development | GitHub Pages |
|---------|------------------|--------------|
| Backend API | ✅ Full functionality | ❌ Mock responses |
| File Upload | ✅ Real processing | ⚠️ Simulated |
| Authentication | ✅ OAuth flows | ⚠️ Demo mode |
| Database | ✅ Real data | ❌ Local storage only |

## Updating the Site

1. Make changes to files in the `client/` directory
2. Commit and push to main/master branch
3. GitHub Actions will automatically rebuild and deploy
4. Changes appear at your GitHub Pages URL within a few minutes

## Troubleshooting

### Build Failures
- Check the Actions tab in your GitHub repository
- Ensure all dependencies are listed in `package.json`
- Verify the build script runs locally: `npm run build:static`

### Missing Assets
- Ensure all referenced files exist in the `client/` directory
- Check that paths are relative (no leading `/`)
- Verify images and CSS files are included

### Demo Notice Not Showing
The demo notice should automatically appear on GitHub Pages. If not:
- Check browser console for JavaScript errors
- Verify the detection logic in each HTML file

## Local Testing

To test the static build locally:

```bash
# Build the static files
npm run build:static

# Serve the dist directory
npx serve dist
# or
python -m http.server 8000 -d dist
```

## Repository Structure for GitHub Pages

```
your-repo/
├── .github/workflows/deploy.yml  # Deployment workflow
├── client/                       # Source files
│   ├── *.html                   # HTML pages
│   ├── css/                     # Stylesheets
│   ├── js/                      # JavaScript files
│   └── images/                  # Static assets
├── dist/                        # Built files (auto-generated)
└── package.json                 # Dependencies and scripts
```

The `dist/` directory is automatically created during build and contains the files served by GitHub Pages.