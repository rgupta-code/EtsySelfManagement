const EtsyService = require('../etsyService');

describe('EtsyService Integration Tests', () => {
  let etsyService;
  
  // These tests require actual Etsy API credentials and should be run manually
  // when testing against the real Etsy API
  const skipIntegrationTests = !process.env.ETSY_CLIENT_ID || !process.env.ETSY_CLIENT_SECRET;

  beforeEach(() => {
    etsyService = new EtsyService();
  });

  describe('OAuth Flow Integration', () => {
    it.skip('should complete full OAuth flow with real credentials', async () => {
      // This test requires manual intervention to complete OAuth flow
      // Skip by default to avoid breaking CI/CD
      
      if (skipIntegrationTests) {
        console.log('Skipping integration test - missing Etsy credentials');
        return;
      }

      const credentials = {
        client_id: process.env.ETSY_CLIENT_ID,
        client_secret: process.env.ETSY_CLIENT_SECRET,
        redirect_uri: process.env.ETSY_REDIRECT_URI || 'http://localhost:3000/api/auth/etsy/callback'
      };

      await etsyService.initialize(credentials);

      // Generate auth URL
      const authUrl = etsyService.getAuthUrl('test_state');
      expect(authUrl).toContain('https://www.etsy.com/oauth/connect');
      
      console.log('Visit this URL to authorize:', authUrl);
      
      // Note: In a real integration test, you would:
      // 1. Open the auth URL in a browser
      // 2. Complete the OAuth flow
      // 3. Extract the authorization code from the callback
      // 4. Use that code to complete authentication
      
      // For now, we just verify the URL generation works
    });

    it('should handle network errors gracefully', async () => {
      const credentials = {
        client_id: 'invalid_client_id',
        client_secret: 'invalid_client_secret'
      };

      await etsyService.initialize(credentials);

      // This should fail with network/auth error
      await expect(etsyService.authenticateWithCode('invalid_code'))
        .rejects.toThrow(/authentication failed/i);
    });
  });

  describe('API Error Handling', () => {
    beforeEach(async () => {
      const mockCredentials = {
        client_id: 'test_client_id',
        client_secret: 'test_client_secret'
      };
      await etsyService.initialize(mockCredentials);
    });

    it('should handle unauthorized requests', async () => {
      // Try to get shop without authentication
      await expect(etsyService.getUserShop())
        .rejects.toThrow('Not authenticated with Etsy');
    });

    it('should handle invalid listing creation', async () => {
      etsyService.accessToken = 'fake_token';
      etsyService.shopId = 'fake_shop';

      const invalidListingData = {
        title: '', // Invalid title
        description: 'Test',
        tags: ['test'],
        price: 10,
        quantity: 1
      };

      await expect(etsyService.createDraftListing(invalidListingData))
        .rejects.toThrow('Invalid listing data');
    });
  });

  describe('Data Export Functionality', () => {
    it('should export complete listing data for manual creation', () => {
      const listingData = {
        title: 'Handmade Wooden Bowl',
        description: 'Beautiful handcrafted wooden bowl made from sustainable oak wood.',
        tags: ['handmade', 'wooden', 'bowl', 'kitchen', 'sustainable'],
        price: 45.99,
        quantity: 3,
        materials: ['oak wood', 'food-safe finish']
      };

      const mockImages = [
        {
          filename: 'bowl_main.jpg',
          buffer: Buffer.from('fake image data 1'),
          mimeType: 'image/jpeg'
        },
        {
          filename: 'bowl_detail.jpg',
          buffer: Buffer.from('fake image data 2'),
          mimeType: 'image/jpeg'
        }
      ];

      const exportedData = etsyService.exportListingData(listingData, mockImages);

      // Verify all required data is present
      expect(exportedData.title).toBe(listingData.title);
      expect(exportedData.description).toBe(listingData.description);
      expect(exportedData.tags).toEqual(listingData.tags);
      expect(exportedData.price).toBe(listingData.price);
      expect(exportedData.quantity).toBe(listingData.quantity);
      expect(exportedData.materials).toEqual(listingData.materials);

      // Verify image metadata
      expect(exportedData.images).toHaveLength(2);
      expect(exportedData.images[0].filename).toBe('bowl_main.jpg');
      expect(exportedData.images[0].size).toBe(17); // Buffer length
      expect(exportedData.images[0].mimeType).toBe('image/jpeg');

      // Verify instructions are provided
      expect(exportedData.instructions).toHaveLength(7);
      expect(exportedData.instructions[0]).toContain('Etsy shop manager');

      // Verify timestamp
      expect(exportedData.exportedAt).toBeDefined();
      expect(new Date(exportedData.exportedAt)).toBeInstanceOf(Date);
    });
  });

  describe('Validation Edge Cases', () => {
    it('should handle edge cases in listing validation', () => {
      // Test maximum valid title length
      const maxTitleData = {
        title: 'A'.repeat(140), // Exactly 140 characters
        description: 'Valid description',
        tags: ['test'],
        price: 1,
        quantity: 1
      };

      const result = etsyService.validateListingData(maxTitleData);
      expect(result.isValid).toBe(true);

      // Test maximum valid tags
      const maxTagsData = {
        title: 'Valid title',
        description: 'Valid description',
        tags: Array(13).fill('tag'), // Exactly 13 tags
        price: 1,
        quantity: 1
      };

      const result2 = etsyService.validateListingData(maxTagsData);
      expect(result2.isValid).toBe(true);

      // Test tag length limit
      const longTagData = {
        title: 'Valid title',
        description: 'Valid description',
        tags: ['A'.repeat(20)], // Exactly 20 characters
        price: 1,
        quantity: 1
      };

      const result3 = etsyService.validateListingData(longTagData);
      expect(result3.isValid).toBe(true);
    });
  });
});