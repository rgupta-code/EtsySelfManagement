// EmailJS Contact Form Handler
class ContactFormHandler {
    constructor() {
        this.form = document.getElementById('contact-form');
        this.submitButton = this.form.querySelector('button[type="submit"]');
        this.originalButtonText = this.submitButton.innerHTML;
        
        this.init();
    }

    async init() {
        // Initialize EmailJS
        try {
            // Check if EmailJS is loaded globally
            if (typeof emailjs === 'undefined') {
                throw new Error('EmailJS library not loaded. Please refresh the page.');
            }

            this.emailjs = emailjs;
            
            // Verify EmailJS is properly loaded
            if (!this.emailjs || typeof this.emailjs.init !== 'function') {
                throw new Error('EmailJS library not properly loaded');
            }
            
            // Initialize with public key from environment (will be loaded from server)
            await this.loadEmailJSConfig();
            
            // Bind form submit event
            this.form.addEventListener('submit', this.handleSubmit.bind(this));
        } catch (error) {
            console.error('Failed to initialize EmailJS:', error);
            this.showError('Failed to initialize email service. Please refresh the page and try again.');
        }
    }

    async loadEmailJSConfig() {
        try {
            const response = await fetch('/api/contact/config');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to load email configuration');
            }
            
            this.config = data.config;
            
            // Verify config has required fields
            if (!this.config.publicKey) {
                throw new Error('EmailJS public key not found in configuration');
            }
            
            // Initialize EmailJS with the public key
            this.emailjs.init(this.config.publicKey);
        } catch (error) {
            console.error('Failed to load EmailJS configuration:', error);
            throw error;
        }
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        if (!this.validateForm()) {
            return;
        }

        this.setLoading(true);

        try {
            const formData = new FormData(this.form);
            const templateParams = {
                from_name: formData.get('name'),
                from_email: formData.get('email'),
                subject: formData.get('subject'),
                message: formData.get('message'),
                to_email: this.config.contactEmail || 'contact@example.com'
            };

            const response = await this.emailjs.send(
                this.config.serviceId,
                this.config.templateId,
                templateParams
            );

            if (response.status === 200) {
                this.showSuccess('Thank you for your message! We\'ll get back to you soon.');
                this.form.reset();
            } else {
                throw new Error('Failed to send email');
            }
        } catch (error) {
            console.error('Error sending email:', error);
            this.showError('Failed to send message. Please try again or contact us directly.');
        } finally {
            this.setLoading(false);
        }
    }

    validateForm() {
        const requiredFields = ['name', 'email', 'subject', 'message'];
        let isValid = true;

        requiredFields.forEach(fieldName => {
            const field = this.form.querySelector(`[name="${fieldName}"]`);
            const value = field.value.trim();
            
            if (!value) {
                this.showFieldError(field, 'This field is required');
                isValid = false;
            } else {
                this.clearFieldError(field);
            }
        });

        // Validate email format
        const emailField = this.form.querySelector('[name="email"]');
        const emailValue = emailField.value.trim();
        if (emailValue && !this.isValidEmail(emailValue)) {
            this.showFieldError(emailField, 'Please enter a valid email address');
            isValid = false;
        }

        return isValid;
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    showFieldError(field, message) {
        this.clearFieldError(field);
        
        field.classList.add('border-red-500', 'focus:ring-red-500');
        field.classList.remove('border-gray-300', 'focus:ring-primary');
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'text-red-500 text-sm mt-1 field-error';
        errorDiv.textContent = message;
        
        field.parentNode.appendChild(errorDiv);
    }

    clearFieldError(field) {
        field.classList.remove('border-red-500', 'focus:ring-red-500');
        field.classList.add('border-gray-300', 'focus:ring-primary');
        
        const existingError = field.parentNode.querySelector('.field-error');
        if (existingError) {
            existingError.remove();
        }
    }

    setLoading(isLoading) {
        if (isLoading) {
            this.submitButton.disabled = true;
            this.submitButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Sending...';
            this.submitButton.classList.add('opacity-75');
        } else {
            this.submitButton.disabled = false;
            this.submitButton.innerHTML = this.originalButtonText;
            this.submitButton.classList.remove('opacity-75');
        }
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type) {
        // Remove existing notifications
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notification => notification.remove());

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        notification.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex items-center">
                    <i class="fas ${type === 'success' ? 'fa-check-circle text-green-500' : 'fa-exclamation-circle text-red-500'} mr-3"></i>
                    <span class="text-gray-800 font-medium">${message}</span>
                </div>
                <button class="ml-4 text-gray-400 hover:text-gray-600 transition-colors" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        document.body.appendChild(notification);

        // Trigger animation after a brief delay
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.classList.remove('show');
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.remove();
                    }
                }, 300); // Wait for animation to complete
            }
        }, 5000);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ContactFormHandler();
});