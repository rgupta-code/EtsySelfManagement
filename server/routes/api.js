const express = require('express');
const { createCompleteUploadMiddleware } = require('../middleware/uploadMiddleware');
const { APIError, asyncHandler, createExternalAPIError } = require('../middleware/errorHandler');
const { optionalAuth, requireAuth, requireGoogleAuth, requireEtsyAuth } = require('../middleware/authMiddleware');
const ImageService = require('../services/imageService');
const FileService = require('../services/fileService');
const GoogleDriveService = require('../services/googleDriveService');
const AIService = require('../services/aiService');
const EtsyService = require('../services/etsyService');
const SettingsService = require('../services/settingsService');

const router = express.Router();

// Service instances
const imageService = new ImageService();
const fileService = FileService; // Singleton instance
const googleDriveService = new GoogleDriveService();
const aiService = new AIService();
const etsyService = new EtsyService();
const settingsService = new SettingsService();

/**
 * Progress tracking for processing requests
 */
const processingStatus = new Map();

/**
 * Generate unique processing ID
 */
function generateProcessingId() {
  return `proc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Update processing status
 */
function updateProcessingStatus(processingId, step, status, data = {}) {
  const current = processingStatus.get(processingId) || {
    id: processingId,
    startTime: new Date().toISOString(),
    steps: []
  };
  
  current.steps.push({
    step,
    status,
    timestamp: new Date().toISOString(),
    ...data
  });
  
  current.currentStep = step;
  current.currentStatus = status;
  
  processingStatus.set(processingId, current);
  return current;
}

/**
 * Main upload processing endpoint
 * Orchestrates all services to process images and create listing
 */
router.post('/upload', optionalAuth, createCompleteUploadMiddleware('images', 10), asyncHandler(async (req, res) => {
  const processingId = generateProcessingId();
  
  try {
    // Initialize processing status
    updateProcessingStatus(processingId, 'initialization', 'started', {
      fileCount: req.files.length,
      totalSize: req.uploadSummary.totalSize
    });

    // Send immediate response with processing ID
    res.json({
      success: true,
      processingId,
      message: 'Upload received, processing started',
      fileCount: req.files.length,
      estimatedTime: '2-5 minutes'
    });

    // Continue processing asynchronously
    processUploadAsync(processingId, req.files, req.body, req.user);

  } catch (error) {
    console.error('Upload endpoint error:', error);
    updateProcessingStatus(processingId, 'initialization', 'failed', {
      error: error.message
    });
    
    throw new APIError(
      `Upload processing failed: ${error.message}`,
      500,
      'UPLOAD_PROCESSING_ERROR',
      { processingId }
    );
  }
}));

/**
 * Asynchronous processing function
 */
async function processUploadAsync(processingId, files, options = {}, user = null) {
  let tempDir = null;
  
  try {
    // Step 1: Validate and prepare images
    updateProcessingStatus(processingId, 'validation', 'started');
    
    const validation = imageService.validateImageFiles(files);
    if (validation.errors.length > 0) {
      updateProcessingStatus(processingId, 'validation', 'completed_with_warnings', {
        warnings: validation.errors,
        validFileCount: validation.validFiles.length
      });
    } else {
      updateProcessingStatus(processingId, 'validation', 'completed', {
        validFileCount: validation.validFiles.length
      });
    }

    const validFiles = validation.validFiles;
    if (validFiles.length === 0) {
      throw new Error('No valid images to process');
    }

    console.log('***********loading user settings***********');
    // Step 2: Load user settings
    updateProcessingStatus(processingId, 'settings', 'started');
    const userId = user?.id || options.userId || 'default';
    const settings = await settingsService.loadSettings(userId);
    updateProcessingStatus(processingId, 'settings', 'completed');

    // Step 3: Process images (watermarking)
    updateProcessingStatus(processingId, 'watermarking', 'started');
    const watermarkResult = await imageService.watermarkImages(validFiles, settings.watermark);
    updateProcessingStatus(processingId, 'watermarking', 'completed', {
      processedCount: watermarkResult.watermarkedImages.length,
      errors: watermarkResult.errors
    });

    // Step 3.1: Create video (if multiple images)
    let videoBuffer = null;
    if (validFiles.length >= 2) {
      updateProcessingStatus(processingId, 'video_create', 'started');
      videoBuffer = await imageService.createSlideshowVideo(validFiles.map(file => file.buffer), settings.slideshow);
      updateProcessingStatus(processingId, 'video_create', 'completed');
    }

    // Step 4: Create collage (if multiple images)
    let collageBuffer = null;
    if (validFiles.length >= 2 && settings.collage.enabled) {
      updateProcessingStatus(processingId, 'collage', 'started');
      try {
        collageBuffer = await imageService.createCollage(validFiles, settings.collage);
        updateProcessingStatus(processingId, 'collage', 'completed');
      } catch (error) {
        updateProcessingStatus(processingId, 'collage', 'failed', { error: error.message });
      }
    } else {
      updateProcessingStatus(processingId, 'collage', 'skipped', {
        reason: validFiles.length < 2 ? 'insufficient_images' : 'disabled'
      });
    }

    // Step 5: Package original files
    updateProcessingStatus(processingId, 'packaging', 'started');
    const zipBuffer = await fileService.packageOriginals(validFiles, `listing_${processingId}`);
    updateProcessingStatus(processingId, 'packaging', 'completed', {
      zipSize: zipBuffer.length
    });

    // Step 6: Upload to Google Drive (if configured and authenticated)
    let driveLink = null;
    if (settings.googleDrive.autoUpload && user?.session?.googleAuth) {
      updateProcessingStatus(processingId, 'drive_upload', 'started');
      try {
        // Initialize Google Drive service with user's tokens
        await googleDriveService.initialize({
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uri: process.env.GOOGLE_REDIRECT_URI
        });
        
        // Set user's access token
        googleDriveService.setAccessToken(user.session.googleAuth.accessToken);
        
        const uploadResult = await googleDriveService.uploadZipFile(
          zipBuffer, 
          `listing_${processingId}.zip`
        );
        driveLink = await googleDriveService.createShareableLink(uploadResult.fileId);
        updateProcessingStatus(processingId, 'drive_upload', 'completed', {
          fileId: uploadResult.fileId,
          link: driveLink
        });
      } catch (error) {
        updateProcessingStatus(processingId, 'drive_upload', 'failed', {
          error: error.message
        });
      }
    } else {
      updateProcessingStatus(processingId, 'drive_upload', 'skipped', {
        reason: !settings.googleDrive.autoUpload ? 'disabled' : 'not_authenticated'
      });
    }

    // Step 7: Generate AI metadata
    updateProcessingStatus(processingId, 'ai_metadata', 'started');
    let metadata = null;
    try {
      const imageBuffers = validFiles.map(file => file.buffer);
      metadata = await aiService.generateMetadata(imageBuffers);
      console.log('AI metadata', metadata);
      updateProcessingStatus(processingId, 'ai_metadata', 'completed', {
        titleLength: metadata.title.length,
        tagCount: metadata.tags.length,
        descriptionLength: metadata.description.length
      });
    } catch (error) {
      console.error('Error generating AI metadata:', error);
      updateProcessingStatus(processingId, 'ai_metadata', 'failed', {
        error: error.message
      });
      // Provide fallback metadata
      metadata = {
        title: 'Handmade Product - Please Edit Title',
        tags: ['handmade', 'unique', 'gift', 'custom', 'artisan'],
        description: 'Beautiful handmade product. Please add your own description.',
        confidence: 0
      };
    }

    // Step 8: Create Etsy draft listing (if configured and authenticated)
    let etsyListing = null;
    if (settings.etsy.autoDraft && user?.session?.etsyAuth) {
      updateProcessingStatus(processingId, 'etsy_listing', 'started');
      try {
        // Initialize Etsy service with user's tokens
        await etsyService.initialize({
          client_id: process.env.ETSY_CLIENT_ID,
          client_secret: process.env.ETSY_CLIENT_SECRET,
          redirect_uri: process.env.ETSY_REDIRECT_URI
        });
        
        // Set user's access token
        etsyService.setAccessToken(user.session.etsyAuth.accessToken);
        
        const listingData = {
          title: metadata.title,
          description: metadata.description,
          tags: metadata.tags,
          price: options.price || 10.00, // Default price
          quantity: options.quantity || 1,
          shop_id: user.session.etsyAuth.shopId
        };
      
        etsyListing = await etsyService.createDraftListing(listingData);
        
        // Upload images to listing
        const imagesToUpload = [];
        
        // Add watermarked images
        if (watermarkResult.watermarkedImages.length > 0) {
          imagesToUpload.push(...watermarkResult.watermarkedImages);
        }
        
        // Add collage if created
        if (collageBuffer) {
          imagesToUpload.push({
            buffer: collageBuffer,
            filename: 'collage.jpg',
            mimetype: 'image/jpeg'
          });
        }
        
        // Upload all images to listing
        if (imagesToUpload.length > 0) {
          const uploadedImages = await etsyService.uploadListingImages(
            etsyListing.listing_id,
            imagesToUpload
          );
          etsyListing.uploadedImages = uploadedImages;
        }

        // Upload video to listing
        if (videoBuffer) {
           // Create a video object to pass to the method
          const videos = [{
            buffer: videoBuffer,
            filename: 'myVideo.mp4',      // optional, will default if not provided
            mimeType: 'video/mp4',        // optional, defaults to video/mp4
          }];
          const uploadedVideo = await etsyService.uploadListingVideos(
            etsyListing.listing_id,
            videos
          );
          etsyListing.uploadedVideo = uploadedVideo;
        }
        
        updateProcessingStatus(processingId, 'etsy_listing', 'completed', {
          listingId: etsyListing.listing_id,
          editUrl: etsyListing.editUrl
        });
      } catch (error) {
        updateProcessingStatus(processingId, 'etsy_listing', 'failed', {
          error: error.message
        });
        
      }
    } else {
      updateProcessingStatus(processingId, 'etsy_listing', 'skipped', {
        reason: !settings.etsy.autoDraft ? 'disabled' : 'not_authenticated'
      });
    }

    // Step 9: Finalize processing
    updateProcessingStatus(processingId, 'finalization', 'completed', {
      totalProcessingTime: Date.now() - new Date(processingStatus.get(processingId).startTime).getTime(),
      results: {
        processedImages: watermarkResult.watermarkedImages.length,
        collageCreated: !!collageBuffer,
        driveLink,
        metadata,
        etsyListing
      }
    });

  } catch (error) {
    console.error(`Processing error for ${processingId}:`, error);
    updateProcessingStatus(processingId, 'error', 'failed', {
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    // Cleanup temporary files
    if (tempDir) {
      try {
        await fileService.cleanupTempFiles(tempDir);
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
    }
  }
}

/**
 * Get processing status endpoint
 */
router.get('/status/:processingId', (req, res) => {
  const { processingId } = req.params;
  const status = processingStatus.get(processingId);
  
  if (!status) {
    return res.status(404).json({
      success: false,
      error: 'Processing ID not found'
    });
  }
  
  res.json({
    success: true,
    status
  });
});

/**
 * Settings endpoints
 */
router.get('/settings', optionalAuth, asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.query.userId || 'default';
  const settings = await settingsService.loadSettings(userId);
  
  res.json({
    success: true,
    settings
  });
}));

router.put('/settings', optionalAuth, asyncHandler(async (req, res) => {
  if (!req.body.settings) {
    throw new APIError('Settings data is required', 400, 'MISSING_SETTINGS');
  }
  
  const userId = req.user?.id || req.body.userId || 'default';
  const settings = await settingsService.saveSettings(req.body.settings, userId);
  
  res.json({
    success: true,
    settings
  });
}));

router.patch('/settings/:section', optionalAuth, asyncHandler(async (req, res) => {
  const { section } = req.params;
  const userId = req.user?.id || req.body.userId || 'default';
  const updates = req.body.updates;
  
  if (!updates) {
    throw new APIError('Updates data is required', 400, 'MISSING_UPDATES');
  }
  
  const settings = await settingsService.updateSettings(section, updates, userId);
  
  res.json({
    success: true,
    settings
  });
}));



/**
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      imageProcessing: 'available',
      fileManagement: 'available',
      googleDrive: process.env.GOOGLE_CLIENT_ID ? 'configured' : 'not_configured',
      etsy: process.env.ETSY_CLIENT_ID ? 'configured' : 'not_configured',
      ai: process.env.GOOGLE_AI_API_KEY ? 'configured' : 'not_configured'
    }
  });
});

module.exports = router;