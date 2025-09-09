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
        // Update status indicators
        this.updateStatusCapsule('google-status-capsule', 'google-status-icon', googleConnected);
        this.updateStatusCapsule('etsy-status-capsule', 'etsy-status-icon', etsyConnected);
    }

    updateStatusCapsule(capsuleId, iconId, isConnected) {
        const capsule = document.getElementById(capsuleId);
        const icon = document.getElementById(iconId);
        
        if (capsule && icon) {
            // Reset classes
            capsule.className = 'px-3 py-0.5 rounded-full oauth-status-capsule flex items-center space-x-2';
            icon.className = 'fas text-xs';
            
            if (isConnected) {
                // Connected state - dark green background with white text and check icon
                capsule.classList.add('bg-green-600', 'border', 'border-green-700');
                icon.classList.add('fa-check', 'text-white');
                // Update text color to white
                const textElement = capsule.querySelector('span');
                if (textElement) {
                    textElement.classList.add('text-white');
                }
            } else {
                // Disconnected state - gray background with cross icon
                capsule.classList.add('bg-gray-200', 'border', 'border-gray-300');
                icon.classList.add('fa-times', 'text-gray-500');
                // Reset text color to default
                const textElement = capsule.querySelector('span');
                if (textElement) {
                    textElement.classList.remove('text-white');
                }
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
