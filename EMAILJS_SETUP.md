# EmailJS Setup Guide

This guide will help you configure EmailJS to enable the contact form functionality.

## Step 1: Create EmailJS Account

1. Go to [EmailJS.com](https://www.emailjs.com/)
2. Sign up for a free account
3. Verify your email address

## Step 2: Create Email Service

1. In your EmailJS dashboard, go to "Email Services"
2. Click "Add New Service"
3. Choose your email provider (Gmail, Outlook, etc.)
4. Follow the setup instructions for your provider
5. Note down the **Service ID** (e.g., `service_abc123`)

## Step 3: Create Email Template

1. Go to "Email Templates" in your dashboard
2. Click "Create New Template"
3. Use this template structure:

```
Subject: New Contact Form Message: {{subject}}

From: {{from_name}} ({{from_email}})
Subject: {{subject}}

Message:
{{message}}

---
This message was sent via the ListGenie contact form.
```

4. Save the template and note the **Template ID** (e.g., `template_xyz789`)

## Step 4: Get Public Key

1. Go to "Account" → "General" in your dashboard
2. Find your **Public Key** (e.g., `user_abcdef123456`)

## Step 5: Update Environment Variables

Update your `.env` file with the EmailJS configuration:

```env
# EmailJS Configuration
EMAILJS_SERVICE_ID=your_service_id_here
EMAILJS_TEMPLATE_ID=your_template_id_here
EMAILJS_PUBLIC_KEY=your_public_key_here
CONTACT_EMAIL=your_email@example.com
```

Replace the placeholder values with your actual EmailJS credentials:
- `EMAILJS_SERVICE_ID`: The Service ID from Step 2
- `EMAILJS_TEMPLATE_ID`: The Template ID from Step 3
- `EMAILJS_PUBLIC_KEY`: The Public Key from Step 4
- `CONTACT_EMAIL`: The email address where you want to receive contact form messages

## Step 6: Test the Contact Form

1. Start your development server: `npm run dev`
2. Navigate to the contact page
3. Fill out and submit the contact form
4. Check your email for the message

## Troubleshooting

### Common Issues:

1. **"EmailJS configuration incomplete" error**
   - Make sure all environment variables are set correctly
   - Restart your server after updating the `.env` file

2. **"Failed to send email" error**
   - Check that your Service ID and Template ID are correct
   - Verify your email service is properly configured in EmailJS
   - Check the browser console for detailed error messages

3. **Template variables not working**
   - Make sure your template uses the correct variable names: `{{from_name}}`, `{{from_email}}`, `{{subject}}`, `{{message}}`
   - Test your template in the EmailJS dashboard

### Rate Limits:

EmailJS free tier includes:
- 200 emails per month
- Rate limit of 50 emails per hour

For production use, consider upgrading to a paid plan.

## Security Notes

- The Public Key is safe to expose in client-side code
- Never expose your Private Key in client-side code
- The Service ID and Template ID are also safe to expose
- Consider implementing additional spam protection for production use

## Alternative: Server-Side Email

For better security and control, you can also implement server-side email sending using:
- Nodemailer with SMTP
- SendGrid API
- AWS SES
- Other email service providers

This would require moving the email sending logic to your Express server instead of using client-side EmailJS.