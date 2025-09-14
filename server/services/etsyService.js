const axios = require("axios");
const FormData = require("form-data");
const crypto = require("crypto");
const qs = require("qs");

class EtsyService {
  constructor() {
    this.baseURL = "https://openapi.etsy.com/v3";
    this.clientId = null;
    this.clientSecret = null;
    this.redirectUri = null;
    this.accessToken = null;
    this.refreshToken = null;
    this.shopId = null;
  }

  async initialize(credentials) {
    if (!credentials || !credentials.client_id || !credentials.client_secret) {
      throw new Error("Invalid Etsy OAuth credentials provided");
    }
    this.clientId = credentials.client_id;
    this.clientSecret = credentials.client_secret;
    this.redirectUri =
      credentials.redirect_uri ||
      "http://localhost:3000/api/auth/etsy/callback";
  }

  generatePKCE() {
    const codeVerifier = crypto.randomBytes(32).toString("base64url");
    const codeChallenge = crypto
      .createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");
    return {
      codeVerifier,
      codeChallenge,
      codeChallengeMethod: "S256",
    };
  }

  getAuthUrl(state = null) {
    if (!this.clientId) {
      throw new Error("Etsy client not initialized");
    }

    const pkce = this.generatePKCE();
    const scopesOld = ["listings_r", "listings_w", "shops_r", "profile_r", "transactions_r"].join(
      " "
    );
    const scopes = [
      "listings_r",
      "listings_w",
      "listings_d",
      "shops_r",
      "shops_w",
      "profile_r",
      "profile_w",
      "transactions_r",
      "transactions_w",
      "address_r",
      "address_w",
      "billing_r",
      "cart_r",
      "cart_w",
      "email_r",
      "favorites_r",
      "favorites_w",
      "feedback_r",
      "recommend_r",
      "recommend_w"
    ].join(" ");

    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: scopes,
      code_challenge: pkce.codeChallenge,
      code_challenge_method: pkce.codeChallengeMethod,
      ...(state && { state }),
    });

    return {
      authUrl: `https://www.etsy.com/oauth/connect?${params.toString()}`,
      codeVerifier: pkce.codeVerifier,
    };
  }

  async authenticateWithCode(code, codeVerifier) {
    if (!this.clientId || !this.clientSecret) {
      throw new Error("Etsy client not initialized");
    }
    if (!codeVerifier) {
      throw new Error("PKCE code verifier is required");
    }

    const basicAuth = Buffer.from(
      `${this.clientId}:${this.clientSecret}`
    ).toString("base64");

    try {
      const response = await axios.post(
        "https://api.etsy.com/v3/public/oauth/token",
        qs.stringify({
          grant_type: "authorization_code",
          client_id: this.clientId,
          code,
          redirect_uri: this.redirectUri,
          code_verifier: codeVerifier,
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          },
        }
      );
      this.accessToken = response.data.access_token;
      this.refreshToken = response.data.refresh_token;

      return {
        access_token: this.accessToken,
        refresh_token: this.refreshToken,
        expires_in: response.data.expires_in,
        token_type: response.data.token_type,
      };
    } catch (error) {
      throw new Error(
        `Etsy authentication failed: ${
          error.response?.data?.error_description ||
          error.response?.data?.error ||
          error.message
        }`
      );
    }
  }

  async refreshAccessToken() {
    if (!this.refreshToken) {
      throw new Error("No refresh token available");
    }

    const basicAuth = Buffer.from(
      `${this.clientId}:${this.clientSecret}`
    ).toString("base64");

    try {
      const response = await axios.post(
        "https://api.etsy.com/v3/public/oauth/token",
        qs.stringify({
          grant_type: "refresh_token",
          refresh_token: this.refreshToken,
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${basicAuth}`,
          },
        }
      );

      this.accessToken = response.data.access_token;
      this.refreshToken = response.data.refresh_token;

      return {
        access_token: this.accessToken,
        refresh_token: this.refreshToken,
        expires_in: response.data.expires_in,
      };
    } catch (error) {
      throw new Error(
        `Token refresh failed: ${
          error.response?.data?.error_description ||
          error.response?.data?.error ||
          error.message
        }`
      );
    }
  }

  async getUserInfo() {
    if (!this.accessToken) throw new Error("Not authenticated with Etsy");
  
    try {
      const response = await axios.get(
        `${this.baseURL}/application/users/me`, // <-- PKCE uses /users/me
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "x-api-key": this.clientId,
          },
        }
      );
  
      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to get user info: ${
          error.response?.data?.error || error.response?.data?.message || error.message
        }`
      );
    }
  }

  async getUserShop() {
    if (!this.accessToken) throw new Error("Not authenticated with Etsy");
  
    try {
      const response = await axios.get(
        `${this.baseURL}/application/shops?shop_name=DreamyDigiGoods`, // pass empty to let Etsy identify
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "x-api-key": this.clientId,
          },
        }
      );
  
      if (response.data.results?.length > 0) {
        const shop = response.data.results[0];
        this.shopId = shop.shop_id;
        return shop;
      }
  
      return null; // user has no shop
    } catch (error) {
      throw new Error(
        `Failed to get user shop: ${
          error.response?.data?.error ||
          error.response?.data?.message ||
          error.message
        }`
      );
    }
  }
  
  
  async getUserShopOld() {
    if (!this.accessToken) throw new Error("Not authenticated with Etsy");
    try {
      const response = await axios.get(`${this.baseURL}/application/shops`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "x-api-key": this.clientId,
        },
      });
      if (response.data.results?.length > 0) {
        this.shopId = response.data.results[0].shop_id;
        return response.data.results[0];
      }
      throw new Error("No shop found for authenticated user");
    } catch (error) {
      throw new Error(
        `Failed to get user shop: ${
          error.response?.data?.error || error.message
        }`
      );
    }
  }

  async createDraftListing(listingData) {
    this.shopId = listingData.shop_id;
    if (!this.accessToken || !this.shopId) {
      console.log('Not authenticated with Etsy or shop not found');
      throw new Error("Not authenticated with Etsy or shop not found");
    }

    try {
      const response = await axios.post(
        `${this.baseURL}/application/shops/${this.shopId}/listings`,
        {
          title: listingData.title,
          description: listingData.description,
          tags: listingData.tags,
          price: listingData.price,
          quantity: 100,//listingData.quantity || 1,
          state: "draft",
          who_made: listingData.who_made || "i_did",
          when_made: listingData.when_made || "2020_2024",
          taxonomy_id: listingData.taxonomy_id || 1,
          shipping_template_id: listingData.shipping_template_id,
          materials: listingData.materials || [],
          type: "download" 
        },
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "x-api-key": this.clientId,
            "Content-Type": "application/json",
          },
        }
      );
      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to create draft listing: ${
          error.response?.data?.error || error.message
        }`
      );
    }
  }

  async uploadListingImagesOld(listingId, images) {
    if (!this.accessToken || !this.shopId) {
      throw new Error("Not authenticated with Etsy or shop not found");
    }
    if (!images?.length) throw new Error("No images provided for upload");

    const uploaded = [];
    for (let i = 0; i < images.length; i++) {
      const formData = new FormData();
      formData.append("image", images[i].buffer, {
        filename: images[i].filename || `image_${i + 1}.jpg`,
        contentType: images[i].mimeType || "image/jpeg",
      });

      try {
        const response = await axios.post(
          `${this.baseURL}/application/shops/${this.shopId}/listings/${listingId}/images`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
              "x-api-key": this.clientId,
              ...formData.getHeaders(),
            },
          }
        );
        uploaded.push(response.data);
      } catch (error) {
        throw new Error(
          `Failed to upload image ${i + 1}: ${
            error.response?.data?.error || error.message
          }`
        );
      }
    }
    return uploaded;
  }

  async uploadListingImages(listingId, images) {
    if (!this.accessToken || !this.shopId) {
      throw new Error("Not authenticated with Etsy or shop not found");
    }
    if (!images?.length) throw new Error("No images provided for upload");
  
    const uploaded = [];
  
    for (let i = 0; i < images.length; i++) {
      const formData = new FormData();
      const file = images[i];
  
      // Use stream if available, or buffer fallback
      formData.append("image", file.buffer, {
        filename: file.filename || `image_${i + 1}.jpg`,
        contentType: file.mimeType || 'image/jpeg',
      });
  
      // Add name field
      formData.append('name', file.filename || `image_${i + 1}.jpg`);
  
      try {
        const response = await axios.post(
          `${this.baseURL}/application/shops/${this.shopId}/listings/${listingId}/images`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
              'x-api-key': this.clientId,
              ...formData.getHeaders(),
            },
          }
        );
        uploaded.push(response.data);
      } catch (error) {
        throw new Error(
          `Failed to upload image ${i + 1}: ${
            error.response?.data?.error || error.message
          }`
        );
      }
    }
    return uploaded;
  }

  async uploadListingVideos(listingId, videos) {
    if (!this.accessToken || !this.shopId) {
      throw new Error("Not authenticated with Etsy or shop not found");
    }
    if (!videos?.length) throw new Error("No videos provided for upload");
  
    const uploaded = [];
  
    for (let i = 0; i < videos.length; i++) {
      const formData = new FormData();
      const file = videos[i];
  
      // Append video buffer
      formData.append("video", file.buffer, {
        filename: file.filename || `video_${i + 1}.mp4`,
        contentType: file.mimeType || 'video/mp4',
      });
  
      // Add optional name/metadata field
      formData.append('name', file.filename || `video_${i + 1}.mp4`);
  
      try {
        const response = await axios.post(
          `${this.baseURL}/application/shops/${this.shopId}/listings/${listingId}/videos`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
              'x-api-key': this.clientId,
              ...formData.getHeaders(),
            },
          }
        );
        uploaded.push(response.data);
      } catch (error) {
        throw new Error(
          `Failed to upload video ${i + 1}: ${
            error.response?.data?.error || error.message
          }`
        );
      }
    }
  
    return uploaded;
  }

  async uploadListingDigitalFiles(listingId, files) {
    if (!this.accessToken || !this.shopId) {
      throw new Error("Not authenticated with Etsy or shop not found");
    }
    if (!files?.length) throw new Error("No digital files provided for upload");
  
    const uploaded = [];
  
    for (let i = 0; i < files.length; i++) {
      const formData = new FormData();
      const file = files[i];
  
      // Append file buffer
      formData.append("file", file.buffer, {
        filename: file.filename || `digital_file_${i + 1}.zip`,
        contentType: file.mimeType || 'application/zip',
      });
  
      // Add optional name field
      formData.append('name', file.filename || `digital_file_${i + 1}.zip`);
  
      try {
        const response = await axios.post(
          `${this.baseURL}/application/shops/${this.shopId}/listings/${listingId}/files`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
              'x-api-key': this.clientId,
              ...formData.getHeaders(),
            },
          }
        );
        uploaded.push(response.data);
        //console.log(`Digital file ${i + 1} uploaded successfully:`, response.data);
      } catch (error) {
        console.error(`Failed to upload digital file ${i + 1}:`, error.response?.data || error.message);
        throw new Error(
          `Failed to upload digital file ${i + 1}: ${
            error.response?.data?.error || error.message
          }`
        );
      }
    }
  
    return uploaded;
  }
  

  async getListing(listingId) {
    if (!this.accessToken) throw new Error("Not authenticated with Etsy");
    try {
      const response = await axios.get(
        `${this.baseURL}/application/listings/${listingId}`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "x-api-key": this.clientId,
          },
        }
      );
      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to get listing: ${
          error.response?.data?.error || error.message
        }`
      );
    }
  }

  // --- helpers ---
  setTokens(tokens) {
    this.accessToken = tokens.access_token;
    this.refreshToken = tokens.refresh_token;
  }
  setAccessToken(token) {
    this.accessToken = token;
  }

  setRefreshToken(token) {
    this.refreshToken = token;
  }
  isAuthenticated() {
    return !!(this.accessToken && this.shopId);
  }
  getTokens() {
    return this.accessToken
      ? { access_token: this.accessToken, refresh_token: this.refreshToken }
      : null;
  }
  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    this.shopId = null;
  }
  getShopId() {
    return this.shopId;
  }
  setShopId(shopId) {
    this.shopId = shopId;
  }

  // Dashboard API methods
  async getShopListings(limit = 100, offset = 0) {
    console.log('Getting shop listings...');
    console.log('Access token:', this.accessToken);
    console.log('Shop ID:', this.shopId); 
    if (!this.accessToken || !this.shopId) {
      throw new Error("Not authenticated with Etsy or shop not found");
    }

    try {
      const response = await axios.get(
        `${this.baseURL}/application/shops/${this.shopId}/listings/active`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "x-api-key": this.clientId,
          },
          params: {
            limit,
            offset,
            includes: 'Images,Shop'
          }
        }
      );
      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to get shop listings: ${
          error.response?.data?.error || error.message
        }`
      );
    }
  }

  async getShopReceipts(limit = 100, offset = 0) {
    if (!this.accessToken) {
      throw new Error("Not authenticated with Etsy");
    }

    try {
      // Get shop ID first
      const shopId = await this.getShopId();
      const response = await this.makeAuthenticatedRequest(
        `${this.baseURL}/application/shops/${shopId}/receipts`,
        {
          params: {
            limit,
            offset,
            includes: 'Buyer,Transactions'
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error getting shop receipts:', error.response?.data || error.message);
      throw new Error(
        `Failed to get shop receipts: ${
          error.response?.data?.error || error.message
        }`
      );
    }
  }

  async getShopReviews(limit = 100, offset = 0) {
    if (!this.accessToken) {
      throw new Error("Not authenticated with Etsy");
    }

    try {
      // Get shop ID first
      const shopId = await this.getShopId();
      console.log('Shop ID in getShopReviews:', shopId);
      const response = await this.makeAuthenticatedRequest(
        `${this.baseURL}/application/shops/${shopId}/reviews`,
        {
          params: {
            limit,
            offset,
            includes: 'Listing,User'
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error getting shop reviews:', error.response?.data || error.message);
      throw new Error(
        `Failed to get shop reviews: ${
          error.response?.data?.error || error.message
        }`
      );
    }
  }

  async getShopStats() {
    if (!this.accessToken) {
      throw new Error("Not authenticated with Etsy");
    }

    try {
      // Get shop ID first
      const shopId = await this.getShopId();
      console.log('Shop ID in getShopStats:', shopId);
      const response = await this.makeAuthenticatedRequest(
        `${this.baseURL}/application/shops/${shopId}`,
        {
          params: {
            includes: 'User'
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error getting shop stats:', error.response?.data || error.message);
      throw new Error(
        `Failed to get shop stats: ${
          error.response?.data?.error || error.message
        }`
      );
    }
  }

  async getListingStats(listingId) {
    if (!this.accessToken) {
      throw new Error("Not authenticated with Etsy");
    }

    try {
      const response = await axios.get(
        `${this.baseURL}/application/listings/${listingId}/stats`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "x-api-key": this.clientId,
          }
        }
      );
      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to get listing stats: ${
          error.response?.data?.error || error.message
        }`
      );
    }
  }

  // Get featured listings from marketplace (all active listings)
  async getFeaturedListings(options = {}) {
    if (!this.accessToken) {
      throw new Error("Not authenticated with Etsy");
    }

    try {
      // First, get listing IDs from the marketplace (without includes to get basic info)
      const params = {
        limit: options.limit || 20,
        offset: options.offset || 0,
        sort_on: options.sortOn || 'score',
        sort_order: options.sortOrder || 'desc'
      };

      const response = await this.makeAuthenticatedRequest(
        `${this.baseURL}/application/listings/active`,
        { params }
      );

      const listingsData = response.data;
      const listingIds = (listingsData.results || []).map(listing => listing.listing_id);

      if (listingIds.length === 0) {
        return { results: [], count: 0 };
      }

      // Use batch endpoint to get full listing details with images
      const batchListings = await this.getBatchListings(listingIds);

      return {
        results: batchListings.results || [],
        count: batchListings.count || 0
      };
    } catch (error) {
      console.error('Error getting featured listings:', error.response?.data || error.message);
      throw new Error(
        `Failed to get featured listings: ${
          error.response?.data?.error || error.message
        }`
      );
    }
  }

  // Get shop information for the authenticated user
  async getShopInfo() {
    if (!this.accessToken) {
      throw new Error("Not authenticated with Etsy");
    }

    try {
      // Try to get the user's shop directly using the shops endpoint
      const response = await this.makeAuthenticatedRequest(
        `${this.baseURL}/application/shops?shop_name=DreamyDigiGoods`,
        {
          params: {
            includes: 'User'
          }
        }
      );
      
      console.log('Shop response info:', response.data);
      if (response.data.results && response.data.results.length > 0) {
        return response.data.results[0]; // Return the first (and usually only) shop
      } else {
        throw new Error("No shops found for this user");
      }
    } catch (error) {
      console.error('Error getting shop info:', error.response?.data || error.message);
      throw new Error(
        `Failed to get shop info: ${
          error.response?.data?.error || error.message
        }`
      );
    }
  }

  // Get shop ID for the authenticated user
  async getShopId() {
    if (!this.accessToken) {
      throw new Error("Not authenticated with Etsy");
    }

    try {
      const shopInfo = await this.getShopInfo();
      return shopInfo.shop_id;
    } catch (error) {
      console.error('Error getting shop ID:', error.message);
      throw new Error(`Failed to get shop ID: ${error.message}`);
    }
  }

  // Make authenticated request with automatic token refresh
  async makeAuthenticatedRequest(url, options = {}) {
    if (!this.accessToken) {
      throw new Error("Not authenticated with Etsy");
    }

    const defaultOptions = {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "x-api-key": this.clientId,
      }
    };

    const requestOptions = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers
      }
    };

    try {
      console.log('Making authenticated request to:', url);
      console.log('Request options:', JSON.stringify(requestOptions, null, 2));
      return await axios.get(url, requestOptions);
    } catch (error) {
      console.error('API request failed:', {
        url,
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      
      // If we get a 401 error, try to refresh the token
      if (error.response?.status === 401 && this.refreshToken) {
        try {
          console.log('Token expired, attempting to refresh...');
          await this.refreshAccessToken();
          
          // Retry the request with the new token
          requestOptions.headers.Authorization = `Bearer ${this.accessToken}`;
          return await axios.get(url, requestOptions);
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError.message);
          throw new Error("Authentication failed and token refresh unsuccessful");
        }
      }
      throw error;
    }
  }

  // Get listings from a specific shop (for marketplace browsing)
  async getShopListings(shopId, options = {}) {
    if (!this.accessToken) {
      throw new Error("Not authenticated with Etsy");
    }

    try {
      const params = {
        limit: options.limit || 20,
        offset: options.offset || 0,
        sort_on: options.sortOn || 'score',
        sort_order: options.sortOrder || 'desc'
      };

      // Determine the endpoint based on state
      const state = options.state || 'active';
      let endpoint;
      
      if (state === 'draft') {
        // Use the general listings endpoint with state filter for drafts
        endpoint = `${this.baseURL}/application/shops/${shopId}/listings`;
        params.state = 'draft';
      } else {
        endpoint = `${this.baseURL}/application/shops/${shopId}/listings/active`;
      }

      console.log(`Fetching ${state} listings from:`, endpoint);
      const response = await this.makeAuthenticatedRequest(endpoint, { params });
      return response.data;
    } catch (error) {
      console.error(`Error fetching ${options.state || 'active'} listings:`, error.response?.data || error.message);
      throw new Error(
        `Failed to get shop listings: ${
          error.response?.data?.error || error.message
        }`
      );
    }
  }

  // Get shop listings for the authenticated user's shop (including drafts)
  async getMyShopListings(options = {}) {
    if (!this.accessToken) {
      throw new Error("Not authenticated with Etsy");
    }

    try {
      // Get shop ID first
      const shopId = await this.getShopId();
      
      // First, get listing IDs from the shop (without includes to get basic info)
      const activeListings = await this.getShopListings(shopId, { ...options, state: 'active' });
      
      // Try to get draft listings, but don't fail if they're not available
      let draftListings = { results: [], count: 0 };
      try {
        draftListings = await this.getShopListings(shopId, { ...options, state: 'draft' });
      } catch (draftError) {
        console.log('Draft listings not available or failed:', draftError.message);
        // Continue without draft listings
      }

      // Combine all listing IDs
      const allListingIds = [
        ...(activeListings.results || []).map(listing => listing.listing_id),
        ...(draftListings.results || []).map(listing => listing.listing_id)
      ];

      if (allListingIds.length === 0) {
        return { results: [], count: 0 };
      }

      // Use batch endpoint to get full listing details with images
      const batchListings = await this.getBatchListings(allListingIds);

      return {
        results: batchListings.results || [],
        count: batchListings.count || 0
      };
    } catch (error) {
      console.error('Error getting my shop listings:', error.response?.data || error.message);
      throw new Error(
        `Failed to get my shop listings: ${
          error.response?.data?.error || error.message
        }`
      );
    }
  }

  // Get batch listings with full details including images
  async getBatchListings(listingIds) {
    if (!this.accessToken) {
      throw new Error("Not authenticated with Etsy");
    }

    try {
      const params = {
        listing_ids: listingIds.join(','),
        includes: 'Images,Shop'
      };

      const response = await this.makeAuthenticatedRequest(
        `${this.baseURL}/application/listings/batch`,
        { params }
      );
      return response.data;
    } catch (error) {
      console.error('Error getting batch listings:', error.response?.data || error.message);
      throw new Error(
        `Failed to get batch listings: ${
          error.response?.data?.error || error.message
        }`
      );
    }
  }

  async getListingDetails(listingId) {
    if (!this.accessToken) {
      throw new Error("Not authenticated with Etsy");
    }

    try {
      const response = await this.makeAuthenticatedRequest(
        `${this.baseURL}/application/listings/${listingId}`,
        {
          params: {
            includes: 'Images,Shop,User'
          }
        }
      );
      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to get listing details: ${
          error.response?.data?.error || error.message
        }`
      );
    }
  }

  async getListingReviews(listingId) {
    if (!this.accessToken) {
      throw new Error("Not authenticated with Etsy");
    }

    try {
      const response = await this.makeAuthenticatedRequest(
        `${this.baseURL}/application/listings/${listingId}/reviews`,
        {
          params: {
            includes: 'User'
          }
        }
      );
      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to get listing reviews: ${
          error.response?.data?.error || error.message
        }`
      );
    }
  }

}

module.exports = EtsyService;
