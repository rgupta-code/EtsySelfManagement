// API Client for EtsyFlow
class APIClient {
    constructor() {
        this.baseURL = window.location.origin;
        this.apiURL = `${this.baseURL}/api`;
        this.authToken = this.getStoredToken();
        this.refreshToken = this.getStoredRefreshToken();
        this.isRefreshing = false;
        this.failedQueue = [];
    }

    /**
     * Get stored authentication token
     */
    getStoredToken() {
        return localStorage.getItem('etsyflow-auth-token');
    }

    /**
     * Get stored refresh token
     */
    getStoredRefreshToken() {
        return localStorage.getItem('etsyflow-refresh-token');
    }

    /**
     * Store authentication tokens
     */
    storeTokens(accessToken, refreshToken = null) {
        this.authToken = accessToken;
        localStorage.setItem('etsyflow-auth-token', accessToken);
        
        if (refreshToken) {
            this.refreshToken = refreshToken;
            localStorage.setItem('etsyflow-refresh-token', refreshToken);
        }
    }

    /**
     * Clear stored tokens
     */
    clearTokens() {
        this.authToken = null;
        this.refreshToken = null;
        localStorage.removeItem('etsyflow-auth-token');
        localStorage.removeItem('etsyflow-refresh-token');
    }

    /**
     * Get default headers for API requests
     */
    getHeaders(includeAuth = true) {
        const headers = {
            'Content-Type': 'application/json'
        };

        if (includeAuth && this.authToken) {
            headers['Authorization'] = `Bearer ${this.authToken}`;
        }

        return headers;
    }

    /**
     * Handle token refresh
     */
    async refreshAccessToken() {
        if (this.isRefreshing) {
            // If already refreshing, wait for it to complete
            return new Promise((resolve, reject) => {
                this.failedQueue.push({ resolve, reject });
            });
        }

        if (!this.refreshToken) {
            throw new Error('No refresh token available');
        }

        this.isRefreshing = true;

        try {
            const response = await fetch(`${this.apiURL}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken: this.refreshToken })
            });

            if (!response.ok) {
                throw new Error('Token refresh failed');
            }

            const data = await response.json();
            this.storeTokens(data.accessToken);

            // Process failed queue
            this.failedQueue.forEach(({ resolve }) => resolve(data.accessToken));
            this.failedQueue = [];

            return data.accessToken;

        } catch (error) {
            // Clear tokens on refresh failure
            this.clearTokens();
            this.failedQueue.forEach(({ reject }) => reject(error));
            this.failedQueue = [];
            throw error;
        } finally {
            this.isRefreshing = false;
        }
    }

    /**
     * Make authenticated API request with automatic token refresh
     */
    async makeRequest(url, options = {}) {
        const config = {
            ...options,
            headers: {
                ...this.getHeaders(options.includeAuth !== false),
                ...options.headers
            }
        };

        try {
            const response = await fetch(url, config);

            // Handle 401 unauthorized - attempt token refresh
            if (response.status === 401 && this.refreshToken && options.includeAuth !== false) {
                try {
                    await this.refreshAccessToken();
                    
                    // Retry original request with new token
                    config.headers['Authorization'] = `Bearer ${this.authToken}`;
                    return await fetch(url, config);
                } catch (refreshError) {
                    console.error('Token refresh failed:', refreshError);
                    // Redirect to login or handle auth failure
                    this.handleAuthFailure();
                    throw refreshError;
                }
            }

            return response;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    /**
     * Handle authentication failure
     */
    handleAuthFailure() {
        this.clearTokens();
        // Emit custom event for auth failure
        window.dispatchEvent(new CustomEvent('auth-failure', {
            detail: { message: 'Authentication failed. Please log in again.' }
        }));
    }

    /**
     * Upload images with progress tracking
     */
    async uploadImages(files, options = {}, onProgress = null) {
        const formData = new FormData();
        
        // Add files to form data
        files.forEach(file => {
            formData.append('images', file);
        });

        // Add options to form data
        Object.keys(options).forEach(key => {
            if (options[key] !== undefined) {
                formData.append(key, options[key]);
            }
        });

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            // Track upload progress
            if (onProgress) {
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        const percentComplete = (e.loaded / e.total) * 100;
                        onProgress({
                            type: 'upload',
                            loaded: e.loaded,
                            total: e.total,
                            percent: percentComplete
                        });
                    }
                });
            }

            // Handle response
            xhr.addEventListener('load', () => {
                try {
                    const response = JSON.parse(xhr.responseText);
                    
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(response);
                    } else {
                        reject(new Error(response.message || `Upload failed: ${xhr.statusText}`));
                    }
                } catch (parseError) {
                    reject(new Error('Invalid response from server'));
                }
            });

            // Handle errors
            xhr.addEventListener('error', () => {
                reject(new Error('Network error occurred during upload'));
            });

            xhr.addEventListener('timeout', () => {
                reject(new Error('Upload timed out. Please try again.'));
            });

            // Configure and send request
            xhr.open('POST', `${this.apiURL}/upload`);
            
            // Add auth header if available
            if (this.authToken) {
                xhr.setRequestHeader('Authorization', `Bearer ${this.authToken}`);
            }
            
            xhr.timeout = 300000; // 5 minute timeout
            xhr.send(formData);
        });
    }

    /**
     * Poll processing status
     */
    async pollProcessingStatus(processingId, onUpdate = null) {
        const maxPolls = 60; // Maximum 5 minutes of polling
        let pollCount = 0;
        const pollInterval = 5000; // 5 seconds

        return new Promise((resolve, reject) => {
            const poll = async () => {
                try {
                    const response = await this.makeRequest(`${this.apiURL}/status/${processingId}`);
                    
                    if (!response.ok) {
                        throw new Error('Failed to get processing status');
                    }

                    const data = await response.json();
                    
                    if (onUpdate) {
                        onUpdate(data.status);
                    }

                    // Check if processing is complete
                    const lastStep = data.status.steps[data.status.steps.length - 1];
                    if (lastStep && (lastStep.status === 'completed' || lastStep.status === 'failed')) {
                        resolve(data.status);
                        return;
                    }

                    // Continue polling if not complete
                    pollCount++;
                    if (pollCount < maxPolls) {
                        setTimeout(poll, pollInterval);
                    } else {
                        reject(new Error('Processing timeout - maximum polling time exceeded'));
                    }

                } catch (error) {
                    reject(error);
                }
            };

            // Start polling
            poll();
        });
    }

    /**
     * Get authentication status
     */
    async getAuthStatus() {
        try {
            const response = await this.makeRequest(`${this.apiURL}/auth/status`);
            
            if (!response.ok) {
                throw new Error('Failed to get auth status');
            }

            return await response.json();
        } catch (error) {
            console.error('Error getting auth status:', error);
            return {
                success: false,
                authenticated: false,
                services: {
                    googleDrive: { connected: false },
                    etsy: { connected: false }
                }
            };
        }
    }

    /**
     * Initiate Google OAuth
     */
    async initiateGoogleAuth() {
        try {
            const response = await this.makeRequest(`${this.apiURL}/auth/google`);
            
            if (!response.ok) {
                throw new Error('Failed to initiate Google authentication');
            }

            const data = await response.json();
            
            // Redirect to Google OAuth
            window.location.href = data.authUrl;
            
        } catch (error) {
            console.error('Google auth initiation failed:', error);
            throw error;
        }
    }

    /**
     * Initiate Etsy OAuth
     */
    async initiateEtsyAuth() {
        try {
            const response = await this.makeRequest(`${this.apiURL}/auth/etsy`);
            
            if (!response.ok) {
                throw new Error('Failed to initiate Etsy authentication');
            }

            const data = await response.json();
            
            // Redirect to Etsy OAuth
            window.location.href = data.authUrl;
            
        } catch (error) {
            console.error('Etsy auth initiation failed:', error);
            throw error;
        }
    }

    /**
     * Disconnect service authentication
     */
    async disconnectService(service) {
        try {
            const response = await this.makeRequest(`${this.apiURL}/auth/disconnect/${service}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error(`Failed to disconnect ${service}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`Error disconnecting ${service}:`, error);
            throw error;
        }
    }

    /**
     * Get user settings
     */
    async getSettings() {
        try {
            const response = await this.makeRequest(`${this.apiURL}/settings`);
            
            if (!response.ok) {
                throw new Error('Failed to get settings');
            }

            return await response.json();
        } catch (error) {
            console.error('Error getting settings:', error);
            throw error;
        }
    }

    /**
     * Save user settings
     */
    async saveSettings(settings) {
        try {
            const response = await this.makeRequest(`${this.apiURL}/settings`, {
                method: 'PUT',
                body: JSON.stringify({ settings })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to save settings');
            }

            return await response.json();
        } catch (error) {
            console.error('Error saving settings:', error);
            throw error;
        }
    }

    /**
     * Update specific settings section
     */
    async updateSettingsSection(section, updates) {
        try {
            const response = await this.makeRequest(`${this.apiURL}/settings/${section}`, {
                method: 'PATCH',
                body: JSON.stringify({ updates })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Failed to update ${section} settings`);
            }

            return await response.json();
        } catch (error) {
            console.error(`Error updating ${section} settings:`, error);
            throw error;
        }
    }

    /**
     * Get API health status
     */
    async getHealthStatus() {
        try {
            const response = await this.makeRequest(`${this.apiURL}/health`, {
                includeAuth: false
            });

            if (!response.ok) {
                throw new Error('Health check failed');
            }

            return await response.json();
        } catch (error) {
            console.error('Health check error:', error);
            return {
                success: false,
                status: 'unhealthy',
                error: error.message
            };
        }
    }

    /**
     * Handle authentication success from OAuth redirect
     */
    handleAuthSuccess(urlParams) {
        const token = urlParams.get('token');
        const service = urlParams.get('service');
        
        if (token && token !== 'existing') {
            this.storeTokens(token);
        }

        // Emit success event
        window.dispatchEvent(new CustomEvent('auth-success', {
            detail: { 
                service,
                token: token !== 'existing' ? token : null
            }
        }));
    }

    /**
     * Handle authentication error from OAuth redirect
     */
    handleAuthError(urlParams) {
        const error = urlParams.get('error');
        const service = urlParams.get('service');

        // Emit error event
        window.dispatchEvent(new CustomEvent('auth-error', {
            detail: { 
                service,
                error: decodeURIComponent(error || 'Authentication failed')
            }
        }));
    }
}

// Create global API client instance
window.apiClient = new APIClient();

// Handle OAuth redirects
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const path = window.location.pathname;

    // Handle OAuth success/error from URL parameters
    if (urlParams.get('auth') === 'success') {
        window.apiClient.handleAuthSuccess(urlParams);
        // Clean up URL parameters
        window.history.replaceState({}, '', path);
    } else if (urlParams.get('auth') === 'error') {
        window.apiClient.handleAuthError(urlParams);
        // Clean up URL parameters
        window.history.replaceState({}, '', path);
    }
});

console.log('API Client module loaded');