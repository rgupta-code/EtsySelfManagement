const GoogleDriveService = require('../googleDriveService');
const { google } = require('googleapis');

// Mock googleapis for integration tests
jest.mock('googleapis');

describe('GoogleDriveService Integration Tests', () => {
  let googleDriveService;
  let mockOAuth2Client;
  let mockDrive;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock OAuth2 client
    mockOAuth2Client = {
      generateAuthUrl: jest.fn(),
      getToken: jest.fn(),
      setCredentials: jest.fn(),
      refreshAccessToken: jest.fn()
    };

    // Mock Drive API
    mockDrive = {
      files: {
        list: jest.fn(),
        create: jest.fn(),
        get: jest.fn(),
        delete: jest.fn()
      },
      permissions: {
        create: jest.fn()
      }
    };

    // Mock google.auth.OAuth2 constructor
    google.auth = {
      OAuth2: jest.fn().mockImplementation(() => mockOAuth2Client)
    };

    // Mock google.drive
    google.drive = jest.fn().mockReturnValue(mockDrive);

    googleDriveService = new GoogleDriveService();
  });

  describe('Complete workflow: authenticate, upload, and share', () => {
    it('should complete full workflow successfully', async () => {
      // Step 1: Initialize service
      const credentials = {
        client_id: 'test_client_id',
        client_secret: 'test_client_secret',
        redirect_uri: 'http://localhost:3000/callback'
      };

      await googleDriveService.initialize(credentials);

      // Step 2: Generate auth URL
      const expectedAuthUrl = 'https://accounts.google.com/oauth/authorize?test=true';
      mockOAuth2Client.generateAuthUrl.mockReturnValue(expectedAuthUrl);

      const authUrl = googleDriveService.getAuthUrl();
      expect(authUrl).toBe(expectedAuthUrl);

      // Step 3: Authenticate with code
      const authCode = 'test_auth_code';
      const mockTokens = {
        access_token: 'access_token_123',
        refresh_token: 'refresh_token_123',
        expiry_date: Date.now() + 3600000
      };

      mockOAuth2Client.getToken.mockResolvedValue({ tokens: mockTokens });
      await googleDriveService.authenticateWithCode(authCode);

      expect(googleDriveService.isAuthenticated()).toBe(true);

      // Step 4: Create/get folder
      const folderName = 'Etsy Listings';
      const folderId = 'folder_123';

      mockDrive.files.list.mockResolvedValue({
        data: { files: [] }
      });

      mockDrive.files.create.mockResolvedValue({
        data: { id: folderId }
      });

      const createdFolderId = await googleDriveService.createOrGetFolder(folderName);
      expect(createdFolderId).toBe(folderId);

      // Step 5: Upload ZIP file
      const zipBuffer = Buffer.from('fake zip content for testing');
      const filename = 'product-images-2023-12-01.zip';
      const fileId = 'file_123';

      mockDrive.files.create.mockResolvedValue({
        data: {
          id: fileId,
          name: filename,
          size: '2048',
          createdTime: '2023-12-01T10:00:00.000Z',
          webViewLink: `https://drive.google.com/file/d/${fileId}/view`
        }
      });

      const uploadResult = await googleDriveService.uploadZipFile(
        zipBuffer, 
        filename, 
        folderId
      );

      expect(uploadResult.fileId).toBe(fileId);
      expect(uploadResult.name).toBe(filename);

      // Step 6: Create shareable link
      const shareableLink = `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;

      mockDrive.permissions.create.mockResolvedValue({});
      mockDrive.files.get.mockResolvedValue({
        data: { webViewLink: shareableLink }
      });

      const resultLink = await googleDriveService.createShareableLink(fileId);
      expect(resultLink).toBe(shareableLink);

      // Verify all API calls were made correctly
      expect(mockDrive.files.create).toHaveBeenCalledWith({
        resource: {
          name: filename,
          parents: [folderId]
        },
        media: {
          mimeType: 'application/zip',
          body: expect.any(Object)
        },
        fields: 'id, name, size, createdTime, webViewLink'
      });

      expect(mockDrive.permissions.create).toHaveBeenCalledWith({
        fileId: fileId,
        resource: {
          role: 'reader',
          type: 'anyone'
        }
      });
    });

    it('should handle token refresh during workflow', async () => {
      // Initialize and authenticate
      const credentials = {
        client_id: 'test_client_id',
        client_secret: 'test_client_secret'
      };

      await googleDriveService.initialize(credentials);

      const initialTokens = {
        access_token: 'old_access_token',
        refresh_token: 'refresh_token_123',
        expiry_date: Date.now() - 1000 // Expired token
      };

      googleDriveService.setTokens(initialTokens);

      // Mock token refresh
      const newTokens = {
        access_token: 'new_access_token',
        expiry_date: Date.now() + 3600000
      };

      mockOAuth2Client.refreshAccessToken.mockResolvedValue({
        credentials: newTokens
      });

      // Refresh tokens
      const refreshedTokens = await googleDriveService.refreshAccessToken();

      expect(refreshedTokens).toEqual(newTokens);
      expect(googleDriveService.getTokens()).toEqual({
        ...initialTokens,
        ...newTokens
      });

      // Verify service is still authenticated
      expect(googleDriveService.isAuthenticated()).toBe(true);
    });

    it('should handle folder creation with nested structure', async () => {
      // Initialize service
      const credentials = {
        client_id: 'test_client_id',
        client_secret: 'test_client_secret'
      };

      await googleDriveService.initialize(credentials);
      googleDriveService.setTokens({
        access_token: 'access_token',
        refresh_token: 'refresh_token'
      });

      // Create parent folder
      const parentFolderName = 'Etsy Business';
      const parentFolderId = 'parent_folder_123';

      mockDrive.files.list.mockResolvedValueOnce({
        data: { files: [] }
      });

      mockDrive.files.create.mockResolvedValueOnce({
        data: { id: parentFolderId }
      });

      const createdParentId = await googleDriveService.createOrGetFolder(parentFolderName);

      // Create child folder
      const childFolderName = 'Product Images';
      const childFolderId = 'child_folder_123';

      mockDrive.files.list.mockResolvedValueOnce({
        data: { files: [] }
      });

      mockDrive.files.create.mockResolvedValueOnce({
        data: { id: childFolderId }
      });

      const createdChildId = await googleDriveService.createOrGetFolder(
        childFolderName, 
        parentFolderId
      );

      expect(createdParentId).toBe(parentFolderId);
      expect(createdChildId).toBe(childFolderId);

      // Verify child folder was created with correct parent
      expect(mockDrive.files.create).toHaveBeenLastCalledWith({
        resource: {
          name: childFolderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentFolderId]
        },
        fields: 'id'
      });
    });
  });

  describe('Error handling scenarios', () => {
    beforeEach(async () => {
      const credentials = {
        client_id: 'test_client_id',
        client_secret: 'test_client_secret'
      };
      await googleDriveService.initialize(credentials);
      googleDriveService.setTokens({
        access_token: 'access_token',
        refresh_token: 'refresh_token'
      });
    });

    it('should handle upload failure gracefully', async () => {
      const zipBuffer = Buffer.from('test content');
      const filename = 'test.zip';

      mockDrive.files.create.mockRejectedValue(new Error('Quota exceeded'));

      await expect(googleDriveService.uploadZipFile(zipBuffer, filename))
        .rejects.toThrow('Failed to upload ZIP file: Quota exceeded');
    });

    it('should handle permission creation failure', async () => {
      const fileId = 'test_file_id';

      mockDrive.permissions.create.mockRejectedValue(new Error('Permission denied'));

      await expect(googleDriveService.createShareableLink(fileId))
        .rejects.toThrow('Failed to create shareable link: Permission denied');
    });

    it('should handle folder creation failure', async () => {
      const folderName = 'Test Folder';

      mockDrive.files.list.mockResolvedValue({
        data: { files: [] }
      });

      mockDrive.files.create.mockRejectedValue(new Error('Storage limit reached'));

      await expect(googleDriveService.createOrGetFolder(folderName))
        .rejects.toThrow('Failed to create/get folder: Storage limit reached');
    });
  });

  describe('Service state management', () => {
    it('should maintain proper state throughout operations', async () => {
      // Start with uninitialized service
      expect(googleDriveService.isAuthenticated()).toBe(false);
      expect(googleDriveService.getTokens()).toBeNull();

      // Initialize
      const credentials = {
        client_id: 'test_client_id',
        client_secret: 'test_client_secret'
      };
      await googleDriveService.initialize(credentials);

      // Still not authenticated until tokens are set
      expect(googleDriveService.isAuthenticated()).toBe(false);

      // Set tokens
      const tokens = {
        access_token: 'access_token',
        refresh_token: 'refresh_token'
      };
      googleDriveService.setTokens(tokens);

      expect(googleDriveService.isAuthenticated()).toBe(true);
      expect(googleDriveService.getTokens()).toEqual(tokens);

      // Clear tokens
      googleDriveService.clearTokens();

      expect(googleDriveService.isAuthenticated()).toBe(false);
      expect(googleDriveService.getTokens()).toBeNull();
    });
  });
});