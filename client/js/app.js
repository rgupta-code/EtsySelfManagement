// Main application controller for EtsyFlow
class App {
    constructor() {
        this.isInitialized = false;
        this.authStatus = null;
        this.init();
    }

    async init() {
        if (this.isInitialized) return;

        try {
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.init());
                return;
            }

            // Set up global error handling
            this.setupErrorHandling();

            // Set up authentication event listeners
            this.setupAuthEventListeners();

            // Check API health
            await this.checkAPIHealth();

            // Initialize authentication status
            await this.initializeAuth();

            // Set up periodic auth status checks
            this.setupPeriodicAuthCheck();

            this.isInitialized = true;
            console.log('EtsyFlow app initialized successfully');

        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showGlobalError('Failed to initialize application. Please refresh the page.');
        }
    }

    setupErrorHandling() {
        // Global error handler for unhandled promises
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.showGlobalError('An unexpected error occurred. Please try again.');
        });

        // Global error handler for JavaScript errors
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            // Don't show UI errors for script loading failures
            if (!event.filename || event.filename.includes('.js')) {
                return;
            }
            this.showGlobalError('An unexpected error occurred. Please refresh the page.');
        });
    }

    setupAuthEventListeners() {
        // Listen for authentication success
        window.addEventListener('auth-success', (event) => {
            const { service, token } = event.detail;
            this.handleAuthSuccess(service, token);
        });

        // Listen for authentication errors
        window.addEventListener('auth-error', (event) => {
            const { service, error } = event.detail;
            this.handleAuthError(service, error);
        });

        // Listen for authentication failures (token expired, etc.)
        window.addEventListener('auth-failure', (event) => {
            const { message } = event.detail;
            this.handleAuthFailure(message);
        });
    }

    async checkAPIHealth() {
        try {
            const health = await window.apiClient.getHealthStatus();
            
            if (!health.success) {
                throw new Error('API health check failed');
            }

            // Check if required services are configured
            const services = health.services || {};
            const warnings = [];

            if (services.googleDrive !== 'configured') {
                warnings.push('Google Drive integration is not configured');
            }

            if (services.etsy !== 'configured') {
                warnings.push('Etsy integration is not configured');
            }

            if (services.ai !== 'configured') {
                warnings.push('AI metadata generation is not configured');
            }

            if (warnings.length > 0) {
                console.warn('Service configuration warnings:', warnings);
            }

        } catch (error) {
            console.error('API health check failed:', error);
            this.showGlobalError('Unable to connect to server. Please check your connection and try again.');
            throw error;
        }
    }

    async initializeAuth() {
        try {
            this.authStatus = await window.apiClient.getAuthStatus();
            
            // Update UI based on auth status
            this.updateGlobalAuthUI();

        } catch (error) {
            console.error('Failed to check authentication status:', error);
            // Don't throw here, app can work without auth
        }
    }

    setupPeriodicAuthCheck() {
        // Check auth status every 5 minutes
        setInterval(async () => {
            try {
                const newStatus = await window.apiClient.getAuthStatus();
                
                // Check if auth status changed
                if (this.hasAuthStatusChanged(newStatus)) {
                    this.authStatus = newStatus;
                    this.updateGlobalAuthUI();
                }
            } catch (error) {
                console.error('Periodic auth check failed:', error);
            }
        }, 5 * 60 * 1000);
    }

    hasAuthStatusChanged(newStatus) {
        if (!this.authStatus) return true;

        return (
            this.authStatus.authenticated !== newStatus.authenticated ||
            this.authStatus.services?.googleDrive?.connected !== newStatus.services?.googleDrive?.connected ||
            this.authStatus.services?.etsy?.connected !== newStatus.services?.etsy?.connected
        );
    }

    updateGlobalAuthUI() {
        // Update navigation or global UI elements based on auth status
        const authIndicator = document.getElementById('auth-indicator');
        if (authIndicator) {
            if (this.authStatus?.authenticated) {
                authIndicator.innerHTML = `
                    <span class="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                    <span class="text-sm text-green-600">Connected</span>
                `;
            } else {
                authIndicator.innerHTML = `
                    <span class="w-2 h-2 bg-gray-400 rounded-full mr-2"></span>
                    <span class="text-sm text-gray-500">Not Connected</span>
                `;
            }
        }

        // Emit event for other components to listen to
        window.dispatchEvent(new CustomEvent('auth-status-updated', {
            detail: this.authStatus
        }));
    }

    handleAuthSuccess(service, token) {
        console.log(`${service} authentication successful`);
        
        // Show success notification
        this.showNotification(`Successfully connected to ${this.capitalizeFirst(service)}!`, 'success');
        
        // Refresh auth status
        this.initializeAuth();
        
        // If we're on the settings page, refresh the settings manager
        if (window.settingsManager) {
            window.settingsManager.checkAuthenticationStatus();
        }
    }

    handleAuthError(service, error) {
        console.error(`${service} authentication failed:`, error);
        
        // Show error notification
        this.showNotification(`Failed to connect to ${this.capitalizeFirst(service)}: ${error}`, 'error');
    }

    handleAuthFailure(message) {
        console.warn('Authentication failure:', message);
        
        // Show warning notification
        this.showNotification(message, 'warning');
        
        // Clear auth status
        this.authStatus = null;
        this.updateGlobalAuthUI();
    }

    showGlobalError(message) {
        this.showNotification(message, 'error', 10000); // Show for 10 seconds
    }

    showNotification(message, type = 'info', duration = 5000) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 z-50 max-w-sm p-4 rounded-2xl shadow-lg transform transition-all duration-300 translate-x-full`;
        
        // Set notification style based on type
        const styles = {
            success: 'bg-green-50 border border-green-200 text-green-800',
            error: 'bg-red-50 border border-red-200 text-red-800',
            warning: 'bg-yellow-50 border border-yellow-200 text-yellow-800',
            info: 'bg-blue-50 border border-blue-200 text-blue-800'
        };
        
        const icons = {
            success: 'fas fa-check-circle text-green-500',
            error: 'fas fa-exclamation-triangle text-red-500',
            warning: 'fas fa-exclamation-triangle text-yellow-500',
            info: 'fas fa-info-circle text-blue-500'
        };
        
        notification.className += ` ${styles[type]}`;
        
        notification.innerHTML = `
            <div class="flex items-start">
                <i class="${icons[type]} mr-3 mt-1"></i>
                <div class="flex-1">
                    <p class="text-sm font-medium">${message}</p>
                </div>
                <button onclick="this.parentElement.parentElement.remove()" 
                        class="ml-3 text-gray-400 hover:text-gray-600">
                    <i class="fas fa-times text-sm"></i>
                </button>
            </div>
        `;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.classList.remove('translate-x-full');
        }, 100);
        
        // Auto remove after duration
        if (duration > 0) {
            setTimeout(() => {
                notification.classList.add('translate-x-full');
                setTimeout(() => {
                    if (notification.parentElement) {
                        notification.remove();
                    }
                }, 300);
            }, duration);
        }
    }

    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    // Public methods for other components to use
    getAuthStatus() {
        return this.authStatus;
    }

    async refreshAuthStatus() {
        await this.initializeAuth();
        return this.authStatus;
    }

    isAuthenticated() {
        return this.authStatus?.authenticated || false;
    }

    isServiceConnected(service) {
        return this.authStatus?.services?.[service]?.connected || false;
    }
}

// Initialize the app
window.app = new App();

console.log('App controller loaded');