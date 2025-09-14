const request = require('supertest');
const express = require('express');
const contactRoutes = require('../contact');

// Create test app
const app = express();
app.use(express.json());
app.use('/api/contact', contactRoutes);

describe('Contact Routes', () => {
    describe('GET /api/contact/config', () => {
        beforeEach(() => {
            // Clear environment variables
            delete process.env.EMAILJS_SERVICE_ID;
            delete process.env.EMAILJS_TEMPLATE_ID;
            delete process.env.EMAILJS_PUBLIC_KEY;
            delete process.env.CONTACT_EMAIL;
        });

        it('should return config when all environment variables are set', async () => {
            // Set test environment variables
            process.env.EMAILJS_SERVICE_ID = 'test_service_id';
            process.env.EMAILJS_TEMPLATE_ID = 'test_template_id';
            process.env.EMAILJS_PUBLIC_KEY = 'test_public_key';
            process.env.CONTACT_EMAIL = 'test@example.com';

            const response = await request(app)
                .get('/api/contact/config')
                .expect(200);

            expect(response.body).toEqual({
                success: true,
                config: {
                    serviceId: 'test_service_id',
                    templateId: 'test_template_id',
                    publicKey: 'test_public_key',
                    contactEmail: 'test@example.com'
                }
            });
        });

        it('should return error when required environment variables are missing', async () => {
            // Only set some variables
            process.env.EMAILJS_SERVICE_ID = 'test_service_id';
            // Missing EMAILJS_TEMPLATE_ID and EMAILJS_PUBLIC_KEY

            const response = await request(app)
                .get('/api/contact/config')
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('EmailJS configuration incomplete');
            expect(response.body.missingFields).toContain('templateId');
            expect(response.body.missingFields).toContain('publicKey');
        });

        it('should handle missing contact email gracefully', async () => {
            // Set required variables but not contact email
            process.env.EMAILJS_SERVICE_ID = 'test_service_id';
            process.env.EMAILJS_TEMPLATE_ID = 'test_template_id';
            process.env.EMAILJS_PUBLIC_KEY = 'test_public_key';

            const response = await request(app)
                .get('/api/contact/config')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.config.contactEmail).toBeUndefined();
        });
    });

    describe('GET /api/contact/health', () => {
        beforeEach(() => {
            // Clear environment variables
            delete process.env.EMAILJS_SERVICE_ID;
            delete process.env.EMAILJS_TEMPLATE_ID;
            delete process.env.EMAILJS_PUBLIC_KEY;
        });

        it('should return configured: true when all variables are set', async () => {
            process.env.EMAILJS_SERVICE_ID = 'test_service_id';
            process.env.EMAILJS_TEMPLATE_ID = 'test_template_id';
            process.env.EMAILJS_PUBLIC_KEY = 'test_public_key';

            const response = await request(app)
                .get('/api/contact/health')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.configured).toBe(true);
            expect(response.body.timestamp).toBeDefined();
        });

        it('should return configured: false when variables are missing', async () => {
            const response = await request(app)
                .get('/api/contact/health')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.configured).toBe(false);
            expect(response.body.timestamp).toBeDefined();
        });
    });
});