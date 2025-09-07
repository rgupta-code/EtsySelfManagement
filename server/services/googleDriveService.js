const { google } = require('googleapis');
const fs = require('fs').promises;
const path = require('path');

class GoogleDriveService {
  constructor() {
    this.oauth2Client = null;
    this.drive = null;
    this.credentials = null;
    this.tokens = null;
  }

  /**
   * Initialize OAuth 2.0 client with credentials
   * @param {Object} credentials - OAuth credentials from Google Console
   */
  async initialize(credentials) {
    if (!credentials || !credentials.client_id || !credentials.client_secret) {
      throw new Error('Invalid Google OAuth credentials provided');
    }

    console.log('Initializing Google Drive Service with credentials:', {
      client_id: credentials.client_id ? 'present' : 'missing',
      client_secret: credentials.client_secret ? 'present' : 'missing',
      redirect_uri: credentials.redirect_uri
    });

    this.credentials = credentials;
    this.oauth2Client = new google.auth.OAuth2(
      credentials.client_id,
      credentials.client_secret,
      credentials.redirect_uri || 'http://localhost:3000/api/auth/google/callback'
    );

    console.log('OAuth2 client created:', {
      clientId: this.oauth2Client._clientId,
      redirectUri: this.oauth2Client._redirectUri,
      credentials: this.oauth2Client.credentials
    });

    // Set up Drive API client
    this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
    console.log('Drive API client created');
  }

  /**
   * Generate OAuth 2.0 authorization URL
   * @param {string} state - Optional state parameter for security
   * @returns {string} Authorization URL for user consent
   */
  getAuthUrl(state = null) {
    if (!this.oauth2Client) {
      throw new Error('OAuth client not initialized');
    }

    console.log('GoogleDriveService.getAuthUrl called with state:', state);

    const scopes = [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ];

    const authOptions = {
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    };

    // Add state parameter if provided
    if (state) {
      authOptions.state = state;
      console.log('Added state to auth options:', state);
    }

    const authUrl = this.oauth2Client.generateAuthUrl(authOptions);
    console.log('Generated Google auth URL:', authUrl);
    console.log('Auth options used:', authOptions);

    return authUrl;
  }

  /**
   * Exchange authorization code for access tokens
   * @param {string} code - Authorization code from OAuth callback
   */
  async authenticateWithCode(code) {
    if (!this.oauth2Client) {
      throw new Error('OAuth client not initialized');
    }

    console.log('Authenticating with code:', code ? 'present' : 'missing');
    console.log('OAuth client credentials before:', this.oauth2Client.credentials);

    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      console.log('Received tokens:', {
        access_token: tokens.access_token ? 'present' : 'missing',
        refresh_token: tokens.refresh_token ? 'present' : 'missing',
        expires_in: tokens.expires_in,
        token_type: tokens.token_type
      });
      
      this.oauth2Client.setCredentials(tokens);
      this.tokens = tokens;
      
      console.log('OAuth client credentials after:', this.oauth2Client.credentials);
      console.log('Stored tokens:', this.tokens);
      
      return tokens;
    } catch (error) {
      console.error('Authentication error:', error);
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  /**
   * Set existing tokens for authenticated requests
   * @param {Object} tokens - Previously obtained OAuth tokens
   */
  setTokens(tokens) {
    if (!this.oauth2Client) {
      throw new Error('OAuth client not initialized');
    }

    this.oauth2Client.setCredentials(tokens);
    this.tokens = tokens;
  }

  /**
   * Set access token for authenticated requests
   * @param {string} accessToken - Access token
   */
  setAccessToken(accessToken) {
    if (!this.oauth2Client) {
      throw new Error('OAuth client not initialized');
    }

    this.oauth2Client.setCredentials({ access_token: accessToken });
    this.tokens = { access_token: accessToken };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken() {
    if (!this.oauth2Client || !this.tokens?.refresh_token) {
      throw new Error('No refresh token available');
    }

    try {
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      this.oauth2Client.setCredentials(credentials);
      this.tokens = { ...this.tokens, ...credentials };
      return credentials;
    } catch (error) {
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  /**
   * Create or get a folder in Google Drive
   * @param {string} folderName - Name of the folder to create/find
   * @param {string} parentFolderId - Parent folder ID (optional)
   * @returns {string} Folder ID
   */
  async createOrGetFolder(folderName, parentFolderId = null) {
    if (!this.drive) {
      throw new Error('Google Drive client not initialized');
    }

    try {
      // Search for existing folder
      const query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      const searchParams = {
        q: parentFolderId ? `${query} and '${parentFolderId}' in parents` : query,
        fields: 'files(id, name)'
      };

      const searchResponse = await this.drive.files.list(searchParams);
      
      if (searchResponse.data.files && searchResponse.data.files.length > 0) {
        return searchResponse.data.files[0].id;
      }

      // Create new folder if not found
      const folderMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentFolderId ? [parentFolderId] : undefined
      };

      const createResponse = await this.drive.files.create({
        resource: folderMetadata,
        fields: 'id'
      });

      return createResponse.data.id;
    } catch (error) {
      throw new Error(`Failed to create/get folder: ${error.message}`);
    }
  }  /**

   * Upload a ZIP file to Google Drive
   * @param {Buffer} zipBuffer - ZIP file buffer
   * @param {string} filename - Name for the uploaded file
   * @param {string} folderId - Target folder ID (optional)
   * @returns {Object} Upload result with file ID and metadata
   */
  async uploadZipFile(zipBuffer, filename, folderId = null) {
    if (!this.drive) {
      throw new Error('Google Drive client not initialized');
    }

    if (!zipBuffer || !Buffer.isBuffer(zipBuffer)) {
      throw new Error('Invalid ZIP buffer provided');
    }

    if (!filename || typeof filename !== 'string') {
      throw new Error('Invalid filename provided');
    }

    try {
      const fileMetadata = {
        name: filename,
        parents: folderId ? [folderId] : undefined
      };

      const media = {
        mimeType: 'application/zip',
        body: require('stream').Readable.from(zipBuffer)
      };

      const response = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id, name, size, createdTime, webViewLink'
      });

      return {
        fileId: response.data.id,
        name: response.data.name,
        size: response.data.size,
        createdTime: response.data.createdTime,
        webViewLink: response.data.webViewLink
      };
    } catch (error) {
      throw new Error(`Failed to upload ZIP file: ${error.message}`);
    }
  }

  /**
   * Create a shareable link for a file
   * @param {string} fileId - Google Drive file ID
   * @param {string} role - Permission role ('reader', 'writer', 'commenter')
   * @returns {string} Shareable link URL
   */
  async createShareableLink(fileId, role = 'reader') {
    if (!this.drive) {
      throw new Error('Google Drive client not initialized');
    }

    if (!fileId || typeof fileId !== 'string') {
      throw new Error('Invalid file ID provided');
    }

    try {
      // Create permission for anyone with the link
      await this.drive.permissions.create({
        fileId: fileId,
        resource: {
          role: role,
          type: 'anyone'
        }
      });

      // Get the file metadata with webViewLink
      const fileResponse = await this.drive.files.get({
        fileId: fileId,
        fields: 'webViewLink, webContentLink'
      });

      return fileResponse.data.webViewLink;
    } catch (error) {
      throw new Error(`Failed to create shareable link: ${error.message}`);
    }
  }

  /**
   * Get file metadata from Google Drive
   * @param {string} fileId - Google Drive file ID
   * @returns {Object} File metadata
   */
  async getFileMetadata(fileId) {
    if (!this.drive) {
      throw new Error('Google Drive client not initialized');
    }

    try {
      const response = await this.drive.files.get({
        fileId: fileId,
        fields: 'id, name, size, mimeType, createdTime, modifiedTime, webViewLink, webContentLink'
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to get file metadata: ${error.message}`);
    }
  }

  /**
   * Delete a file from Google Drive
   * @param {string} fileId - Google Drive file ID
   */
  async deleteFile(fileId) {
    if (!this.drive) {
      throw new Error('Google Drive client not initialized');
    }

    try {
      await this.drive.files.delete({
        fileId: fileId
      });
    } catch (error) {
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * Check if the service is authenticated
   * @returns {boolean} Authentication status
   */
  isAuthenticated() {
    return !!(this.oauth2Client && this.tokens && this.tokens.access_token);
  }

  /**
   * Get current authentication tokens
   * @returns {Object|null} Current tokens or null if not authenticated
   */
  getTokens() {
    return this.tokens;
  }

  /**
   * Verify access token is valid
   * @param {string} accessToken - Access token to verify
   * @returns {boolean} True if token is valid
   */
  async verifyAccessToken(accessToken) {
    try {
      const axios = require('axios');
      const response = await axios.get('https://www.googleapis.com/oauth2/v1/tokeninfo', {
        params: {
          access_token: accessToken
        }
      });
      console.log('Token verification successful:', response.data);
      return true;
    } catch (error) {
      console.error('Token verification failed:', error.message);
      return false;
    }
  }

  /**
   * Get user information from Google
   * @returns {Object} User information
   */
  async getUserInfo() {
    if (!this.oauth2Client) {
      throw new Error('OAuth client not initialized');
    }

    console.log('Getting user info...');
    console.log('OAuth client credentials:', this.oauth2Client.credentials);
    console.log('Stored tokens:', this.tokens);

    // First try: Use the stored access token directly
    if (this.tokens?.access_token) {
      console.log('Attempting direct API call with stored access token...');
      console.log('Access token (first 20 chars):', this.tokens.access_token.substring(0, 20) + '...');
      
      // Verify token first
      const isValid = await this.verifyAccessToken(this.tokens.access_token);
      if (!isValid) {
        console.error('Access token is invalid or expired');
      } else {
        try {
          const axios = require('axios');
          const response = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
              'Authorization': `Bearer ${this.tokens.access_token}`
            }
          });
          console.log('Direct API call successful:', response.data);
          return response.data;
        } catch (directError) {
          console.error('Direct API call failed:', directError.message);
          console.error('Direct API call error details:', {
            status: directError.response?.status,
            statusText: directError.response?.statusText,
            data: directError.response?.data
          });
        }
      }
    } else {
      console.log('No access token available in stored tokens');
    }

    // Second try: Use OAuth2 client
    try {
      console.log('Attempting OAuth2 client method...');
      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
      console.log('Created OAuth2 client for userinfo');
      
      const response = await oauth2.userinfo.get();
      console.log('OAuth2 client method successful:', response.data);
      
      return response.data;
    } catch (error) {
      console.error('OAuth2 client method failed:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        status: error.status
      });
      
      throw new Error(`Failed to get user info: ${error.message}`);
    }
  }

  /**
   * Get user email (convenience method)
   * @returns {string|null} User email or null if not authenticated
   */
  getUserEmail() {
    return this.tokens?.email || null;
  }

  /**
   * Clear authentication tokens
   */
  clearTokens() {
    this.tokens = null;
    if (this.oauth2Client) {
      this.oauth2Client.setCredentials({});
    }
  }
}

module.exports = GoogleDriveService;