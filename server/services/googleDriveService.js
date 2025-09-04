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

    this.credentials = credentials;
    this.oauth2Client = new google.auth.OAuth2(
      credentials.client_id,
      credentials.client_secret,
      credentials.redirect_uri || 'http://localhost:3000/api/auth/google/callback'
    );

    // Set up Drive API client
    this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
  }

  /**
   * Generate OAuth 2.0 authorization URL
   * @returns {string} Authorization URL for user consent
   */
  getAuthUrl() {
    if (!this.oauth2Client) {
      throw new Error('OAuth client not initialized');
    }

    const scopes = [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive.readonly'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }

  /**
   * Exchange authorization code for access tokens
   * @param {string} code - Authorization code from OAuth callback
   */
  async authenticateWithCode(code) {
    if (!this.oauth2Client) {
      throw new Error('OAuth client not initialized');
    }

    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);
      this.tokens = tokens;
      return tokens;
    } catch (error) {
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