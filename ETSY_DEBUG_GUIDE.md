# Etsy OAuth 403 Error Debugging Guide

## Current Issue
You're getting a **HTTP 403 Forbidden** error during the Etsy OAuth token exchange process.

## What I've Added for Debugging

### 1. Enhanced Error Logging
The service now logs detailed information about:
- Request parameters and headers
- Response status and data
- Full error details including the exact response from Etsy

### 2. Parameter Validation
Added validation for all required OAuth parameters:
- Client ID and Client Secret
- Redirect URI format validation
- Authorization code presence
- Code verifier format validation (43-128 characters, URL-safe)

### 3. Detailed Request Logging
The service now logs:
- Individual form data fields
- Request headers
- Credentials (masked for security)
- Redirect URI validation results

## Common Causes of 403 Errors

### 1. **Invalid Credentials**
- Check that your `ETSY_CLIENT_ID` and `ETSY_CLIENT_SECRET` are correct
- Verify they match what's registered in your Etsy app settings

### 2. **Incorrect Redirect URI**
- The redirect URI must **exactly match** what's registered in your Etsy app
- Check for:
  - Protocol (http vs https)
  - Port numbers
  - Trailing slashes
  - Case sensitivity

### 3. **Malformed Request**
- Missing or incorrect parameters
- Invalid code verifier format
- Wrong content type

### 4. **App Configuration Issues**
- App not properly configured in Etsy Developer Portal
- Missing required scopes
- App not approved for production use

## Next Steps

1. **Run the authentication again** and check the console logs for:
   - Parameter validation results
   - Detailed error response from Etsy
   - Request/response details

2. **Verify your Etsy app settings**:
   - Go to https://www.etsy.com/developers/your-apps
   - Check that the redirect URI matches exactly
   - Verify your app is properly configured

3. **Check environment variables**:
   - Ensure `ETSY_CLIENT_ID` and `ETSY_CLIENT_SECRET` are set
   - Verify `ETSY_REDIRECT_URI` matches your app settings

4. **Review the detailed error logs** to see exactly what Etsy is returning

## Expected Log Output

You should now see logs like:
```
All required parameters validated successfully
Code verifier validation passed: { length: 64, format_valid: true }
Redirect URI validation passed: { protocol: 'http:', host: 'localhost:3000', pathname: '/api/auth/etsy/callback' }
Sending token exchange request to Etsy with PKCE...
```

If you see any validation errors, those will help identify the specific issue.

## If the Issue Persists

The enhanced error logging will now show you exactly what Etsy is returning in the 403 response, which will help identify the specific cause of the authentication failure.
