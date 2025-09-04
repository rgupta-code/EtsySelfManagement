const fs = require('fs').promises;
const path = require('path');
const SettingsService = require('../settingsService');

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    mkdir: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn()
  }
}));

describe('SettingsService', () => {
  let settingsService;
  const mockUserId = 'test-user';

  beforeEach(() => {
    settingsService = new SettingsService();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default settings', () => {
      expect(settingsService.defaultSettings).toBeDefined();
      expect(settingsService.defaultSettings.watermark).toBeDefined();
      expect(settingsService.defaultSettings.collage).toBeDefined();
      expect(settingsService.defaultSettings.googleDrive).toBeDefined();
      expect(settingsService.defaultSettings.etsy).toBeDefined();
    });

    it('should set correct settings directory path', () => {
      const expectedPath = path.join(process.cwd(), 'data', 'settings');
      expect(settingsService.settingsDir).toBe(expectedPath);
    });
  });

  describe('getDefaultSettings', () => {
    it('should return complete default settings object', () => {
      const defaults = settingsService.getDefaultSettings();
      
      expect(defaults.watermark).toEqual({
        text: 'Your Brand',
        position: 'bottom-right',
        opacity: 0.7,
        fontSize: 24,
        color: '#FFFFFF',
        enabled: true
      });
      
      expect(defaults.collage).toEqual({
        layout: 'grid',
        dimensions: { width: 2000, height: 2000 },
        spacing: 10,
        backgroundColor: '#FFFFFF',
        enabled: true
      });
      
      expect(defaults.processing).toEqual({
        imageQuality: 90,
        maxImageSize: 10485760,
        allowedFormats: ['jpeg', 'jpg', 'png', 'webp']
      });
    });
  });

  describe('ensureSettingsDirectory', () => {
    it('should create directory if it does not exist', async () => {
      fs.access.mockRejectedValue({ code: 'ENOENT' });
      fs.mkdir.mockResolvedValue();

      await settingsService.ensureSettingsDirectory();

      expect(fs.mkdir).toHaveBeenCalledWith(settingsService.settingsDir, { recursive: true });
    });

    it('should not create directory if it exists', async () => {
      fs.access.mockResolvedValue();

      await settingsService.ensureSettingsDirectory();

      expect(fs.mkdir).not.toHaveBeenCalled();
    });

    it('should throw error if access fails with non-ENOENT error', async () => {
      const error = new Error('Permission denied');
      error.code = 'EACCES';
      fs.access.mockRejectedValue(error);

      await expect(settingsService.ensureSettingsDirectory()).rejects.toThrow('Permission denied');
    });
  });

  describe('loadSettings', () => {
    it('should load existing settings from file', async () => {
      const mockSettings = {
        watermark: { text: 'Custom Brand', opacity: 0.5 },
        collage: { layout: 'mosaic' }
      };
      
      fs.access.mockResolvedValue();
      fs.readFile.mockResolvedValue(JSON.stringify(mockSettings));

      const result = await settingsService.loadSettings(mockUserId);

      expect(result.watermark.text).toBe('Custom Brand');
      expect(result.watermark.opacity).toBe(0.5);
      expect(result.collage.layout).toBe('mosaic');
      // Should merge with defaults
      expect(result.watermark.position).toBe('bottom-right');
    });

    it('should return defaults if settings file does not exist', async () => {
      fs.access.mockResolvedValue();
      const error = new Error('File not found');
      error.code = 'ENOENT';
      fs.readFile.mockRejectedValue(error);

      const result = await settingsService.loadSettings(mockUserId);

      expect(result).toEqual(settingsService.defaultSettings);
    });

    it('should return defaults if JSON parsing fails', async () => {
      fs.access.mockResolvedValue();
      fs.readFile.mockResolvedValue('invalid json');

      const result = await settingsService.loadSettings(mockUserId);

      expect(result).toEqual(settingsService.defaultSettings);
    });

    it('should handle directory creation errors gracefully', async () => {
      fs.access.mockRejectedValue(new Error('Directory creation failed'));

      const result = await settingsService.loadSettings(mockUserId);

      expect(result).toEqual(settingsService.defaultSettings);
    });
  });

  describe('saveSettings', () => {
    it('should save valid settings to file', async () => {
      const settings = {
        watermark: { text: 'Test Brand', opacity: 0.8 },
        collage: { layout: 'grid' }
      };
      
      fs.access.mockResolvedValue();
      fs.writeFile.mockResolvedValue();

      const result = await settingsService.saveSettings(settings, mockUserId);

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(`${mockUserId}.json`),
        expect.stringContaining('"text": "Test Brand"'),
        'utf8'
      );
      expect(result).toEqual(settings);
    });

    it('should throw error if validation fails', async () => {
      const invalidSettings = {
        watermark: { opacity: 2.0 } // Invalid opacity > 1
      };

      await expect(settingsService.saveSettings(invalidSettings, mockUserId))
        .rejects.toThrow('Watermark opacity must be between 0 and 1');
    });

    it('should handle file write errors', async () => {
      const settings = { watermark: { text: 'Test' } };
      fs.access.mockResolvedValue();
      fs.writeFile.mockRejectedValue(new Error('Write failed'));

      await expect(settingsService.saveSettings(settings, mockUserId))
        .rejects.toThrow('Failed to save settings: Write failed');
    });
  });

  describe('updateSettings', () => {
    it('should update specific settings section', async () => {
      const currentSettings = settingsService.getDefaultSettings();
      fs.access.mockResolvedValue();
      fs.readFile.mockResolvedValue(JSON.stringify(currentSettings));
      fs.writeFile.mockResolvedValue();

      const updates = { text: 'Updated Brand', opacity: 0.9 };
      const result = await settingsService.updateSettings('watermark', updates, mockUserId);

      expect(result.watermark.text).toBe('Updated Brand');
      expect(result.watermark.opacity).toBe(0.9);
      expect(result.watermark.position).toBe('bottom-right'); // Should preserve other values
    });

    it('should throw error for invalid section', async () => {
      fs.access.mockResolvedValue();
      fs.readFile.mockResolvedValue(JSON.stringify(settingsService.getDefaultSettings()));

      await expect(settingsService.updateSettings('invalid', {}, mockUserId))
        .rejects.toThrow('Invalid settings section: invalid');
    });
  });

  describe('resetSettings', () => {
    it('should reset settings to defaults', async () => {
      fs.access.mockResolvedValue();
      fs.writeFile.mockResolvedValue();

      const result = await settingsService.resetSettings(mockUserId);

      expect(result).toEqual(settingsService.defaultSettings);
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(`${mockUserId}.json`),
        expect.stringContaining('"text": "Your Brand"'),
        'utf8'
      );
    });
  });

  describe('validateWatermarkSettings', () => {
    it('should validate valid watermark settings', () => {
      const validWatermark = {
        text: 'Brand Name',
        position: 'bottom-right',
        opacity: 0.7,
        fontSize: 24,
        color: '#FFFFFF'
      };

      expect(() => settingsService.validateWatermarkSettings(validWatermark))
        .not.toThrow();
    });

    it('should throw error for invalid position', () => {
      const invalidWatermark = { position: 'invalid-position' };

      expect(() => settingsService.validateWatermarkSettings(invalidWatermark))
        .toThrow('Invalid watermark position');
    });

    it('should throw error for invalid opacity', () => {
      const invalidWatermark = { opacity: 1.5 };

      expect(() => settingsService.validateWatermarkSettings(invalidWatermark))
        .toThrow('Watermark opacity must be between 0 and 1');
    });

    it('should throw error for invalid font size', () => {
      const invalidWatermark = { fontSize: 150 };

      expect(() => settingsService.validateWatermarkSettings(invalidWatermark))
        .toThrow('Watermark font size must be between 8 and 100');
    });

    it('should throw error for invalid color format', () => {
      const invalidWatermark = { color: 'invalid-color' };

      expect(() => settingsService.validateWatermarkSettings(invalidWatermark))
        .toThrow('Watermark color must be a valid hex color');
    });
  });

  describe('validateCollageSettings', () => {
    it('should validate valid collage settings', () => {
      const validCollage = {
        layout: 'grid',
        dimensions: { width: 2000, height: 2000 },
        spacing: 10,
        backgroundColor: '#FFFFFF'
      };

      expect(() => settingsService.validateCollageSettings(validCollage))
        .not.toThrow();
    });

    it('should throw error for invalid layout', () => {
      const invalidCollage = { layout: 'invalid-layout' };

      expect(() => settingsService.validateCollageSettings(invalidCollage))
        .toThrow('Invalid collage layout');
    });

    it('should throw error for invalid dimensions', () => {
      const invalidCollage = { dimensions: { width: 100, height: 2000 } };

      expect(() => settingsService.validateCollageSettings(invalidCollage))
        .toThrow('Collage width must be between 500 and 4000 pixels');
    });

    it('should throw error for invalid spacing', () => {
      const invalidCollage = { spacing: 100 };

      expect(() => settingsService.validateCollageSettings(invalidCollage))
        .toThrow('Collage spacing must be between 0 and 50 pixels');
    });
  });

  describe('validateProcessingSettings', () => {
    it('should validate valid processing settings', () => {
      const validProcessing = {
        imageQuality: 90,
        maxImageSize: 10485760,
        allowedFormats: ['jpeg', 'png']
      };

      expect(() => settingsService.validateProcessingSettings(validProcessing))
        .not.toThrow();
    });

    it('should throw error for invalid image quality', () => {
      const invalidProcessing = { imageQuality: 150 };

      expect(() => settingsService.validateProcessingSettings(invalidProcessing))
        .toThrow('Image quality must be between 10 and 100');
    });

    it('should throw error for invalid max image size', () => {
      const invalidProcessing = { maxImageSize: 100 };

      expect(() => settingsService.validateProcessingSettings(invalidProcessing))
        .toThrow('Max image size must be between 1MB and 50MB');
    });

    it('should throw error for invalid allowed formats', () => {
      const invalidProcessing = { allowedFormats: 'not-an-array' };

      expect(() => settingsService.validateProcessingSettings(invalidProcessing))
        .toThrow('Allowed formats must be an array');
    });
  });

  describe('getSection', () => {
    it('should return specific settings section', async () => {
      const mockSettings = settingsService.getDefaultSettings();
      fs.access.mockResolvedValue();
      fs.readFile.mockResolvedValue(JSON.stringify(mockSettings));

      const watermarkSettings = await settingsService.getSection('watermark', mockUserId);

      expect(watermarkSettings).toEqual(mockSettings.watermark);
    });

    it('should throw error for invalid section', async () => {
      fs.access.mockResolvedValue();
      fs.readFile.mockResolvedValue(JSON.stringify(settingsService.getDefaultSettings()));

      await expect(settingsService.getSection('invalid', mockUserId))
        .rejects.toThrow('Invalid settings section: invalid');
    });
  });

  describe('settingsExist', () => {
    it('should return true if settings file exists', async () => {
      fs.access.mockResolvedValue();

      const result = await settingsService.settingsExist(mockUserId);

      expect(result).toBe(true);
    });

    it('should return false if settings file does not exist', async () => {
      fs.access.mockRejectedValue(new Error('File not found'));

      const result = await settingsService.settingsExist(mockUserId);

      expect(result).toBe(false);
    });
  });

  describe('mergeWithDefaults', () => {
    it('should merge user settings with defaults', () => {
      const userSettings = {
        watermark: { text: 'Custom Brand' },
        collage: { layout: 'mosaic' }
      };

      const result = settingsService.mergeWithDefaults(userSettings);

      expect(result.watermark.text).toBe('Custom Brand');
      expect(result.watermark.position).toBe('bottom-right'); // From defaults
      expect(result.collage.layout).toBe('mosaic');
      expect(result.collage.spacing).toBe(10); // From defaults
    });

    it('should handle empty user settings', () => {
      const result = settingsService.mergeWithDefaults({});

      expect(result).toEqual(settingsService.defaultSettings);
    });

    it('should handle null/undefined sections', () => {
      const userSettings = {
        watermark: null,
        collage: undefined
      };

      const result = settingsService.mergeWithDefaults(userSettings);

      expect(result.watermark).toEqual(settingsService.defaultSettings.watermark);
      expect(result.collage).toEqual(settingsService.defaultSettings.collage);
    });
  });
});