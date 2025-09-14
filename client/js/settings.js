// Settings functionality for ListGenie
class SettingsManager {
    constructor() {
        this.settings = {
            watermark: {
                text: '© Your Brand Name',
                angle: -30,
                opacity: 70,
                fontSize: 'medium',
                color: '#b0b0b0',
                spacing: 200,
                enabled: true
            },
            googleDrive: {
                folderName: 'ListGenie Backups',
                autoOrganize: false,
                autoUpload: true
            },
            etsy: {
                shopId: null,
                defaultCategory: null,
                autoDraft: true
            },
            authentication: {
                googleDrive: { connected: false, email: null },
                etsy: { connected: false, shopName: null }
            }
        };
    }

    async init() {
        console.log('SettingsManager initializing...');
        await this.loadSettings();
        console.log('Settings loaded, setting up event listeners...');
        this.setupEventListeners();
        this.setupOAuthEventListeners();
        console.log('Event listeners set up, updating preview...');
        this.updatePreview();
        console.log('Preview updated, checking auth status...');
        await this.checkAuthenticationStatus();
        console.log('SettingsManager initialization complete');
    }

    setupEventListeners() {
        // Watermark form listeners
        const watermarkForm = document.getElementById('watermark-form');
        if (watermarkForm) {
            watermarkForm.addEventListener('input', (e) => {
                this.handleWatermarkChange(e);
            });
        }




        // Drive form listeners
        const driveForm = document.getElementById('drive-form');
        if (driveForm) {
            driveForm.addEventListener('input', (e) => {
                this.handleDriveChange(e);
            });
        }

        // Authentication buttons
        const googleAuthBtn = document.getElementById('google-auth-btn');
        if (googleAuthBtn) {
            console.log('Google auth button found, adding event listener');
            googleAuthBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Google auth button clicked');
                this.handleGoogleAuth();
            });
        } else {
            console.warn('Google auth button not found');
        }

        const etsyAuthBtn = document.getElementById('etsy-auth-btn');
        if (etsyAuthBtn) {
            console.log('Etsy auth button found, adding event listener');
            etsyAuthBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Etsy auth button clicked');
                this.handleEtsyAuth();
            });
        } else {
            console.warn('Etsy auth button not found');
        }

        // Save settings button
        const saveBtn = document.getElementById('save-settings-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveSettings();
            });
        }

        // Custom dimensions toggle

        // Range input updates
        const opacityRange = document.getElementById('watermark-opacity');
        if (opacityRange) {
            opacityRange.addEventListener('input', (e) => {
                document.getElementById('opacity-value').textContent = e.target.value + '%';
            });
        }

        const angleRange = document.getElementById('watermark-angle');
        if (angleRange) {
            angleRange.addEventListener('input', (e) => {
                document.getElementById('angle-value').textContent = e.target.value + '°';
            });
        }
    }

    setupOAuthEventListeners() {
        // Listen for OAuth success events
        window.addEventListener('auth-success', (event) => {
            console.log('OAuth success event received:', event.detail);
            const { service } = event.detail;
            
            // Show success message
            this.showAuthSuccess(service);
            
            // Refresh authentication status
            this.checkAuthenticationStatus();
        });

        // Listen for OAuth error events
        window.addEventListener('auth-error', (event) => {
            console.log('OAuth error event received:', event.detail);
            const { service, error } = event.detail;
            
            // Show error message
            this.showAuthError(service, error);
        });
    }

    showAuthSuccess(service) {
        const statusDiv = document.getElementById('settings-status');
        statusDiv.className = 'bg-green-50 border border-green-200 rounded-2xl p-4 mt-6';
        statusDiv.innerHTML = `
            <div class="flex">
                <i class="fas fa-check-circle text-green-400 mr-3 mt-1"></i>
                <div>
                    <h3 class="text-sm font-medium text-green-800">${service} Connected Successfully</h3>
                    <p class="mt-1 text-sm text-green-700">
                        Your ${service} account has been connected successfully.
                    </p>
                </div>
            </div>
        `;
        statusDiv.classList.remove('hidden');
        
        setTimeout(() => {
            statusDiv.classList.add('hidden');
        }, 5000);
    }

    handleWatermarkChange(e) {
        const { name, value } = e.target;
        
        switch (name) {
            case 'watermarkText':
                this.settings.watermark.text = value || '© Your Brand Name';
                break;
            case 'watermarkAngle':
                this.settings.watermark.angle = parseInt(value);
                break;
            case 'watermarkOpacity':
                this.settings.watermark.opacity = parseInt(value);
                break;
            case 'watermarkSize':
                this.settings.watermark.fontSize = value;
                break;
        }
        
        this.updateWatermarkPreview();
    }




    handleDriveChange(e) {
        const { name, value, type, checked } = e.target;
        
        switch (name) {
            case 'driveFolder':
                this.settings.googleDrive.folderName = value || 'ListGenie Backups';
                break;
            case 'autoOrganize':
                this.settings.googleDrive.autoOrganize = checked;
                break;
        }
    }

    updateWatermarkPreview() {
        const previewContainer = document.querySelector('#watermark-preview').parentElement;
        if (!previewContainer) return;

        const { text, angle, opacity, fontSize } = this.settings.watermark;
        
        // Clear existing watermarks
        const existingWatermarks = previewContainer.querySelectorAll('.watermark-repeat');
        existingWatermarks.forEach(w => w.remove());
        
        // Update font size
        const fontSizes = {
            small: '10px',
            medium: '14px',
            large: '18px'
        };
        const fontSize_px = fontSizes[fontSize] || '14px';
        
        // Create repeated watermarks across the preview area
        const containerWidth = previewContainer.offsetWidth;
        const containerHeight = previewContainer.offsetHeight;
        const spacing = 120; // Distance between watermarks
        
        for (let x = 0; x < containerWidth; x += spacing) {
            for (let y = 0; y < containerHeight; y += spacing) {
                const watermark = document.createElement('div');
                watermark.className = 'watermark-repeat absolute text-gray-800 font-semibold pointer-events-none select-none';
                watermark.textContent = text;
                watermark.style.left = x + 'px';
                watermark.style.top = y + 'px';
                watermark.style.opacity = opacity / 100;
                watermark.style.fontSize = fontSize_px;
                watermark.style.transform = `rotate(${angle}deg)`;
                watermark.style.transformOrigin = 'center';
                watermark.style.whiteSpace = 'nowrap';
                
                previewContainer.appendChild(watermark);
            }
        }
        
        // Hide the original single watermark
        const originalPreview = document.getElementById('watermark-preview');
        if (originalPreview) {
            originalPreview.style.display = 'none';
        }
    }



    async handleGoogleAuth() {
        const button = document.getElementById('google-auth-btn');
        const originalText = button.innerHTML;
        
        try {
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Connecting...';
            
            console.log('Initiating Google OAuth...');
            
            // Use API client to initiate Google OAuth
            await window.apiClient.initiateGoogleAuth();
            
        } catch (error) {
            console.error('Google auth error:', error);
            this.showAuthError('Google Drive', error.message);
            button.disabled = false;
            button.innerHTML = originalText;
        }
    }

    async handleEtsyAuth() {
        const button = document.getElementById('etsy-auth-btn');
        const originalText = button.innerHTML;
        
        try {
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Connecting...';
            
            console.log('Initiating Etsy OAuth...');
            
            // Use API client to initiate Etsy OAuth
            await window.apiClient.initiateEtsyAuth();
            
        } catch (error) {
            console.error('Etsy auth error:', error);
            this.showAuthError('Etsy', error.message);
            button.disabled = false;
            button.innerHTML = originalText;
        }
    }

    async checkAuthenticationStatus() {
        try {
            console.log('Checking authentication status...');
            const status = await window.apiClient.getAuthStatus();
            console.log('Auth status response:', status);
            
            if (status.success) {
                this.updateAuthenticationUI(status);
            }
        } catch (error) {
            console.error('Error checking auth status:', error);
        }
    }

    updateAuthenticationUI(status) {
        // Update Google Drive status
        const googleStatus = document.getElementById('google-status');
        const googleBtn = document.getElementById('google-auth-btn');
        
        if (googleStatus && googleBtn && status.services?.googleDrive?.connected) {
            googleStatus.innerHTML = `
                <span class="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                <span class="text-sm text-green-600">Connected</span>
            `;
            googleBtn.innerHTML = '<i class="fas fa-check mr-2"></i>Connected to Google Drive';
            googleBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
            googleBtn.classList.add('bg-green-600', 'hover:bg-green-700');
            googleBtn.disabled = true;
            
            this.settings.authentication.googleDrive = status.services.googleDrive;
        }
        
        // Update Etsy status
        const etsyStatus = document.getElementById('etsy-status');
        const etsyBtn = document.getElementById('etsy-auth-btn');
        
        if (etsyStatus && etsyBtn && status.services?.etsy?.connected) {
            etsyStatus.innerHTML = `
                <span class="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                <span class="text-sm text-green-600">Connected</span>
            `;
            etsyBtn.innerHTML = '<i class="fas fa-check mr-2"></i>Connected to Etsy';
            etsyBtn.classList.remove('bg-orange-600', 'hover:bg-orange-700');
            etsyBtn.classList.add('bg-green-600', 'hover:bg-green-700');
            etsyBtn.disabled = true;
            
            this.settings.authentication.etsy = status.services.etsy;
        }
    }

    showAuthError(service, message) {
        const statusDiv = document.getElementById('settings-status');
        if (!statusDiv) return; // Exit if element doesn't exist
        
        statusDiv.className = 'bg-red-50 border border-red-200 rounded-2xl p-4 mt-6';
        statusDiv.innerHTML = `
            <div class="flex">
                <i class="fas fa-exclamation-triangle text-red-400 mr-3 mt-1"></i>
                <div>
                    <h3 class="text-sm font-medium text-red-800">${service} Connection Failed</h3>
                    <p class="mt-1 text-sm text-red-700">${message}</p>
                </div>
            </div>
        `;
        statusDiv.classList.remove('hidden');
        
        setTimeout(() => {
            statusDiv.classList.add('hidden');
        }, 5000);
    }

    showSettingsSource(source) {
        const sourceDiv = document.getElementById('settings-source');
        const sourceText = document.getElementById('settings-source-text');
        
        if (sourceDiv && sourceText) {
            const sourceInfo = {
                'localStorage': {
                    text: 'Settings loaded from local storage',
                    class: 'bg-blue-100 text-blue-800'
                },
                'backend': {
                    text: 'Settings synced from server',
                    class: 'bg-green-100 text-green-800'
                },
                'defaults': {
                    text: 'Using default settings',
                    class: 'bg-gray-100 text-gray-800'
                }
            };
            
            const info = sourceInfo[source] || sourceInfo['defaults'];
            sourceText.textContent = info.text;
            sourceDiv.className = `inline-flex items-center px-3 py-1 rounded-full text-sm ${info.class}`;
            sourceDiv.classList.remove('hidden');
            
            // Hide after 3 seconds
            setTimeout(() => {
                sourceDiv.classList.add('hidden');
            }, 3000);
        }
    }

    async saveSettings() {
        const button = document.getElementById('save-settings-btn');
        const originalText = button.innerHTML;
        
        try {
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Saving...';
            
            // Collect current form values
            this.collectFormValues();
            
            // Validate settings
            const validation = this.validateSettings();
            if (!validation.valid) {
                throw new Error(validation.message);
            }
            
            // Save to localStorage immediately for offline access
            localStorage.setItem('ListGenie-settings', JSON.stringify(this.settings));
            console.log('Settings saved to localStorage:', this.settings);
            
            // Try to send to backend
            try {
                // Convert settings for backend before sending
                const backendSettings = this.convertSettingsForBackend(this.settings);
                await window.apiClient.saveSettings(backendSettings);
                console.log('Settings saved to backend successfully');
            } catch (apiError) {
                console.warn('Could not save to backend, settings saved locally:', apiError);
                // Still show success since local save worked
            }
            
            this.showSaveSuccess();
            
        } catch (error) {
            console.error('Save settings error:', error);
            this.showSaveError(error.message);
        } finally {
            button.disabled = false;
            button.innerHTML = originalText;
        }
    }

    /**
     * Convert backend settings format to frontend format
     */
    convertBackendToFrontend(backendSettings) {
        const frontendSettings = JSON.parse(JSON.stringify(backendSettings)); // Deep clone
        
        // Ensure watermark settings exist
        if (!frontendSettings.watermark) {
            frontendSettings.watermark = {};
        }
        
        // Convert opacity from 0-1 to 0-100
        if (frontendSettings.watermark.opacity !== undefined) {
            frontendSettings.watermark.opacity = Math.round(frontendSettings.watermark.opacity * 100);
        }
        
        // Convert fontSize from number to text
        if (frontendSettings.watermark.fontSize !== undefined) {
            const fontSizeMap = {
                32: 'small',
                40: 'medium',
                48: 'large'
            };
            frontendSettings.watermark.fontSize = fontSizeMap[frontendSettings.watermark.fontSize] || 'medium';
        }
        
        console.log('Converted backend settings to frontend:', frontendSettings);
        
        return frontendSettings;
    }

    /**
     * Convert frontend settings format to backend format
     */
    convertSettingsForBackend(frontendSettings) {
        const backendSettings = JSON.parse(JSON.stringify(frontendSettings)); // Deep clone
        
        // Ensure watermark settings exist
        if (!backendSettings.watermark) {
            backendSettings.watermark = {};
        }
        
        // Convert opacity from 0-100 to 0-1
        if (backendSettings.watermark.opacity !== undefined) {
            backendSettings.watermark.opacity = backendSettings.watermark.opacity / 100;
        }
        
        // Convert fontSize from text to number
        if (backendSettings.watermark.fontSize) {
            const fontSizeMap = {
                'small': 32,
                'medium': 40,
                'large': 48
            };
            const originalFontSize = backendSettings.watermark.fontSize;
            backendSettings.watermark.fontSize = fontSizeMap[backendSettings.watermark.fontSize] || 40;
            console.log(`Converted font size: ${originalFontSize} -> ${backendSettings.watermark.fontSize}`);
        } else {
            console.warn('No font size found in watermark settings:', backendSettings.watermark);
        }
        
        // Ensure angle is a number
        if (backendSettings.watermark.angle !== undefined) {
            backendSettings.watermark.angle = parseInt(backendSettings.watermark.angle) || -30;
        }
        
        // Ensure enabled is a boolean
        if (backendSettings.watermark.enabled === undefined) {
            backendSettings.watermark.enabled = true; // Default to enabled
        }
        
        console.log('Converted settings for backend:', backendSettings);
        
        return backendSettings;
    }

    /**
     * Collect current form values into settings object
     */
    collectFormValues() {
        // Watermark settings
        const watermarkText = document.getElementById('watermark-text');
        if (watermarkText) this.settings.watermark.text = watermarkText.value || '© Your Brand Name';
        
        const watermarkAngle = document.getElementById('watermark-angle');
        if (watermarkAngle) this.settings.watermark.angle = parseInt(watermarkAngle.value);
        
        const watermarkOpacity = document.getElementById('watermark-opacity');
        if (watermarkOpacity) this.settings.watermark.opacity = parseInt(watermarkOpacity.value);
        
        const watermarkSize = document.getElementById('watermark-size');
        if (watermarkSize) {
            this.settings.watermark.fontSize = watermarkSize.value;
            console.log('Collected font size from form:', watermarkSize.value);
        }
        
        


        // Google Drive settings
        const driveFolder = document.getElementById('drive-folder');
        if (driveFolder) this.settings.googleDrive.folderName = driveFolder.value || 'ListGenie Backups';
        
        const autoOrganize = document.getElementById('auto-organize');
        if (autoOrganize) this.settings.googleDrive.autoOrganize = autoOrganize.checked;
    }

    validateSettings() {
        // Validate watermark text
        if (!this.settings.watermark.text.trim()) {
            return { valid: false, message: 'Watermark text cannot be empty' };
        }
        
        if (this.settings.watermark.text.length > 50) {
            return { valid: false, message: 'Watermark text must be 50 characters or less' };
        }
        
        // Validate opacity
        if (this.settings.watermark.opacity < 10 || this.settings.watermark.opacity > 100) {
            return { valid: false, message: 'Watermark opacity must be between 10% and 100%' };
        }
        
        // Validate font size
        if (!this.settings.watermark.fontSize) {
            return { valid: false, message: 'Watermark font size must be selected' };
        }
        
        


        // Validate folder name
        if (!this.settings.googleDrive.folderName.trim()) {
            return { valid: false, message: 'Google Drive folder name cannot be empty' };
        }
        
        return { valid: true };
    }

    showSaveSuccess() {
        const statusDiv = document.getElementById('settings-status');
        statusDiv.className = 'bg-green-50 border border-green-200 rounded-2xl p-4 mt-6';
        statusDiv.innerHTML = `
            <div class="flex">
                <i class="fas fa-check-circle text-green-400 mr-3 mt-1"></i>
                <div>
                    <h3 class="text-sm font-medium text-green-800">Settings Saved Successfully</h3>
                    <p class="mt-1 text-sm text-green-700">
                        Your preferences have been saved and will be applied to future uploads.
                    </p>
                </div>
            </div>
        `;
        statusDiv.classList.remove('hidden');
        
        setTimeout(() => {
            statusDiv.classList.add('hidden');
        }, 3000);
    }

    showSaveError(message) {
        const statusDiv = document.getElementById('settings-status');
        statusDiv.className = 'bg-red-50 border border-red-200 rounded-2xl p-4 mt-6';
        statusDiv.innerHTML = `
            <div class="flex">
                <i class="fas fa-exclamation-triangle text-red-400 mr-3 mt-1"></i>
                <div>
                    <h3 class="text-sm font-medium text-red-800">Error Saving Settings</h3>
                    <p class="mt-1 text-sm text-red-700">${message}</p>
                </div>
            </div>
        `;
        statusDiv.classList.remove('hidden');
        
        setTimeout(() => {
            statusDiv.classList.add('hidden');
        }, 5000);
    }

    async loadSettings() {
        try {
            // First try to load from localStorage for immediate UI update
            const saved = localStorage.getItem('ListGenie-settings');
            let loadedFromLocal = false;
            if (saved) {
                try {
                    const parsedSettings = JSON.parse(saved);
                    this.settings = this.mergeWithDefaults(parsedSettings);
                    console.log('Settings loaded from localStorage:', parsedSettings);
                    loadedFromLocal = true;
                    this.showSettingsSource('localStorage');
                } catch (parseError) {
                    console.error('Error parsing saved settings:', parseError);
                }
            }
            
            // Then try to load from backend and sync
            try {
                const response = await window.apiClient.getSettings();
                if (response.success && response.settings) {
                    // Convert backend settings to frontend format
                    const frontendSettings = this.convertBackendToFrontend(response.settings);
                    // Merge backend settings with current settings
                    const backendSettings = this.mergeWithDefaults(frontendSettings);
                    this.settings = { ...this.settings, ...backendSettings };
                    
                    // Update localStorage with backend data
                    localStorage.setItem('ListGenie-settings', JSON.stringify(this.settings));
                    console.log('Settings synced from backend:', response.settings);
                    this.showSettingsSource('backend');
                } else if (!loadedFromLocal) {
                    this.showSettingsSource('defaults');
                }
            } catch (apiError) {
                console.warn('Could not load settings from backend, using local storage:', apiError);
                if (!loadedFromLocal) {
                    this.showSettingsSource('defaults');
                }
            }
            
            this.populateForm();
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    /**
     * Merge settings with defaults to ensure all properties exist
     */
    mergeWithDefaults(userSettings) {
        const defaults = {
            watermark: {
                text: '© Your Brand Name',
                angle: -30,
                opacity: 70, // Frontend uses 0-100, backend uses 0-1
                fontSize: 'medium',
                color: '#b0b0b0',
                spacing: 200,
                enabled: true
            },
            googleDrive: {
                folderName: 'ListGenie Backups',
                autoOrganize: false,
                autoUpload: true
            },
            etsy: {
                shopId: null,
                defaultCategory: null,
                autoDraft: true
            },
            authentication: {
                googleDrive: { connected: false, email: null },
                etsy: { connected: false, shopName: null }
            }
        };

        const merged = { ...defaults };
        
        // Deep merge each section
        Object.keys(defaults).forEach(section => {
            if (userSettings[section] && typeof userSettings[section] === 'object') {
                merged[section] = { ...defaults[section], ...userSettings[section] };
            }
        });
        
        return merged;
    }

    populateForm() {
        // Populate watermark settings
        const watermarkText = document.getElementById('watermark-text');
        if (watermarkText) watermarkText.value = this.settings.watermark.text;
        
        const watermarkAngle = document.getElementById('watermark-angle');
        if (watermarkAngle) {
            watermarkAngle.value = this.settings.watermark.angle;
            const angleValue = document.getElementById('angle-value');
            if (angleValue) angleValue.textContent = this.settings.watermark.angle + '°';
        }
        
        const watermarkOpacity = document.getElementById('watermark-opacity');
        if (watermarkOpacity) {
            watermarkOpacity.value = this.settings.watermark.opacity;
            const opacityValue = document.getElementById('opacity-value');
            if (opacityValue) opacityValue.textContent = this.settings.watermark.opacity + '%';
        }
        
        const watermarkSize = document.getElementById('watermark-size');
        if (watermarkSize) watermarkSize.value = this.settings.watermark.fontSize;
        
        


        // Populate Google Drive settings
        const driveFolder = document.getElementById('drive-folder');
        if (driveFolder) driveFolder.value = this.settings.googleDrive.folderName;
        
        const autoOrganize = document.getElementById('auto-organize');
        if (autoOrganize) autoOrganize.checked = this.settings.googleDrive.autoOrganize;
    }

    updatePreview() {
        this.updateWatermarkPreview();
    }

    // Public method to get current settings
    getSettings() {
        return { ...this.settings };
    }

    // Public method to update settings from external source
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        this.populateForm();
        this.updatePreview();
    }
}

// Initialize settings manager when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize settings manager on all pages that need it
    const needsSettings = document.getElementById('settings-page') || 
                         document.querySelector('title')?.textContent?.includes('Settings') ||
                         document.getElementById('drop-zone') || // Upload page
                         document.getElementById('file-input'); // Upload page
    
    if (needsSettings) {
        // Wait for API client to be available
        const waitForAPIClient = () => {
            return new Promise((resolve) => {
                if (window.apiClient) {
                    resolve();
                } else {
                    setTimeout(() => waitForAPIClient().then(resolve), 100);
                }
            });
        };
        
        await waitForAPIClient();
        
        if (!window.settingsManager) {
            window.settingsManager = new SettingsManager();
            await window.settingsManager.init();
        }
    }
});

// Global function to get settings (for use by other modules)
function getSettings() {
    if (window.settingsManager) {
        return window.settingsManager.getSettings();
    }
    
    // Fallback to localStorage if settings manager not available
    try {
        const saved = localStorage.getItem('ListGenie-settings');
        if (saved) {
            return JSON.parse(saved);
        }
    } catch (error) {
        console.error('Error loading settings from localStorage:', error);
    }
    
    // Return default settings if nothing else works
    return {
        watermark: {
            text: '© Your Brand Name',
            angle: -30,
            opacity: 70,
            fontSize: 'medium',
            color: '#b0b0b0',
            spacing: 200,
            enabled: true
        },
        googleDrive: {
            folderName: 'ListGenie Backups',
            autoOrganize: false,
            autoUpload: true
        },
        etsy: {
            shopId: null,
            defaultCategory: null,
            autoDraft: true
        },
        authentication: {
            googleDrive: { connected: false, email: null },
            etsy: { connected: false, shopName: null }
        }
    };
}

// Global function to update settings from other modules
function updateSettings(newSettings) {
    if (window.settingsManager) {
        window.settingsManager.updateSettings(newSettings);
    }
    
    // Also update localStorage
    try {
        const currentSettings = getSettings();
        const mergedSettings = { ...currentSettings, ...newSettings };
        localStorage.setItem('ListGenie-settings', JSON.stringify(mergedSettings));
    } catch (error) {
        console.error('Error updating settings in localStorage:', error);
    }
}

console.log('Settings module loaded');