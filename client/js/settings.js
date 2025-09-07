// Settings functionality for EtsyFlow
class SettingsManager {
    constructor() {
        this.settings = {
            watermark: {
                text: '© Your Brand Name',
                position: 'bottom-right',
                opacity: 70,
                fontSize: 'medium'
            },
            collage: {
                layout: 'grid',
                spacing: 10,
                dimensions: { width: 2000, height: 2000 }
            },
            googleDrive: {
                folderName: 'EtsyFlow Backups',
                autoOrganize: false
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

        // Collage form listeners
        const collageForm = document.getElementById('collage-form');
        if (collageForm) {
            collageForm.addEventListener('input', (e) => {
                this.handleCollageChange(e);
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
        const dimensionsSelect = document.getElementById('collage-dimensions');
        if (dimensionsSelect) {
            dimensionsSelect.addEventListener('change', (e) => {
                this.toggleCustomDimensions(e.target.value === 'custom');
            });
        }

        // Custom dimensions inputs
        const customWidth = document.getElementById('custom-width');
        const customHeight = document.getElementById('custom-height');
        if (customWidth && customHeight) {
            customWidth.addEventListener('input', (e) => {
                this.settings.collage.dimensions.width = parseInt(e.target.value) || 2000;
                this.updateCollagePreview();
            });
            customHeight.addEventListener('input', (e) => {
                this.settings.collage.dimensions.height = parseInt(e.target.value) || 2000;
                this.updateCollagePreview();
            });
        }

        // Range input updates
        const opacityRange = document.getElementById('watermark-opacity');
        if (opacityRange) {
            opacityRange.addEventListener('input', (e) => {
                document.getElementById('opacity-value').textContent = e.target.value + '%';
            });
        }

        const spacingRange = document.getElementById('collage-spacing');
        if (spacingRange) {
            spacingRange.addEventListener('input', (e) => {
                document.getElementById('spacing-value').textContent = e.target.value + 'px';
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
            case 'watermarkPosition':
                this.settings.watermark.position = value;
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

    handleCollageChange(e) {
        const { name, value } = e.target;
        
        switch (name) {
            case 'collageLayout':
                this.settings.collage.layout = value;
                break;
            case 'collageSpacing':
                this.settings.collage.spacing = parseInt(value);
                break;
            case 'collageDimensions':
                if (value !== 'custom') {
                    const [width, height] = value.split('x').map(Number);
                    this.settings.collage.dimensions = { width, height };
                }
                break;
        }
        
        this.updateCollagePreview();
    }

    handleDriveChange(e) {
        const { name, value, type, checked } = e.target;
        
        switch (name) {
            case 'driveFolder':
                this.settings.googleDrive.folderName = value || 'EtsyFlow Backups';
                break;
            case 'autoOrganize':
                this.settings.googleDrive.autoOrganize = checked;
                break;
        }
    }

    updateWatermarkPreview() {
        const preview = document.getElementById('watermark-preview');
        if (!preview) return;

        const { text, position, opacity, fontSize } = this.settings.watermark;
        
        // Update text
        preview.textContent = text;
        
        // Update opacity
        preview.style.opacity = opacity / 100;
        
        // Update font size
        const fontSizes = {
            small: '12px',
            medium: '16px',
            large: '20px'
        };
        preview.style.fontSize = fontSizes[fontSize] || '16px';
        
        // Update position
        preview.style.top = 'auto';
        preview.style.bottom = 'auto';
        preview.style.left = 'auto';
        preview.style.right = 'auto';
        
        switch (position) {
            case 'top-left':
                preview.style.top = '10px';
                preview.style.left = '10px';
                break;
            case 'top-right':
                preview.style.top = '10px';
                preview.style.right = '10px';
                break;
            case 'bottom-left':
                preview.style.bottom = '10px';
                preview.style.left = '10px';
                break;
            case 'bottom-right':
                preview.style.bottom = '10px';
                preview.style.right = '10px';
                break;
            case 'center':
                preview.style.top = '50%';
                preview.style.left = '50%';
                preview.style.transform = 'translate(-50%, -50%)';
                break;
        }
    }

    updateCollagePreview() {
        const preview = document.getElementById('collage-preview');
        if (!preview) return;

        const { layout, dimensions } = this.settings.collage;
        
        // Update preview content based on layout
        const layoutNames = {
            grid: 'Grid Layout',
            mosaic: 'Mosaic Layout',
            featured: 'Featured + Grid'
        };
        
        const layoutIcons = {
            grid: 'fas fa-th',
            mosaic: 'fas fa-th-large',
            featured: 'fas fa-clone'
        };
        
        preview.innerHTML = `
            <div class="text-center text-gray-400">
                <i class="${layoutIcons[layout]} text-3xl mb-2"></i>
                <p>${layoutNames[layout]} Preview</p>
                <p class="text-sm">${dimensions.width}×${dimensions.height}px</p>
            </div>
        `;
    }

    toggleCustomDimensions(show) {
        const customDiv = document.getElementById('custom-dimensions');
        if (customDiv) {
            if (show) {
                customDiv.classList.remove('hidden');
            } else {
                customDiv.classList.add('hidden');
            }
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
        
        if (status.services?.googleDrive?.connected) {
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
        
        if (status.services?.etsy?.connected) {
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

    async saveSettings() {
        const button = document.getElementById('save-settings-btn');
        const originalText = button.innerHTML;
        
        try {
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Saving...';
            
            // Validate settings
            const validation = this.validateSettings();
            if (!validation.valid) {
                throw new Error(validation.message);
            }
            
            // Save to localStorage
            localStorage.setItem('etsyflow-settings', JSON.stringify(this.settings));
            
            // Send to backend using API client
            await window.apiClient.saveSettings(this.settings);
            
            this.showSaveSuccess();
            
        } catch (error) {
            console.error('Save settings error:', error);
            this.showSaveError(error.message);
        } finally {
            button.disabled = false;
            button.innerHTML = originalText;
        }
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
        
        // Validate collage dimensions
        const { width, height } = this.settings.collage.dimensions;
        if (width < 500 || width > 3000 || height < 500 || height > 3000) {
            return { valid: false, message: 'Collage dimensions must be between 500px and 3000px' };
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
            // Try to load from backend first
            try {
                const response = await window.apiClient.getSettings();
                if (response.success && response.settings) {
                    this.settings = { ...this.settings, ...response.settings };
                    console.log('Settings loaded from backend:', response.settings);
                }
            } catch (apiError) {
                console.warn('Could not load settings from backend, using local storage:', apiError);
            }
            
            // Fallback to localStorage
            const saved = localStorage.getItem('etsyflow-settings');
            if (saved) {
                try {
                    const parsedSettings = JSON.parse(saved);
                    this.settings = { ...this.settings, ...parsedSettings };
                    console.log('Settings loaded from localStorage:', parsedSettings);
                } catch (parseError) {
                    console.error('Error parsing saved settings:', parseError);
                }
            }
            
            this.populateForm();
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    populateForm() {
        // Populate watermark settings
        const watermarkText = document.getElementById('watermark-text');
        if (watermarkText) watermarkText.value = this.settings.watermark.text;
        
        const watermarkPosition = document.getElementById('watermark-position');
        if (watermarkPosition) watermarkPosition.value = this.settings.watermark.position;
        
        const watermarkOpacity = document.getElementById('watermark-opacity');
        if (watermarkOpacity) {
            watermarkOpacity.value = this.settings.watermark.opacity;
            document.getElementById('opacity-value').textContent = this.settings.watermark.opacity + '%';
        }
        
        const watermarkSize = document.getElementById('watermark-size');
        if (watermarkSize) watermarkSize.value = this.settings.watermark.fontSize;
        
        // Populate collage settings
        const collageLayout = document.getElementById('collage-layout');
        if (collageLayout) collageLayout.value = this.settings.collage.layout;
        
        const collageSpacing = document.getElementById('collage-spacing');
        if (collageSpacing) {
            collageSpacing.value = this.settings.collage.spacing;
            document.getElementById('spacing-value').textContent = this.settings.collage.spacing + 'px';
        }
        
        // Set dimensions
        const { width, height } = this.settings.collage.dimensions;
        const dimensionsSelect = document.getElementById('collage-dimensions');
        const standardSize = `${width}x${height}`;
        const standardOptions = ['2000x2000', '1500x1500', '1200x1200'];
        
        if (dimensionsSelect) {
            if (standardOptions.includes(standardSize)) {
                dimensionsSelect.value = standardSize;
            } else {
                dimensionsSelect.value = 'custom';
                this.toggleCustomDimensions(true);
                document.getElementById('custom-width').value = width;
                document.getElementById('custom-height').value = height;
            }
        }
        
        // Populate Google Drive settings
        const driveFolder = document.getElementById('drive-folder');
        if (driveFolder) driveFolder.value = this.settings.googleDrive.folderName;
        
        const autoOrganize = document.getElementById('auto-organize');
        if (autoOrganize) autoOrganize.checked = this.settings.googleDrive.autoOrganize;
    }

    updatePreview() {
        this.updateWatermarkPreview();
        this.updateCollagePreview();
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
    // Only initialize if we're on the settings page
    if (document.getElementById('settings-page') || document.querySelector('title')?.textContent?.includes('Settings')) {
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
        
        window.settingsManager = new SettingsManager();
        await window.settingsManager.init();
    }
});

// Global function to get settings (for use by other modules)
function getSettings() {
    return window.settingsManager ? window.settingsManager.getSettings() : null;
}

console.log('Settings module loaded');