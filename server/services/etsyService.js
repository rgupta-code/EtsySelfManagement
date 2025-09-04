const axios = require('axios');
const FormData = require('form-data');

class EtsyService {
  constructor() {
    this.baseURL = 'https://openapi.etsy.com/v3';
    this.clientId = null;
    this.clientSecret = null;
    this.redirectUri = null;
    this.accessToken = null;
    this.refreshToken = null;
    this.shopId = null;
  }

  /**
   * Initialize Etsy service with OAuth credentials
   * @param {Object} credentials - Etsy OAuth credentials
   */
  async initialize(credentials) {
    if (!credentials || !credentials.client_id || !credentials.client_secret) {
      throw new Error('Invalid Etsy OAuth credentials provided');
    }

    this.clientId = credentials.client_id;
    this.clientSecret = credentials.client_secret;
    this.redirectUri = credentials.redirect_uri || 'http://localhost:3000/api/auth/etsy/callback';
  }

  /**
   * Generate OAuth 2.0 authorization URL for Etsy
   * @param {string} state - Optional state parameter for security
   * @returns {string} Authorization URL
   */
  getAuthUrl(state = null) {
    if (!this.clientId) {
      throw new Error('Etsy client not initialized');
    }

    const scopes = [
      'listings_r',
      'listings_w', 
      'shops_r',
      'profile_r'
    ].join(' ');

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: scopes,
      ...(state && { state })
    });

    return `https://www.etsy.com/oauth/connect?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access tokens
   * @param {string} code - Authorization code from OAuth callback
   */
  async authenticateWithCode(code) {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('Etsy client not initialized');
    }

    try {
      const response = await axios.post('https://api.etsy.com/v3/public/oauth/token', {
        grant_type: 'authorization_code',
        client_id: this.clientId,
        code: code,
        redirect_uri: this.redirectUri
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        auth: {
          username: this.clientId,
          password: this.clientSecret
        }
      });

      this.accessToken = response.data.access_token;
      this.refreshToken = response.data.refresh_token;
      
      return {
        access_token: this.accessToken,
        refresh_token: this.refreshToken,
        expires_in: response.data.expires_in
      };
    } catch (error) {
      throw new Error(`Etsy authentication failed: ${error.response?.data?.error || error.message}`);
    }
  }

  /**
   * Set existing tokens for authenticated requests
   * @param {Object} tokens - Previously obtained OAuth tokens
   */
  setTokens(tokens) {
    this.accessToken = tokens.access_token;
    this.refreshToken = tokens.refresh_token;
  }

  /**
   * Set access token for authenticated requests
   * @param {string} accessToken - Access token
   */
  setAccessToken(accessToken) {
    this.accessToken = accessToken;
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken() {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await axios.post('https://api.etsy.com/v3/public/oauth/token', {
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        auth: {
          username: this.clientId,
          password: this.clientSecret
        }
      });

      this.accessToken = response.data.access_token;
      this.refreshToken = response.data.refresh_token;
      
      return {
        access_token: this.accessToken,
        refresh_token: this.refreshToken,
        expires_in: response.data.expires_in
      };
    } catch (error) {
      throw new Error(`Token refresh failed: ${error.response?.data?.error || error.message}`);
    }
  }

  /**
   * Get authenticated user information
   */
  async getUserInfo() {
    if (!this.accessToken) {
      throw new Error('Not authenticated with Etsy');
    }

    try {
      const response = await axios.get(`${this.baseURL}/application/user`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'x-api-key': this.clientId
        }
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to get user info: ${error.response?.data?.error || error.message}`);
    }
  }

  /**
   * Get authenticated user's shop information
   */
  async getUserShop() {
    if (!this.accessToken) {
      throw new Error('Not authenticated with Etsy');
    }

    try {
      const response = await axios.get(`${this.baseURL}/application/shops`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'x-api-key': this.clientId
        }
      });

      if (response.data.results && response.data.results.length > 0) {
        this.shopId = response.data.results[0].shop_id;
        return response.data.results[0];
      }

      throw new Error('No shop found for authenticated user');
    } catch (error) {
      throw new Error(`Failed to get user shop: ${error.response?.data?.error || error.message}`);
    }
  }

  /**
   * Validate listing data against Etsy requirements
   * @param {Object} listingData - Listing data to validate
   */
  validateListingData(listingData) {
    const errors = [];

    // Title validation (max 140 characters)
    if (!listingData.title || listingData.title.length > 140) {
      errors.push('Title is required and must be 140 characters or less');
    }

    // Description validation (required)
    if (!listingData.description) {
      errors.push('Description is required');
    }

    // Tags validation (1-13 tags, each max 20 characters)
    if (!listingData.tags || !Array.isArray(listingData.tags) || listingData.tags.length === 0) {
      errors.push('At least one tag is required');
    } else if (listingData.tags.length > 13) {
      errors.push('Maximum 13 tags allowed');
    } else {
      const invalidTags = listingData.tags.filter(tag => !tag || tag.length > 20);
      if (invalidTags.length > 0) {
        errors.push('Each tag must be 20 characters or less');
      }
    }

    // Price validation (required, positive number)
    if (!listingData.price || listingData.price <= 0) {
      errors.push('Price is required and must be greater than 0');
    }

    // Quantity validation (required, positive integer)
    if (!listingData.quantity || listingData.quantity < 1) {
      errors.push('Quantity is required and must be at least 1');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  } 
 /**
   * Create a draft listing in Etsy shop
   * @param {Object} listingData - Listing data including title, description, tags, price, etc.
   * @returns {Object} Created listing information
   */
  async createDraftListing(listingData) {
    if (!this.accessToken || !this.shopId) {
      throw new Error('Not authenticated with Etsy or shop not found');
    }

    // Validate listing data
    const validation = this.validateListingData(listingData);
    if (!validation.isValid) {
      throw new Error(`Invalid listing data: ${validation.errors.join(', ')}`);
    }

    try {
      const payload = {
        title: listingData.title,
        description: listingData.description,
        tags: listingData.tags,
        price: listingData.price,
        quantity: listingData.quantity || 1,
        state: 'draft', // Create as draft
        who_made: listingData.who_made || 'i_did',
        when_made: listingData.when_made || '2020_2024',
        taxonomy_id: listingData.taxonomy_id || 1, // Default category
        shipping_template_id: listingData.shipping_template_id,
        materials: listingData.materials || []
      };

      const response = await axios.post(
        `${this.baseURL}/application/shops/${this.shopId}/listings`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'x-api-key': this.clientId,
            'Content-Type': 'application/json'
          }
        }
      );

      const listing = response.data;
      return {
        listingId: listing.listing_id,
        title: listing.title,
        state: listing.state,
        url: listing.url,
        editUrl: `https://www.etsy.com/your/shops/me/tools/listings/${listing.listing_id}`
      };
    } catch (error) {
      throw new Error(`Failed to create draft listing: ${error.response?.data?.error || error.message}`);
    }
  }

  /**
   * Upload images to an existing listing
   * @param {number} listingId - Etsy listing ID
   * @param {Array} images - Array of image objects with buffer and filename
   * @returns {Array} Uploaded image information
   */
  async uploadListingImages(listingId, images) {
    if (!this.accessToken || !this.shopId) {
      throw new Error('Not authenticated with Etsy or shop not found');
    }

    if (!images || !Array.isArray(images) || images.length === 0) {
      throw new Error('No images provided for upload');
    }

    const uploadedImages = [];

    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      
      if (!image.buffer || !Buffer.isBuffer(image.buffer)) {
        throw new Error(`Invalid image buffer for image ${i + 1}`);
      }

      try {
        const formData = new FormData();
        formData.append('image', image.buffer, {
          filename: image.filename || `image_${i + 1}.jpg`,
          contentType: image.mimeType || 'image/jpeg'
        });

        const response = await axios.post(
          `${this.baseURL}/application/shops/${this.shopId}/listings/${listingId}/images`,
          formData,
          {
            headers: {
              'Authorization': `Bearer ${this.accessToken}`,
              'x-api-key': this.clientId,
              ...formData.getHeaders()
            }
          }
        );

        uploadedImages.push({
          imageId: response.data.listing_image_id,
          url: response.data.url_570xN,
          rank: response.data.rank,
          filename: image.filename
        });
      } catch (error) {
        throw new Error(`Failed to upload image ${i + 1}: ${error.response?.data?.error || error.message}`);
      }
    }

    return uploadedImages;
  }

  /**
   * Get listing information by ID
   * @param {number} listingId - Etsy listing ID
   * @returns {Object} Listing information
   */
  async getListing(listingId) {
    if (!this.accessToken) {
      throw new Error('Not authenticated with Etsy');
    }

    try {
      const response = await axios.get(
        `${this.baseURL}/application/listings/${listingId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'x-api-key': this.clientId
          }
        }
      );

      return response.data;
    } catch (error) {
      throw new Error(`Failed to get listing: ${error.response?.data?.error || error.message}`);
    }
  }  /**

   * Export listing data for manual creation (fallback when API fails)
   * @param {Object} listingData - Complete listing data
   * @param {Array} images - Processed images
   * @returns {Object} Exportable data structure
   */
  exportListingData(listingData, images = []) {
    return {
      title: listingData.title,
      description: listingData.description,
      tags: listingData.tags,
      price: listingData.price,
      quantity: listingData.quantity || 1,
      materials: listingData.materials || [],
      images: images.map((img, index) => ({
        filename: img.filename || `image_${index + 1}.jpg`,
        size: img.buffer ? img.buffer.length : 0,
        mimeType: img.mimeType || 'image/jpeg'
      })),
      instructions: [
        '1. Go to your Etsy shop manager',
        '2. Click "Add a listing"',
        '3. Upload the processed images',
        '4. Copy and paste the title, description, and tags',
        '5. Set the price and quantity',
        '6. Complete other required fields',
        '7. Save as draft or publish'
      ],
      exportedAt: new Date().toISOString()
    };
  }

  /**
   * Check if the service is authenticated
   * @returns {boolean} Authentication status
   */
  isAuthenticated() {
    return !!(this.accessToken && this.shopId);
  }

  /**
   * Get current authentication tokens
   * @returns {Object|null} Current tokens or null if not authenticated
   */
  getTokens() {
    return this.accessToken ? {
      access_token: this.accessToken,
      refresh_token: this.refreshToken
    } : null;
  }

  /**
   * Clear authentication tokens and shop info
   */
  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    this.shopId = null;
  }

  /**
   * Get shop ID
   * @returns {string|null} Current shop ID
   */
  getShopId() {
    return this.shopId;
  }

  /**
   * Set shop ID manually
   * @param {string} shopId - Etsy shop ID
   */
  setShopId(shopId) {
    this.shopId = shopId;
  }

  /**
   * Get shop name (convenience method)
   * @returns {string|null} Shop name or null if not available
   */
  getShopName() {
    return this.shopName || null;
  }
}

module.exports = EtsyService;