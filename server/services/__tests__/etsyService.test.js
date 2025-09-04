const EtsyService = require('../etsyService');
const axios = require('axios');

// Mock axios
jest.mock('axios');
const mockedAxios = axios;

describe('EtsyService', () => {
  let etsyService;
  const mockCredentials = {
    client_id: 'test_client_id',
    client_secret: 'test_client_secret',
    redirect_uri: 'http://localhost:3000/api/auth/etsy/callback'
  };

  beforeEach(() => {
    etsyService = new EtsyService();
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize with valid credentials', async () => {
      await etsyService.initialize(mockCredentials);
      
      expect(etsyService.clientId).toBe(mockCredentials.client_id);
      expect(etsyService.clientSecret).toBe(mockCredentials.client_secret);
      expect(etsyService.redirectUri).toBe(mockCredentials.redirect_uri);
    });

    it('should throw error with invalid credentials', async () => {
      await expect(etsyService.initialize({})).rejects.toThrow('Invalid Etsy OAuth credentials provided');
      await expect(etsyService.initialize({ client_id: 'test' })).rejects.toThrow('Invalid Etsy OAuth credentials provided');
    });

    it('should use default redirect URI if not provided', async () => {
      const credsWithoutRedirect = {
        client_id: 'test_client_id',
        client_secret: 'test_client_secret'
      };
      
      await etsyService.initialize(credsWithoutRedirect);
      expect(etsyService.redirectUri).toBe('http://localhost:3000/api/auth/etsy/callback');
    });
  });

  describe('getAuthUrl', () => {
    beforeEach(async () => {
      await etsyService.initialize(mockCredentials);
    });

    it('should generate correct authorization URL', () => {
      const authUrl = etsyService.getAuthUrl();
      
      expect(authUrl).toContain('https://www.etsy.com/oauth/connect');
      expect(authUrl).toContain('client_id=test_client_id');
      expect(authUrl).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fauth%2Fetsy%2Fcallback');
      expect(authUrl).toContain('scope=listings_r+listings_w+shops_r+profile_r');
    });

    it('should include state parameter when provided', () => {
      const state = 'test_state_123';
      const authUrl = etsyService.getAuthUrl(state);
      
      expect(authUrl).toContain(`state=${state}`);
    });

    it('should throw error if not initialized', () => {
      const uninitializedService = new EtsyService();
      expect(() => uninitializedService.getAuthUrl()).toThrow('Etsy client not initialized');
    });
  });

  describe('authenticateWithCode', () => {
    beforeEach(async () => {
      await etsyService.initialize(mockCredentials);
    });

    it('should successfully authenticate with valid code', async () => {
      const mockTokenResponse = {
        data: {
          access_token: 'test_access_token',
          refresh_token: 'test_refresh_token',
          expires_in: 3600
        }
      };

      mockedAxios.post.mockResolvedValueOnce(mockTokenResponse);

      const result = await etsyService.authenticateWithCode('test_code');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/public/oauth/token',
        expect.objectContaining({
          grant_type: 'authorization_code',
          client_id: 'test_client_id',
          code: 'test_code',
          redirect_uri: 'http://localhost:3000/api/auth/etsy/callback'
        }),
        expect.objectContaining({
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          auth: { username: 'test_client_id', password: 'test_client_secret' }
        })
      );

      expect(result).toEqual(mockTokenResponse.data);
      expect(etsyService.accessToken).toBe('test_access_token');
      expect(etsyService.refreshToken).toBe('test_refresh_token');
    });

    it('should handle authentication failure', async () => {
      const mockError = {
        response: {
          data: { error: 'invalid_grant' }
        }
      };

      mockedAxios.post.mockRejectedValueOnce(mockError);

      await expect(etsyService.authenticateWithCode('invalid_code'))
        .rejects.toThrow('Etsy authentication failed: invalid_grant');
    });
  });

  describe('setTokens and token management', () => {
    beforeEach(async () => {
      await etsyService.initialize(mockCredentials);
    });

    it('should set tokens correctly', () => {
      const tokens = {
        access_token: 'test_access_token',
        refresh_token: 'test_refresh_token'
      };

      etsyService.setTokens(tokens);

      expect(etsyService.accessToken).toBe('test_access_token');
      expect(etsyService.refreshToken).toBe('test_refresh_token');
    });

    it('should refresh access token', async () => {
      etsyService.refreshToken = 'test_refresh_token';
      
      const mockRefreshResponse = {
        data: {
          access_token: 'new_access_token',
          refresh_token: 'new_refresh_token',
          expires_in: 3600
        }
      };

      mockedAxios.post.mockResolvedValueOnce(mockRefreshResponse);

      const result = await etsyService.refreshAccessToken();

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/public/oauth/token',
        expect.objectContaining({
          grant_type: 'refresh_token',
          refresh_token: 'test_refresh_token'
        }),
        expect.any(Object)
      );

      expect(result).toEqual(mockRefreshResponse.data);
      expect(etsyService.accessToken).toBe('new_access_token');
    });

    it('should handle refresh token failure', async () => {
      await expect(etsyService.refreshAccessToken())
        .rejects.toThrow('No refresh token available');
    });

    it('should check authentication status', () => {
      expect(etsyService.isAuthenticated()).toBe(false);
      
      etsyService.accessToken = 'test_token';
      etsyService.shopId = 'test_shop';
      
      expect(etsyService.isAuthenticated()).toBe(true);
    });

    it('should get and clear tokens', () => {
      etsyService.accessToken = 'test_access_token';
      etsyService.refreshToken = 'test_refresh_token';

      const tokens = etsyService.getTokens();
      expect(tokens).toEqual({
        access_token: 'test_access_token',
        refresh_token: 'test_refresh_token'
      });

      etsyService.clearTokens();
      expect(etsyService.accessToken).toBeNull();
      expect(etsyService.refreshToken).toBeNull();
      expect(etsyService.shopId).toBeNull();
    });
  });

  describe('getUserShop', () => {
    beforeEach(async () => {
      await etsyService.initialize(mockCredentials);
      etsyService.accessToken = 'test_access_token';
    });

    it('should get user shop successfully', async () => {
      const mockShopResponse = {
        data: {
          results: [{
            shop_id: 'test_shop_id',
            shop_name: 'Test Shop',
            url: 'https://www.etsy.com/shop/testshop'
          }]
        }
      };

      mockedAxios.get.mockResolvedValueOnce(mockShopResponse);

      const result = await etsyService.getUserShop();

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://openapi.etsy.com/v3/application/shops',
        expect.objectContaining({
          headers: {
            'Authorization': 'Bearer test_access_token',
            'x-api-key': 'test_client_id'
          }
        })
      );

      expect(result).toEqual(mockShopResponse.data.results[0]);
      expect(etsyService.shopId).toBe('test_shop_id');
    });

    it('should handle no shop found', async () => {
      const mockEmptyResponse = { data: { results: [] } };
      mockedAxios.get.mockResolvedValueOnce(mockEmptyResponse);

      await expect(etsyService.getUserShop())
        .rejects.toThrow('No shop found for authenticated user');
    });

    it('should handle unauthenticated request', async () => {
      etsyService.accessToken = null;

      await expect(etsyService.getUserShop())
        .rejects.toThrow('Not authenticated with Etsy');
    });
  });

  describe('validateListingData', () => {
    it('should validate correct listing data', () => {
      const validData = {
        title: 'Test Product',
        description: 'A great test product',
        tags: ['handmade', 'test', 'product'],
        price: 29.99,
        quantity: 5
      };

      const result = etsyService.validateListingData(validData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid title', () => {
      const invalidData = {
        title: 'A'.repeat(141), // Too long
        description: 'Test description',
        tags: ['test'],
        price: 10,
        quantity: 1
      };

      const result = etsyService.validateListingData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Title is required and must be 140 characters or less');
    });

    it('should reject missing description', () => {
      const invalidData = {
        title: 'Test Product',
        tags: ['test'],
        price: 10,
        quantity: 1
      };

      const result = etsyService.validateListingData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Description is required');
    });

    it('should reject invalid tags', () => {
      const invalidData = {
        title: 'Test Product',
        description: 'Test description',
        tags: [], // Empty tags
        price: 10,
        quantity: 1
      };

      const result = etsyService.validateListingData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('At least one tag is required');
    });

    it('should reject too many tags', () => {
      const invalidData = {
        title: 'Test Product',
        description: 'Test description',
        tags: Array(14).fill('tag'), // Too many tags
        price: 10,
        quantity: 1
      };

      const result = etsyService.validateListingData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Maximum 13 tags allowed');
    });

    it('should reject invalid price', () => {
      const invalidData = {
        title: 'Test Product',
        description: 'Test description',
        tags: ['test'],
        price: 0, // Invalid price
        quantity: 1
      };

      const result = etsyService.validateListingData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Price is required and must be greater than 0');
    });

    it('should reject invalid quantity', () => {
      const invalidData = {
        title: 'Test Product',
        description: 'Test description',
        tags: ['test'],
        price: 10,
        quantity: 0 // Invalid quantity
      };

      const result = etsyService.validateListingData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Quantity is required and must be at least 1');
    });
  });

  describe('createDraftListing', () => {
    beforeEach(async () => {
      await etsyService.initialize(mockCredentials);
      etsyService.accessToken = 'test_access_token';
      etsyService.shopId = 'test_shop_id';
    });

    it('should create draft listing successfully', async () => {
      const listingData = {
        title: 'Test Product',
        description: 'A great test product',
        tags: ['handmade', 'test'],
        price: 29.99,
        quantity: 5
      };

      const mockListingResponse = {
        data: {
          listing_id: 12345,
          title: 'Test Product',
          state: 'draft',
          url: 'https://www.etsy.com/listing/12345'
        }
      };

      mockedAxios.post.mockResolvedValueOnce(mockListingResponse);

      const result = await etsyService.createDraftListing(listingData);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://openapi.etsy.com/v3/application/shops/test_shop_id/listings',
        expect.objectContaining({
          title: 'Test Product',
          description: 'A great test product',
          tags: ['handmade', 'test'],
          price: 29.99,
          quantity: 5,
          state: 'draft'
        }),
        expect.objectContaining({
          headers: {
            'Authorization': 'Bearer test_access_token',
            'x-api-key': 'test_client_id',
            'Content-Type': 'application/json'
          }
        })
      );

      expect(result).toEqual({
        listingId: 12345,
        title: 'Test Product',
        state: 'draft',
        url: 'https://www.etsy.com/listing/12345',
        editUrl: 'https://www.etsy.com/your/shops/me/tools/listings/12345'
      });
    });

    it('should handle invalid listing data', async () => {
      const invalidData = {
        title: '', // Invalid
        description: 'Test',
        tags: ['test'],
        price: 10,
        quantity: 1
      };

      await expect(etsyService.createDraftListing(invalidData))
        .rejects.toThrow('Invalid listing data');
    });

    it('should handle unauthenticated request', async () => {
      etsyService.accessToken = null;

      const listingData = {
        title: 'Test Product',
        description: 'Test description',
        tags: ['test'],
        price: 10,
        quantity: 1
      };

      await expect(etsyService.createDraftListing(listingData))
        .rejects.toThrow('Not authenticated with Etsy or shop not found');
    });
  });

  describe('uploadListingImages', () => {
    beforeEach(async () => {
      await etsyService.initialize(mockCredentials);
      etsyService.accessToken = 'test_access_token';
      etsyService.shopId = 'test_shop_id';
    });

    it('should upload images successfully', async () => {
      const images = [
        {
          buffer: Buffer.from('test image data'),
          filename: 'test1.jpg',
          mimeType: 'image/jpeg'
        },
        {
          buffer: Buffer.from('test image data 2'),
          filename: 'test2.jpg',
          mimeType: 'image/jpeg'
        }
      ];

      const mockImageResponse = {
        data: {
          listing_image_id: 123,
          url_570xN: 'https://example.com/image.jpg',
          rank: 1
        }
      };

      mockedAxios.post.mockResolvedValue(mockImageResponse);

      const result = await etsyService.uploadListingImages(12345, images);

      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        imageId: 123,
        url: 'https://example.com/image.jpg',
        rank: 1,
        filename: 'test1.jpg'
      });
    });

    it('should handle empty images array', async () => {
      await expect(etsyService.uploadListingImages(12345, []))
        .rejects.toThrow('No images provided for upload');
    });

    it('should handle invalid image buffer', async () => {
      const invalidImages = [{ buffer: 'not a buffer', filename: 'test.jpg' }];

      await expect(etsyService.uploadListingImages(12345, invalidImages))
        .rejects.toThrow('Invalid image buffer for image 1');
    });
  });

  describe('getListing', () => {
    beforeEach(async () => {
      await etsyService.initialize(mockCredentials);
      etsyService.accessToken = 'test_access_token';
    });

    it('should get listing successfully', async () => {
      const mockListing = {
        data: {
          listing_id: 12345,
          title: 'Test Product',
          state: 'draft'
        }
      };

      mockedAxios.get.mockResolvedValueOnce(mockListing);

      const result = await etsyService.getListing(12345);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://openapi.etsy.com/v3/application/listings/12345',
        expect.objectContaining({
          headers: {
            'Authorization': 'Bearer test_access_token',
            'x-api-key': 'test_client_id'
          }
        })
      );

      expect(result).toEqual(mockListing.data);
    });

    it('should handle unauthenticated request', async () => {
      etsyService.accessToken = null;

      await expect(etsyService.getListing(12345))
        .rejects.toThrow('Not authenticated with Etsy');
    });
  });

  describe('exportListingData', () => {
    it('should export listing data correctly', () => {
      const listingData = {
        title: 'Test Product',
        description: 'Test description',
        tags: ['handmade', 'test'],
        price: 29.99,
        quantity: 5,
        materials: ['wood', 'metal']
      };

      const images = [
        { filename: 'test1.jpg', buffer: Buffer.from('test'), mimeType: 'image/jpeg' },
        { filename: 'test2.jpg', buffer: Buffer.from('test2'), mimeType: 'image/png' }
      ];

      const result = etsyService.exportListingData(listingData, images);

      expect(result).toMatchObject({
        title: 'Test Product',
        description: 'Test description',
        tags: ['handmade', 'test'],
        price: 29.99,
        quantity: 5,
        materials: ['wood', 'metal'],
        images: [
          { filename: 'test1.jpg', size: 4, mimeType: 'image/jpeg' },
          { filename: 'test2.jpg', size: 5, mimeType: 'image/png' }
        ]
      });

      expect(result.instructions).toHaveLength(7);
      expect(result.exportedAt).toBeDefined();
    });

    it('should handle empty images array', () => {
      const listingData = {
        title: 'Test Product',
        description: 'Test description',
        tags: ['test'],
        price: 10,
        quantity: 1
      };

      const result = etsyService.exportListingData(listingData, []);

      expect(result.images).toHaveLength(0);
      expect(result.title).toBe('Test Product');
    });
  });

  describe('shop management', () => {
    it('should get and set shop ID', () => {
      expect(etsyService.getShopId()).toBeNull();

      etsyService.setShopId('test_shop_123');
      expect(etsyService.getShopId()).toBe('test_shop_123');
    });
  });
});