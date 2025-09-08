// OAuth Status Manager for Upload Page
class OAuthStatusManager {
    constructor() {
        this.authStatus = null;
        this.init();
    }

    async init() {
        // Check auth status on page load
        await this.checkAuthStatus();
        
        // Listen for auth status updates
        window.addEventListener('auth-status-updated', (event) => {
            this.updateStatusIndicators(event.detail);
        });
        
        // Set up periodic status checks
        this.setupPeriodicChecks();
    }

    async checkAuthStatus() {
        try {
            if (window.apiClient) {
                this.authStatus = await window.apiClient.getAuthStatus();
                this.updateStatusIndicators(this.authStatus);
            }
        } catch (error) {
            console.error('Error checking auth status:', error);
            this.setStatusIndicators(false, false);
        }
    }

    updateStatusIndicators(authStatus) {
        if (!authStatus) {
            this.setStatusIndicators(false, false);
            return;
        }

        const googleConnected = authStatus.services?.googleDrive?.connected || false;
        const etsyConnected = authStatus.services?.etsy?.connected || false;
        
        this.setStatusIndicators(googleConnected, etsyConnected);
    }

    setStatusIndicators(googleConnected, etsyConnected) {
        // Update desktop indicators
        this.updateStatusDot('google-status-dot', googleConnected);
        this.updateStatusDot('etsy-status-dot', etsyConnected);
        
        // Update mobile indicators
        this.updateStatusDot('mobile-google-status-dot', googleConnected);
        this.updateStatusDot('mobile-etsy-status-dot', etsyConnected);
        
        // Update status text
        this.updateStatusText('google-status-text', googleConnected ? 'Google Drive ✓' : 'Google Drive ✗');
        this.updateStatusText('etsy-status-text', etsyConnected ? 'Etsy ✓' : 'Etsy ✗');
        
        // Update mobile status text
        this.updateStatusText('mobile-google-status-text', googleConnected ? 'Google Drive ✓' : 'Google Drive ✗');
        this.updateStatusText('mobile-etsy-status-text', etsyConnected ? 'Etsy ✓' : 'Etsy ✗');
    }

    updateStatusDot(elementId, isConnected) {
        const dot = document.getElementById(elementId);
        if (dot) {
            // Reset classes
            dot.className = 'w-2 h-2 rounded-full oauth-status-dot';
            
            // Add status class
            if (isConnected) {
                dot.classList.add('connected', 'animate-pulse');
            } else {
                dot.classList.add('disconnected');
            }
        }
    }

    updateStatusText(elementId, text) {
        const textElement = document.getElementById(elementId);
        if (textElement) {
            textElement.textContent = text;
            
            // Add CSS classes based on status
            textElement.className = 'text-xs oauth-status-text';
            if (text.includes('✓')) {
                textElement.classList.add('connected');
            } else {
                textElement.classList.add('disconnected');
            }
        }
    }

    setupPeriodicChecks() {
        // Check auth status every 30 seconds
        setInterval(async () => {
            try {
                if (window.apiClient) {
                    const newStatus = await window.apiClient.getAuthStatus();
                    if (this.hasStatusChanged(newStatus)) {
                        this.authStatus = newStatus;
                        this.updateStatusIndicators(newStatus);
                    }
                }
            } catch (error) {
                console.error('Error in periodic auth check:', error);
            }
        }, 30000);
    }

    hasStatusChanged(newStatus) {
        if (!this.authStatus) return true;
        
        return (
            this.authStatus.services?.googleDrive?.connected !== newStatus.services?.googleDrive?.connected ||
            this.authStatus.services?.etsy?.connected !== newStatus.services?.etsy?.connected
        );
    }

    // Public method to refresh status
    async refreshStatus() {
        await this.checkAuthStatus();
    }
}

// Initialize OAuth status manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.oauthStatusManager = new OAuthStatusManager();
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OAuthStatusManager;
}
