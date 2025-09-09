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
    const scopes = ["listings_r", "listings_w", "shops_r", "profile_r"].join(
      " "
    );

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
      console.log("******Etsy token response:", response.data);
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
        console.log('Upload listing images error', error);
        throw new Error(
          `Failed to upload image ${i + 1}: ${
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
}

module.exports = EtsyService;
