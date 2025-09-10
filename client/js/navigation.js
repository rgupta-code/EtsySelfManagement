// Navigation functionality for ListGenie
class NavigationManager {
    constructor() {
        this.currentPage = 'home';
        this.init();
    }

    init() {
        this.setupEventListeners();
        // Don't automatically show home page since we're using separate HTML files
        // Each page will handle its own initialization
    }

    setupEventListeners() {
        // Mobile menu toggle
        const mobileMenuButton = document.getElementById('mobile-menu-button');
        const mobileMenu = document.getElementById('mobile-menu');

        if (mobileMenuButton && mobileMenu) {
            mobileMenuButton.addEventListener('click', (e) => {
                e.preventDefault();
                mobileMenu.classList.toggle('hidden');
            });
        }

        // Navigation links
        const navLinks = document.querySelectorAll('.nav-link');
        console.log('Found navigation links:', navLinks.length);
        
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                const href = link.getAttribute('href');
                console.log('Navigation link clicked:', href);
                
                // If it's a hash link (SPA navigation), prevent default and handle internally
                if (href && href.startsWith('#')) {
                    e.preventDefault();
                    const page = href.substring(1);
                    this.showPage(page);
                    
                    // Close mobile menu if open
                    if (mobileMenu) {
                        mobileMenu.classList.add('hidden');
                    }
                } else {
                    // For regular HTML file links, let the browser handle navigation
                    console.log('Allowing browser navigation to:', href);
                    // Close mobile menu if open
                    if (mobileMenu) {
                        mobileMenu.classList.add('hidden');
                    }
                }
            });
        });

        // Handle browser back/forward buttons
        window.addEventListener('popstate', (e) => {
            const page = e.state?.page || 'home';
            this.showPage(page, false);
        });

        // Contact form submission
        const contactForm = document.getElementById('contact-form');
        if (contactForm) {
            contactForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleContactForm(e.target);
            });
        }
    }

    showPage(pageName, updateHistory = true) {
        // Hide all pages
        const pages = document.querySelectorAll('.page-section');
        pages.forEach(page => {
            page.classList.add('hidden');
        });

        // Show requested page
        const targetPage = document.getElementById(`${pageName}-page`);
        if (targetPage) {
            targetPage.classList.remove('hidden');
            this.currentPage = pageName;

            // Initialize page-specific functionality
            this.initializePageFunctionality(pageName);

            // Update navigation active states
            this.updateActiveNavigation(pageName);

            // Update browser history
            if (updateHistory) {
                const url = pageName === 'home' ? '/' : `/#${pageName}`;
                history.pushState({ page: pageName }, '', url);
            }

            // Update page title
            this.updatePageTitle(pageName);

            // Scroll to top
            window.scrollTo(0, 0);
        }
    }

    initializePageFunctionality(pageName) {
        switch (pageName) {
            case 'upload':
                // Initialize upload manager if not already initialized
                if (!window.uploadManager) {
                    window.uploadManager = new UploadManager();
                }
                break;
            case 'settings':
                // Initialize settings manager if not already initialized
                if (!window.settingsManager) {
                    window.settingsManager = new SettingsManager();
                }
                break;
        }
    }

    updateActiveNavigation(activePage) {
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            const href = link.getAttribute('href');
            const linkPage = href ? href.substring(1) : '';
            
            if (linkPage === activePage) {
                link.classList.remove('text-gray-500');
                link.classList.add('text-gray-900');
            } else {
                link.classList.remove('text-gray-900');
                link.classList.add('text-gray-500');
            }
        });
    }

    updatePageTitle(pageName) {
        const titles = {
            home: 'ListGenie - Streamline Your Etsy Listings',
            upload: 'Upload Images - ListGenie',
            settings: 'Settings - ListGenie',
            about: 'About Us - ListGenie',
            contact: 'Contact Us - ListGenie'
        };

        document.title = titles[pageName] || titles.home;
    }

    async handleContactForm(form) {
        const formData = new FormData(form);
        const submitButton = form.querySelector('button[type="submit"]');
        const originalText = submitButton.innerHTML;

        // Show loading state
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Sending...';

        try {
            // Simulate form submission (replace with actual API call)
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Show success message
            this.showContactSuccess();
            form.reset();

        } catch (error) {
            console.error('Contact form error:', error);
            this.showContactError();
        } finally {
            // Reset button
            submitButton.disabled = false;
            submitButton.innerHTML = originalText;
        }
    }

    showContactSuccess() {
        const form = document.getElementById('contact-form');
        const successMessage = document.createElement('div');
        successMessage.className = 'bg-green-50 border border-green-200 rounded-2xl p-4 mb-6';
        successMessage.innerHTML = `
            <div class="flex">
                <i class="fas fa-check-circle text-green-400 mr-3 mt-1"></i>
                <div>
                    <h3 class="text-sm font-medium text-green-800">Message Sent!</h3>
                    <p class="mt-1 text-sm text-green-700">
                        Thank you for your message. We'll get back to you within 24 hours.
                    </p>
                </div>
            </div>
        `;

        form.parentNode.insertBefore(successMessage, form);

        // Remove success message after 5 seconds
        setTimeout(() => {
            successMessage.remove();
        }, 5000);
    }

    showContactError() {
        const form = document.getElementById('contact-form');
        const errorMessage = document.createElement('div');
        errorMessage.className = 'bg-red-50 border border-red-200 rounded-2xl p-4 mb-6';
        errorMessage.innerHTML = `
            <div class="flex">
                <i class="fas fa-exclamation-triangle text-red-400 mr-3 mt-1"></i>
                <div>
                    <h3 class="text-sm font-medium text-red-800">Error Sending Message</h3>
                    <p class="mt-1 text-sm text-red-700">
                        There was a problem sending your message. Please try again or contact us directly at support@ListGenie.com.
                    </p>
                </div>
            </div>
        `;

        form.parentNode.insertBefore(errorMessage, form);

        // Remove error message after 5 seconds
        setTimeout(() => {
            errorMessage.remove();
        }, 5000);
    }

    // Handle initial page load based on URL hash
    handleInitialLoad() {
        // Only handle hash navigation if we're on a single-page app
        // For separate HTML files, let the browser handle navigation normally
        const hash = window.location.hash;
        if (hash && hash.length > 1) {
            const page = hash.substring(1);
            this.showPage(page, false);
        }
        // Don't automatically show home page for separate HTML files
    }
}

// Initialize navigation manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing navigation...');
    window.navigationManager = new NavigationManager();
    window.navigationManager.handleInitialLoad();
    console.log('Navigation manager initialized');
});

// Global function for showing pages (called from HTML)
function showPage(pageName) {
    if (window.navigationManager) {
        window.navigationManager.showPage(pageName);
    }
}

console.log('Navigation module loaded');