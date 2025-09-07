const fs = require('fs').promises;
const path = require('path');

/**
 * Settings Service for managing user preferences and configuration
 * Handles watermark settings, collage preferences, and external service configurations
 */
class SettingsService {
  constructor() {
    this.settingsDir = path.join(process.cwd(), 'data', 'settings');
    this.defaultSettings = this.getDefaultSettings();
  }

  /**
   * Get default settings configuration
   * @returns {Object} Default settings object
   */
  getDefaultSettings() {
    return {
      watermark: {
        text: 'DigiGoods',
        position: 'bottom-right',
        opacity: 0.7,
        fontSize: 24,
        color: '#FFFFFF',
        enabled: true
      },
      collage: {
        layout: 'grid',
        dimensions: { width: 2000, height: 2000 },
        spacing: 10,
        backgroundColor: '#FFFFFF',
        enabled: true
      },
      googleDrive: {
        folderId: null,
        folderName: 'Etsy Listings',
        autoUpload: true
      },
      etsy: {
        shopId: null,
        defaultCategory: null,
        autoDraft: true
      },
      processing: {
        imageQuality: 90,
        maxImageSize: 10485760, // 10MB in bytes
        allowedFormats: ['jpeg', 'jpg', 'png', 'webp']
      }
    };
  }

  /**
   * Initialize settings directory if it doesn't exist
   */
  async ensureSettingsDirectory() {
    try {
      await fs.access(this.settingsDir);
    } catch (error) {
      if (error.code === 'ENOENT') {
        await fs.mkdir(this.settingsDir, { recursive: true });
      } else {
        throw error;
      }
    }
  }

  /**
   * Get settings file path for a user
   * @param {string} userId - User identifier
   * @returns {string} Settings file path
   */
  getSettingsFilePath(userId = 'default') {
    return path.join(this.settingsDir, `${userId}.json`);
  }

  /**
   * Load user settings from file or return defaults
   * @param {string} userId - User identifier
   * @returns {Promise<Object>} User settings
   */
  async loadSettings(userId = 'default') {
    try {
      await this.ensureSettingsDirectory();
      const settingsPath = this.getSettingsFilePath(userId);
      
      try {
        const settingsData = await fs.readFile(settingsPath, 'utf8');
        const userSettings = JSON.parse(settingsData);
        
        // Merge with defaults to ensure all properties exist
        return this.mergeWithDefaults(userSettings);
      } catch (error) {
        if (error.code === 'ENOENT') {
          // Settings file doesn't exist, return defaults
          return { ...this.defaultSettings };
        }
        throw error;
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      return { ...this.defaultSettings };
    }
  }

  /**
   * Save user settings to file
   * @param {Object} settings - Settings to save
   * @param {string} userId - User identifier
   * @returns {Promise<Object>} Saved settings
   */
  async saveSettings(settings, userId = 'default') {
    try {
      await this.ensureSettingsDirectory();
      
      // Validate settings before saving
      const validatedSettings = this.validateSettings(settings);
      
      const settingsPath = this.getSettingsFilePath(userId);
      await fs.writeFile(settingsPath, JSON.stringify(validatedSettings, null, 2), 'utf8');
      
      return validatedSettings;
    } catch (error) {
      console.error('Error saving settings:', error);
      throw new Error(`Failed to save settings: ${error.message}`);
    }
  }

  /**
   * Update specific settings section
   * @param {string} section - Settings section to update (watermark, collage, etc.)
   * @param {Object} updates - Updates to apply
   * @param {string} userId - User identifier
   * @returns {Promise<Object>} Updated settings
   */
  async updateSettings(section, updates, userId = 'default') {
    const currentSettings = await this.loadSettings(userId);
    
    if (!currentSettings[section]) {
      throw new Error(`Invalid settings section: ${section}`);
    }
    
    // Merge updates with current section settings
    currentSettings[section] = { ...currentSettings[section], ...updates };
    
    return await this.saveSettings(currentSettings, userId);
  }

  /**
   * Reset settings to defaults
   * @param {string} userId - User identifier
   * @returns {Promise<Object>} Default settings
   */
  async resetSettings(userId = 'default') {
    const defaultSettings = { ...this.defaultSettings };
    return await this.saveSettings(defaultSettings, userId);
  }

  /**
   * Merge user settings with defaults to ensure all properties exist
   * @param {Object} userSettings - User's current settings
   * @returns {Object} Merged settings
   */
  mergeWithDefaults(userSettings) {
    const merged = { ...this.defaultSettings };
    
    // Deep merge each section
    Object.keys(this.defaultSettings).forEach(section => {
      if (userSettings[section] && typeof userSettings[section] === 'object') {
        merged[section] = { ...this.defaultSettings[section], ...userSettings[section] };
      }
    });
    
    return merged;
  }

  /**
   * Validate settings object
   * @param {Object} settings - Settings to validate
   * @returns {Object} Validated settings
   * @throws {Error} If validation fails
   */
  validateSettings(settings) {
    const validated = { ...settings };
    
    // Validate watermark settings
    if (validated.watermark) {
      this.validateWatermarkSettings(validated.watermark);
    }
    
    // Validate collage settings
    if (validated.collage) {
      this.validateCollageSettings(validated.collage);
    }
    
    // Validate processing settings
    if (validated.processing) {
      this.validateProcessingSettings(validated.processing);
    }
    
    return validated;
  }

  /**
   * Validate watermark settings
   * @param {Object} watermark - Watermark settings
   * @throws {Error} If validation fails
   */
  validateWatermarkSettings(watermark) {
    if (watermark.text && typeof watermark.text !== 'string') {
      throw new Error('Watermark text must be a string');
    }
    
    if (watermark.position && !['bottom-right', 'bottom-left', 'top-right', 'top-left', 'center'].includes(watermark.position)) {
      throw new Error('Invalid watermark position');
    }
    
    if (watermark.opacity !== undefined && (watermark.opacity < 0 || watermark.opacity > 1)) {
      throw new Error('Watermark opacity must be between 0 and 1');
    }
    
    if (watermark.fontSize !== undefined && (watermark.fontSize < 8 || watermark.fontSize > 100)) {
      throw new Error('Watermark font size must be between 8 and 100');
    }
    
    if (watermark.color && !/^#[0-9A-Fa-f]{6}$/.test(watermark.color)) {
      throw new Error('Watermark color must be a valid hex color');
    }
  }

  /**
   * Validate collage settings
   * @param {Object} collage - Collage settings
   * @throws {Error} If validation fails
   */
  validateCollageSettings(collage) {
    if (collage.layout && !['grid', 'mosaic', 'featured'].includes(collage.layout)) {
      throw new Error('Invalid collage layout');
    }
    
    if (collage.dimensions) {
      if (collage.dimensions.width < 500 || collage.dimensions.width > 4000) {
        throw new Error('Collage width must be between 500 and 4000 pixels');
      }
      if (collage.dimensions.height < 500 || collage.dimensions.height > 4000) {
        throw new Error('Collage height must be between 500 and 4000 pixels');
      }
    }
    
    if (collage.spacing !== undefined && (collage.spacing < 0 || collage.spacing > 50)) {
      throw new Error('Collage spacing must be between 0 and 50 pixels');
    }
    
    if (collage.backgroundColor && !/^#[0-9A-Fa-f]{6}$/.test(collage.backgroundColor)) {
      throw new Error('Collage background color must be a valid hex color');
    }
  }

  /**
   * Validate processing settings
   * @param {Object} processing - Processing settings
   * @throws {Error} If validation fails
   */
  validateProcessingSettings(processing) {
    if (processing.imageQuality !== undefined && (processing.imageQuality < 10 || processing.imageQuality > 100)) {
      throw new Error('Image quality must be between 10 and 100');
    }
    
    if (processing.maxImageSize !== undefined && (processing.maxImageSize < 1048576 || processing.maxImageSize > 52428800)) {
      throw new Error('Max image size must be between 1MB and 50MB');
    }
    
    if (processing.allowedFormats && !Array.isArray(processing.allowedFormats)) {
      throw new Error('Allowed formats must be an array');
    }
  }

  /**
   * Get settings for a specific section
   * @param {string} section - Settings section
   * @param {string} userId - User identifier
   * @returns {Promise<Object>} Section settings
   */
  async getSection(section, userId = 'default') {
    const settings = await this.loadSettings(userId);
    
    if (!settings[section]) {
      throw new Error(`Invalid settings section: ${section}`);
    }
    
    return settings[section];
  }

  /**
   * Check if settings file exists for user
   * @param {string} userId - User identifier
   * @returns {Promise<boolean>} True if settings exist
   */
  async settingsExist(userId = 'default') {
    try {
      const settingsPath = this.getSettingsFilePath(userId);
      await fs.access(settingsPath);
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = SettingsService;