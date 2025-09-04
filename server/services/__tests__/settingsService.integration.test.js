const fs = require('fs').promises;
const path = require('path');
const SettingsService = require('../settingsService');

describe('SettingsService Integration Tests', () => {
  let settingsService;
  let testSettingsDir;
  const testUserId = 'integration-test-user';

  beforeAll(async () => {
    // Create a temporary test directory
    testSettingsDir = path.join(process.cwd(), 'test-data', 'settings');
    settingsService = new SettingsService();
    settingsService.settingsDir = testSettingsDir;
  });

  beforeEach(async () => {
    // Clean up test directory before each test
    try {
      await fs.rm(testSettingsDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist, ignore error
    }
  });

  afterAll(async () => {
    // Clean up test directory after all tests
    try {
      await fs.rm(testSettingsDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist, ignore error
    }
  });

  describe('Full Settings Workflow', () => {
    it('should create, save, load, and update settings successfully', async () => {
      // 1. Load settings for new user (should return defaults)
      const initialSettings = await settingsService.loadSettings(testUserId);
      expect(initialSettings).toEqual(settingsService.defaultSettings);
      expect(await settingsService.settingsExist(testUserId)).toBe(false);

      // 2. Update watermark settings
      const watermarkUpdates = {
        text: 'Integration Test Brand',
        opacity: 0.8,
        position: 'top-left'
      };
      
      const updatedSettings = await settingsService.updateSettings('watermark', watermarkUpdates, testUserId);
      expect(updatedSettings.watermark.text).toBe('Integration Test Brand');
      expect(updatedSettings.watermark.opacity).toBe(0.8);
      expect(updatedSettings.watermark.position).toBe('top-left');
      expect(await settingsService.settingsExist(testUserId)).toBe(true);

      // 3. Load settings again to verify persistence
      const reloadedSettings = await settingsService.loadSettings(testUserId);
      expect(reloadedSettings.watermark.text).toBe('Integration Test Brand');
      expect(reloadedSettings.watermark.opacity).toBe(0.8);
      expect(reloadedSettings.watermark.position).toBe('top-left');

      // 4. Update collage settings
      const collageUpdates = {
        layout: 'mosaic',
        dimensions: { width: 1500, height: 1500 },
        spacing: 15
      };
      
      const collageUpdatedSettings = await settingsService.updateSettings('collage', collageUpdates, testUserId);
      expect(collageUpdatedSettings.collage.layout).toBe('mosaic');
      expect(collageUpdatedSettings.collage.dimensions.width).toBe(1500);
      expect(collageUpdatedSettings.collage.spacing).toBe(15);

      // 5. Verify watermark settings are still intact
      expect(collageUpdatedSettings.watermark.text).toBe('Integration Test Brand');

      // 6. Get specific section
      const watermarkSection = await settingsService.getSection('watermark', testUserId);
      expect(watermarkSection.text).toBe('Integration Test Brand');
      expect(watermarkSection.opacity).toBe(0.8);

      // 7. Reset to defaults
      const resetSettings = await settingsService.resetSettings(testUserId);
      expect(resetSettings).toEqual(settingsService.defaultSettings);

      // 8. Verify reset was persisted
      const finalSettings = await settingsService.loadSettings(testUserId);
      expect(finalSettings).toEqual(settingsService.defaultSettings);
    });

    it('should handle multiple users with separate settings', async () => {
      const user1 = 'user1';
      const user2 = 'user2';

      // Set different watermark text for each user
      await settingsService.updateSettings('watermark', { text: 'User 1 Brand' }, user1);
      await settingsService.updateSettings('watermark', { text: 'User 2 Brand' }, user2);

      // Verify each user has their own settings
      const user1Settings = await settingsService.loadSettings(user1);
      const user2Settings = await settingsService.loadSettings(user2);

      expect(user1Settings.watermark.text).toBe('User 1 Brand');
      expect(user2Settings.watermark.text).toBe('User 2 Brand');

      // Verify settings files exist for both users
      expect(await settingsService.settingsExist(user1)).toBe(true);
      expect(await settingsService.settingsExist(user2)).toBe(true);
    });

    it('should handle complex settings updates', async () => {
      // Create comprehensive settings
      const complexSettings = {
        watermark: {
          text: 'Complex Brand Test',
          position: 'center',
          opacity: 0.6,
          fontSize: 32,
          color: '#FF0000',
          enabled: true
        },
        collage: {
          layout: 'featured',
          dimensions: { width: 3000, height: 2500 },
          spacing: 20,
          backgroundColor: '#F0F0F0',
          enabled: true
        },
        googleDrive: {
          folderId: 'test-folder-id',
          folderName: 'Test Listings',
          autoUpload: false
        },
        etsy: {
          shopId: 'test-shop-123',
          defaultCategory: 'handmade',
          autoDraft: false
        },
        processing: {
          imageQuality: 85,
          maxImageSize: 8388608, // 8MB
          allowedFormats: ['jpeg', 'png']
        }
      };

      // Save complex settings
      const savedSettings = await settingsService.saveSettings(complexSettings, testUserId);
      expect(savedSettings).toEqual(complexSettings);

      // Load and verify all sections
      const loadedSettings = await settingsService.loadSettings(testUserId);
      expect(loadedSettings.watermark.text).toBe('Complex Brand Test');
      expect(loadedSettings.collage.layout).toBe('featured');
      expect(loadedSettings.googleDrive.folderId).toBe('test-folder-id');
      expect(loadedSettings.etsy.shopId).toBe('test-shop-123');
      expect(loadedSettings.processing.imageQuality).toBe(85);

      // Update individual sections and verify others remain unchanged
      await settingsService.updateSettings('watermark', { opacity: 0.9 }, testUserId);
      
      const updatedSettings = await settingsService.loadSettings(testUserId);
      expect(updatedSettings.watermark.opacity).toBe(0.9);
      expect(updatedSettings.watermark.text).toBe('Complex Brand Test'); // Should remain
      expect(updatedSettings.collage.layout).toBe('featured'); // Should remain
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle corrupted settings file gracefully', async () => {
      // Create settings directory and write corrupted file
      await settingsService.ensureSettingsDirectory();
      const settingsPath = settingsService.getSettingsFilePath(testUserId);
      await fs.writeFile(settingsPath, 'corrupted json content', 'utf8');

      // Should return defaults when file is corrupted
      const settings = await settingsService.loadSettings(testUserId);
      expect(settings).toEqual(settingsService.defaultSettings);
    });

    it('should validate settings before saving', async () => {
      const invalidSettings = {
        watermark: {
          opacity: 2.0, // Invalid
          position: 'invalid-position' // Invalid
        },
        collage: {
          dimensions: { width: 100, height: 100 } // Too small
        }
      };

      await expect(settingsService.saveSettings(invalidSettings, testUserId))
        .rejects.toThrow();
    });

    it('should handle permission errors gracefully', async () => {
      // Skip this test on Windows as chmod doesn't work reliably
      if (process.platform === 'win32') {
        return;
      }

      // Create a directory and make it read-only to simulate permission error
      const readOnlyDir = path.join(testSettingsDir, 'readonly');
      await fs.mkdir(readOnlyDir, { recursive: true });
      
      // Try to change permissions to read-only
      try {
        await fs.chmod(readOnlyDir, 0o444); // Read-only
      } catch (error) {
        // If chmod fails, skip this test as we can't simulate the condition
        return;
      }

      const originalSettingsDir = settingsService.settingsDir;
      settingsService.settingsDir = readOnlyDir;

      const settings = { watermark: { text: 'Test' } };
      
      await expect(settingsService.saveSettings(settings, testUserId))
        .rejects.toThrow();

      // Restore original settings directory and cleanup
      settingsService.settingsDir = originalSettingsDir;
      try {
        await fs.chmod(readOnlyDir, 0o755); // Restore write permissions
        await fs.rm(readOnlyDir, { recursive: true, force: true });
      } catch (error) {
        // Cleanup might fail, ignore
      }
    });

    it('should merge partial settings with defaults correctly', async () => {
      // Save partial settings
      const partialSettings = {
        watermark: { text: 'Partial Brand' }
        // Missing other sections and properties
      };

      await settingsService.saveSettings(partialSettings, testUserId);
      
      // Load should merge with defaults
      const loadedSettings = await settingsService.loadSettings(testUserId);
      
      expect(loadedSettings.watermark.text).toBe('Partial Brand');
      expect(loadedSettings.watermark.position).toBe('bottom-right'); // From defaults
      expect(loadedSettings.collage).toEqual(settingsService.defaultSettings.collage);
      expect(loadedSettings.processing).toEqual(settingsService.defaultSettings.processing);
    });
  });

  describe('Performance and Concurrency', () => {
    it('should handle concurrent settings updates', async () => {
      const promises = [];
      
      // Simulate concurrent updates
      for (let i = 0; i < 5; i++) {
        promises.push(
          settingsService.updateSettings('watermark', { text: `Brand ${i}` }, `user-${i}`)
        );
      }

      const results = await Promise.all(promises);
      
      // Verify all updates completed successfully
      expect(results).toHaveLength(5);
      results.forEach((result, index) => {
        expect(result.watermark.text).toBe(`Brand ${index}`);
      });

      // Verify each user has correct settings
      for (let i = 0; i < 5; i++) {
        const userSettings = await settingsService.loadSettings(`user-${i}`);
        expect(userSettings.watermark.text).toBe(`Brand ${i}`);
      }
    });

    it('should handle large settings objects efficiently', async () => {
      const largeSettings = {
        ...settingsService.defaultSettings
      };

      // Add large amount of custom data to watermark section to test validation
      largeSettings.watermark.customData = {};
      for (let i = 0; i < 1000; i++) {
        largeSettings.watermark.customData[`key${i}`] = `value${i}`.repeat(10);
      }

      const startTime = Date.now();
      await settingsService.saveSettings(largeSettings, testUserId);
      const saveTime = Date.now() - startTime;

      const loadStartTime = Date.now();
      const loadedSettings = await settingsService.loadSettings(testUserId);
      const loadTime = Date.now() - loadStartTime;

      // Verify data integrity
      expect(loadedSettings.watermark.customData.key999).toBe('value999'.repeat(10));
      
      // Performance should be reasonable (less than 1 second for large data)
      expect(saveTime).toBeLessThan(1000);
      expect(loadTime).toBeLessThan(1000);
    });
  });
});