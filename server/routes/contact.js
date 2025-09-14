const express = require('express');
const router = express.Router();

/**
 * Get EmailJS configuration
 * Returns public configuration needed for client-side EmailJS
 */
router.get('/config', (req, res) => {
    try {
        const config = {
            serviceId: process.env.EMAILJS_SERVICE_ID,
            templateId: process.env.EMAILJS_TEMPLATE_ID,
            publicKey: process.env.EMAILJS_PUBLIC_KEY,
            contactEmail: process.env.CONTACT_EMAIL
        };

        // Validate that required config is present
        const requiredFields = ['serviceId', 'templateId', 'publicKey'];
        const missingFields = requiredFields.filter(field => !config[field]);
        
        if (missingFields.length > 0) {
            return res.status(500).json({
                success: false,
                error: 'EmailJS configuration incomplete',
                missingFields
            });
        }

        res.json({
            success: true,
            config
        });
    } catch (error) {
        console.error('Error getting EmailJS config:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get email configuration'
        });
    }
});

/**
 * Health check for contact functionality
 */
router.get('/health', (req, res) => {
    const isConfigured = !!(
        process.env.EMAILJS_SERVICE_ID &&
        process.env.EMAILJS_TEMPLATE_ID &&
        process.env.EMAILJS_PUBLIC_KEY
    );

    res.json({
        success: true,
        configured: isConfigured,
        timestamp: new Date().toISOString()
    });
});

module.exports = router;