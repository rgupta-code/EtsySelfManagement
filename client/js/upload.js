// Upload functionality for ListGenie
class UploadManager {
    constructor() {
        this.selectedFiles = [];
        this.maxFileSize = 10 * 1024 * 1024; // 10MB
        this.allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        this.currentProcessingId = null;
        this.processingSteps = [
            { id: 'validation', name: 'Validating images', icon: 'fas fa-check-circle' },
            { id: 'processing', name: 'Processing watermarks and collages', icon: 'fas fa-image' },
            { id: 'ai-generation', name: 'Generating AI metadata', icon: 'fas fa-robot' },
            { id: 'etsy-creation', name: 'Creating Etsy draft listing', icon: 'fab fa-etsy' }
        ];
        this.retryCount = 0;
        this.maxRetries = 3;
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('file-input');
        const uploadButton = document.getElementById('upload-button');
        
        // Small upload area elements
        const dropZoneSmall = document.getElementById('drop-zone-small');
        const fileInputSmall = document.getElementById('file-input-small');
        const uploadButtonSmall = document.getElementById('upload-button-small');

        // Main drop zone click handler
        if (dropZone) {
            dropZone.addEventListener('click', () => {
                fileInput.click();
            });

            // Drag and drop handlers for main area
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('border-primary', 'bg-primary/5');
            });

            dropZone.addEventListener('dragleave', (e) => {
                e.preventDefault();
                dropZone.classList.remove('border-primary', 'bg-primary/5');
            });

            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('border-primary', 'bg-primary/5');
                this.handleFiles(e.dataTransfer.files);
            });
        }

        // Small drop zone click handler
        if (dropZoneSmall) {
            dropZoneSmall.addEventListener('click', () => {
                fileInputSmall.click();
            });

            // Drag and drop handlers for small area
            dropZoneSmall.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZoneSmall.classList.add('border-primary', 'bg-primary/5');
            });

            dropZoneSmall.addEventListener('dragleave', (e) => {
                e.preventDefault();
                dropZoneSmall.classList.remove('border-primary', 'bg-primary/5');
            });

            dropZoneSmall.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZoneSmall.classList.remove('border-primary', 'bg-primary/5');
                this.handleFiles(e.dataTransfer.files);
            });
        }

        // File input change handlers
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                this.handleFiles(e.target.files);
            });
        }

        if (fileInputSmall) {
            fileInputSmall.addEventListener('change', (e) => {
                this.handleFiles(e.target.files);
            });
        }

        // Upload button handlers
        if (uploadButton) {
            uploadButton.addEventListener('click', () => {
                this.processImages();
            });
        }

        if (uploadButtonSmall) {
            uploadButtonSmall.addEventListener('click', () => {
                this.processImages();
            });
        }
    }

    handleFiles(files) {
        const fileArray = Array.from(files);
        const validFiles = [];
        const errors = [];

        fileArray.forEach(file => {
            const validation = this.validateFile(file);
            if (validation.valid) {
                validFiles.push(file);
            } else {
                errors.push(validation.error);
            }
        });

        if (errors.length > 0) {
            this.showErrors(errors);
        }

        if (validFiles.length > 0) {
            this.selectedFiles = [...this.selectedFiles, ...validFiles];
            this.updatePreview();
            this.hideErrors();
            
            // Show upload button in small area if we're in processing layout
            const uploadButtonContainerSmall = document.getElementById('upload-button-container-small');
            if (uploadButtonContainerSmall && !document.getElementById('processing-layout').classList.contains('hidden')) {
                uploadButtonContainerSmall.classList.remove('hidden');
            }
        }
    }

    validateFile(file) {
        // Check file type
        if (!this.allowedTypes.includes(file.type)) {
            return {
                valid: false,
                error: `${file.name}: Invalid file type. Please use JPEG, PNG, or WebP.`
            };
        }

        // Check file size
        if (file.size > this.maxFileSize) {
            const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
            return {
                valid: false,
                error: `${file.name}: File too large (${sizeMB}MB). Maximum size is 10MB.`
            };
        }

        // Check for duplicates
        const isDuplicate = this.selectedFiles.some(existingFile => 
            existingFile.name === file.name && existingFile.size === file.size
        );

        if (isDuplicate) {
            return {
                valid: false,
                error: `${file.name}: File already selected.`
            };
        }

        return { valid: true };
    }

    showErrors(errors) {
        const errorContainer = document.getElementById('error-container');
        const errorList = document.getElementById('error-list');
        
        errorList.innerHTML = errors.map(error => `<p>• ${error}</p>`).join('');
        errorContainer.classList.remove('hidden');
        
        // Auto-hide errors after 5 seconds
        setTimeout(() => {
            this.hideErrors();
        }, 5000);
    }

    hideErrors() {
        const errorContainer = document.getElementById('error-container');
        errorContainer.classList.add('hidden');
    }

    async updatePreview() {
        const previewContainer = document.getElementById('preview-container');
        const previewGrid = document.getElementById('preview-grid');
        
        if (this.selectedFiles.length === 0) {
            previewContainer.classList.add('hidden');
            return;
        }

        previewGrid.innerHTML = '';
        
        for (const file of this.selectedFiles) {
            const previewCard = await this.createPreviewCard(file);
            previewGrid.appendChild(previewCard);
        }
        
        previewContainer.classList.remove('hidden');
    }

    async createPreviewCard(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                const card = document.createElement('div');
                card.className = 'bg-white rounded-xl shadow-sm overflow-hidden relative group';
                
                const sizeKB = (file.size / 1024).toFixed(1);
                
                card.innerHTML = `
                    <div class="aspect-square relative">
                        <img src="${e.target.result}" alt="${file.name}" 
                             class="w-full h-full object-cover">
                        <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                            <button onclick="uploadManager.removeFile('${file.name}')" 
                                    class="bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-600">
                                <i class="fas fa-times text-xs"></i>
                            </button>
                        </div>
                    </div>
                    <div class="p-2">
                        <p class="text-xs font-medium text-gray-900 truncate" title="${file.name}">
                            ${file.name}
                        </p>
                        <p class="text-xs text-gray-500">${sizeKB} KB</p>
                    </div>
                `;
                
                resolve(card);
            };
            
            reader.readAsDataURL(file);
        });
    }

    removeFile(fileName) {
        this.selectedFiles = this.selectedFiles.filter(file => file.name !== fileName);
        this.updatePreview();
        
        if (this.selectedFiles.length === 0) {
            // Reset file input
            const fileInput = document.getElementById('file-input');
            fileInput.value = '';
        }
    }

    async processImages() {
        if (this.selectedFiles.length === 0) {
            this.showErrors(['Please select at least one image to process.']);
            return;
        }

        // Reset retry count for new processing
        this.retryCount = 0;
        await this.startProcessing();
    }

    async startProcessing() {
        try {
            // Switch to processing layout
            this.switchToProcessingLayout();
            
            // Show selected images in left panel
            this.showSelectedImagesInLeftPanel();
            
            // Reset progress indicators
            this.resetProgressIndicators();
            
            // Reset processing container header to show processing state
            this.resetProcessingContainerHeader();
            
            // Start progress tracking
            this.updateProgressStep('validation', 'in-progress');
            
            // Upload images using API client
            const result = await window.apiClient.uploadImages(
                this.selectedFiles,
                {}, // Additional options can be added here
                (progress) => {
                    // Handle upload progress
                    this.updateUploadProgress(progress.percent);
                }
            );
            
            this.currentProcessingId = result.processingId;
            
            // If we have a processing ID, poll for status updates
            if (result.processingId) {
                await this.pollProcessingStatusWithAPI(result.processingId);
            } else {
                // Complete all steps and show results immediately
                this.completeAllSteps();
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            this.showResults(result);

        } catch (error) {
            console.error('Upload error:', error);
            this.handleProcessingError(error);
        }
    }

    switchToProcessingLayout() {
        // Hide initial upload layout
        document.getElementById('initial-upload-container').classList.add('hidden');
        
        // Show processing layout
        document.getElementById('processing-layout').classList.remove('hidden');
        
        // Show processing container
        document.getElementById('processing-container').classList.remove('hidden');
    }

    showSelectedImagesInLeftPanel() {
        const selectedImagesDisplay = document.getElementById('selected-images-display');
        const selectedImagesGrid = document.getElementById('selected-images-grid');
        
        if (this.selectedFiles.length > 0) {
            selectedImagesGrid.innerHTML = '';
            
            this.selectedFiles.forEach(file => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const thumbnail = document.createElement('div');
                    thumbnail.className = 'aspect-square rounded-lg overflow-hidden bg-gray-200';
                    thumbnail.innerHTML = `
                        <img src="${e.target.result}" alt="${file.name}" 
                             class="w-full h-full object-cover">
                    `;
                    selectedImagesGrid.appendChild(thumbnail);
                };
                reader.readAsDataURL(file);
            });
            
            selectedImagesDisplay.classList.remove('hidden');
        }
    }

    async pollProcessingStatusWithAPI(processingId) {
        try {
            const finalStatus = await window.apiClient.pollProcessingStatus(
                processingId,
                (status) => {
                    // Update UI based on backend status
                    this.updateProgressFromBackendStatus(status);
                }
            );
            
            // Only complete all steps if no steps failed
            const hasFailedStep = finalStatus.steps && finalStatus.steps.some(step => step.status === 'failed');
            if (!hasFailedStep) {
                this.completeAllSteps();
            }
            
        } catch (error) {
            console.error('Error polling status:', error);
            // Fall back to simulation if polling fails
            await this.simulateBackendProgress();
        }
    }

    updateProgressFromBackendStatus(status) {
        if (!status.steps || status.steps.length === 0) return;

        // Map backend steps to frontend steps
        const stepMapping = {
            'validation': 'validation',
            'watermarking': 'processing',
            'collage': 'processing',
            'packaging': 'processing',
            'ai_metadata': 'ai-generation',
            'etsy_listing': 'etsy-creation'
        };

        // Check if any step has failed
        const hasFailedStep = status.steps.some(step => step.status === 'failed');
        
        if (hasFailedStep) {
            // Find the first failed step and stop processing
            const failedStep = status.steps.find(step => step.status === 'failed');
            const frontendStep = stepMapping[failedStep.step];
            
            if (frontendStep) {
                // Mark all previous steps as completed
                const stepIndex = this.processingSteps.findIndex(s => s.id === frontendStep);
                for (let i = 0; i < stepIndex; i++) {
                    this.updateProgressStep(this.processingSteps[i].id, 'completed');
                }
                
                // Mark the failed step as error
                this.updateProgressStep(frontendStep, 'error');
                
                // Show error message with step information and stop processing
                const errorMessage = failedStep.error || `Step ${failedStep.step} failed`;
                this.handleProcessingError(errorMessage, failedStep.step);
                return;
            }
        }

        // Get the latest step
        const latestStep = status.steps[status.steps.length - 1];
        const frontendStep = stepMapping[latestStep.step];

        if (frontendStep) {
            // Mark previous steps as completed
            const stepIndex = this.processingSteps.findIndex(s => s.id === frontendStep);
            for (let i = 0; i < stepIndex; i++) {
                this.updateProgressStep(this.processingSteps[i].id, 'completed');
            }

            // Update current step
            if (latestStep.status === 'started') {
                this.updateProgressStep(frontendStep, 'in-progress');
                
                // Show specific previews based on step
                if (latestStep.step === 'watermarking') {
                    this.showWatermarkPreview();
                } else if (latestStep.step === 'collage') {
                    this.showCollagePreview();
                }
            } else if (latestStep.status === 'completed') {
                this.updateProgressStep(frontendStep, 'completed');
            } else if (latestStep.status === 'failed') {
                this.updateProgressStep(frontendStep, 'error');
                const errorMessage = latestStep.error || `Step ${latestStep.step} failed`;
                this.handleProcessingError(errorMessage, latestStep.step);
            }
        }
    }

    showWatermarkPreview() {
        const watermarkPreview = document.getElementById('watermark-preview');
        const watermarkedImagesGrid = document.getElementById('watermarked-images-grid');
        
        if (watermarkPreview) {
            watermarkPreview.classList.remove('hidden');
            
            // Show watermarked images (simulated for now)
            if (watermarkedImagesGrid && this.selectedFiles.length > 0) {
                watermarkedImagesGrid.innerHTML = '';
                
                this.selectedFiles.forEach((file, index) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const thumbnail = document.createElement('div');
                        thumbnail.className = 'aspect-square rounded-lg overflow-hidden bg-gray-200 relative';
                        thumbnail.innerHTML = `
                            <img src="${e.target.result}" alt="Watermarked ${file.name}" 
                                 class="w-full h-full object-cover">
                            <div class="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center">
                                <div class="bg-white bg-opacity-90 px-2 py-1 rounded text-xs font-medium text-gray-800">
                                    Watermarked
                                </div>
                            </div>
                        `;
                        watermarkedImagesGrid.appendChild(thumbnail);
                    };
                    reader.readAsDataURL(file);
                });
            }
        }
    }

    showCollagePreview() {
        const collagePreview = document.getElementById('collage-preview');
        if (collagePreview) {
            collagePreview.classList.remove('hidden');
            
            // Show collage preview (simulated for now)
            const collageContainer = collagePreview.querySelector('.w-40.h-28');
            if (collageContainer && this.selectedFiles.length > 0) {
                collageContainer.innerHTML = '';
                
                // Create a simple grid collage preview
                const grid = document.createElement('div');
                grid.className = 'w-full h-full grid grid-cols-2 gap-1';
                
                // Show first 4 images in a 2x2 grid
                const imagesToShow = this.selectedFiles.slice(0, 4);
                imagesToShow.forEach(file => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const img = document.createElement('div');
                        img.className = 'bg-gray-200 rounded overflow-hidden';
                        img.innerHTML = `<img src="${e.target.result}" alt="${file.name}" class="w-full h-full object-cover">`;
                        grid.appendChild(img);
                    };
                    reader.readAsDataURL(file);
                });
                
                collageContainer.appendChild(grid);
            }
        }
    }

    resetProcessingContainerHeader() {
        const processingContainer = document.getElementById('processing-container');
        const header = processingContainer.querySelector('.text-center');
        if (header) {
            // Look for the icon div (it could have different classes after being updated)
            const icon = header.querySelector('div[class*="w-12"], div[class*="w-16"]') || header.querySelector('div:first-child');
            const title = header.querySelector('h3');
            const subtitle = header.querySelector('p');
            
            if (icon) {
                icon.className = 'w-12 h-12 bg-gradient-to-br from-primary/10 to-blue-100 rounded-full flex items-center justify-center mx-auto mb-3';
                icon.innerHTML = '<i class="fas fa-cog fa-spin text-lg text-primary"></i>';
            }
            
            if (title) {
                title.textContent = 'Processing Your Images';
                title.className = 'text-lg font-semibold text-gray-900 mb-1';
            }
            
            if (subtitle) {
                subtitle.textContent = 'Please wait while we process your images and create your listing...';
                subtitle.className = 'text-sm text-gray-600';
            }
        }
    }

    updateUploadProgress(percent) {
        // Update validation step progress
        const validationStep = document.querySelector('[data-step="validation"]');
        if (validationStep && percent < 100) {
            const progressText = validationStep.querySelector('.step-progress');
            if (progressText) {
                progressText.textContent = `${Math.round(percent)}%`;
            }
        }
        
        // Move to processing step when upload is complete
        if (percent >= 100) {
            this.updateProgressStep('validation', 'completed');
            this.updateProgressStep('processing', 'in-progress');
        }
    }

    resetProgressIndicators() {
        this.processingSteps.forEach((step, index) => {
            this.updateProgressStep(step.id, index === 0 ? 'pending' : 'waiting');
        });
    }

    updateProgressStep(stepId, status) {
        const stepElement = document.querySelector(`[data-step="${stepId}"]`);
        if (!stepElement) return;

        const icon = stepElement.querySelector('.step-icon');
        const text = stepElement.querySelector('.step-text');
        const progress = stepElement.querySelector('.step-progress');

        // Remove all status classes
        stepElement.classList.remove('step-waiting', 'step-pending', 'step-in-progress', 'step-completed', 'step-error');
        
        // Add new status class
        stepElement.classList.add(`step-${status}`);

        switch (status) {
            case 'waiting':
                icon.innerHTML = `<span class="text-sm text-gray-400">${this.processingSteps.findIndex(s => s.id === stepId) + 1}</span>`;
                icon.className = 'step-icon w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center mr-4';
                text.className = 'step-text text-gray-500';
                if (progress) progress.textContent = '';
                break;
            case 'pending':
                icon.innerHTML = `<span class="text-sm">${this.processingSteps.findIndex(s => s.id === stepId) + 1}</span>`;
                icon.className = 'step-icon w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center mr-4';
                text.className = 'step-text text-gray-700';
                if (progress) progress.textContent = '';
                break;
            case 'in-progress':
                icon.innerHTML = '<i class="fas fa-spinner fa-spin text-sm"></i>';
                icon.className = 'step-icon w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center mr-4';
                text.className = 'step-text text-gray-900 font-medium';
                if (progress) progress.textContent = 'Processing...';
                break;
            case 'completed':
                icon.innerHTML = '<i class="fas fa-check text-sm"></i>';
                icon.className = 'step-icon w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center mr-4';
                text.className = 'step-text text-gray-900';
                if (progress) progress.textContent = 'Complete';
                break;
            case 'error':
                icon.innerHTML = '<i class="fas fa-times text-sm"></i>';
                icon.className = 'step-icon w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center mr-4';
                text.className = 'step-text text-red-700';
                if (progress) progress.textContent = 'Failed';
                break;
        }
        
        // Update overall progress after each step change
        setTimeout(() => this.updateOverallProgress(), 100);
    }

    completeAllSteps() {
        // Check if any step has failed before completing all steps
        const hasFailedStep = document.querySelector('.step-error') !== null;
        if (hasFailedStep) {
            return; // Don't complete steps if any have failed
        }
        
        this.processingSteps.forEach((step, index) => {
            setTimeout(() => {
                this.updateProgressStep(step.id, 'completed');
                this.updateOverallProgress();
            }, index * 200); // Stagger the completion animations
        });
    }

    updateOverallProgress() {
        const completedSteps = document.querySelectorAll('.step-completed').length;
        const totalSteps = this.processingSteps.length;
        const progress = Math.round((completedSteps / totalSteps) * 100);
        
        const progressBar = document.getElementById('overall-progress-bar');
        const progressText = document.getElementById('overall-progress-text');
        
        if (progressBar) {
            progressBar.style.width = `${progress}%`;
        }
        if (progressText) {
            progressText.textContent = `${progress}%`;
        }
    }

    handleProcessingError(error, failedStepName = null) {
        // Mark current step as error
        const currentStep = this.getCurrentProcessingStep();
        if (currentStep) {
            this.updateProgressStep(currentStep, 'error');
        }

        // Create detailed error message with step information
        let errorMessage = error.message || error;
        if (failedStepName) {
            const stepDisplayName = this.getStepDisplayName(failedStepName);
            errorMessage = `Processing failed at step: ${stepDisplayName}\n\nError: ${errorMessage}`;
        }

        // Show error with retry option
        this.showProcessingError(errorMessage, true);
    }

    getStepDisplayName(stepName) {
        const stepNames = {
            'validation': 'Validating images',
            'watermarking': 'Processing watermarks',
            'collage': 'Creating collage',
            'packaging': 'Packaging files',
            'ai_metadata': 'Generating AI metadata',
            'etsy_listing': 'Creating Etsy listing',
            'drive_upload': 'Uploading to Google Drive'
        };
        return stepNames[stepName] || stepName;
    }

    getCurrentProcessingStep() {
        // Find the first step that's not completed
        for (const step of this.processingSteps) {
            const stepElement = document.querySelector(`[data-step="${step.id}"]`);
            if (stepElement && !stepElement.classList.contains('step-completed')) {
                return step.id;
            }
        }
        return null;
    }

    async simulateBackendProgress() {
        // Simulate the progression through backend processing steps
        const steps = ['processing', 'ai-generation', 'etsy-creation'];
        
        for (let i = 0; i < steps.length; i++) {
            // Wait a bit before starting each step
            await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
            
            // Start the step
            this.updateProgressStep(steps[i], 'in-progress');
            
            // Show previews for processing step
            if (steps[i] === 'processing') {
                // Simulate watermarking first
                await new Promise(resolve => setTimeout(resolve, 1000));
                this.showWatermarkPreview();
                
                // Then simulate collage creation
                await new Promise(resolve => setTimeout(resolve, 1000));
                this.showCollagePreview();
            }
            
            // Simulate processing time
            await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
            
            // Complete the step
            this.updateProgressStep(steps[i], 'completed');
        }
    }

    // This method is replaced by pollProcessingStatusWithAPI

    showResults(result) {
        // Check if processing was successful
        const hasFailedStep = document.querySelector('.step-error') !== null;
        
        if (hasFailedStep) {
            // Don't show success results if there are failed steps
            return;
        }
        
        // Keep processing container visible to show completed steps
        // Just add results container below it
        document.getElementById('results-container').classList.remove('hidden');
        
        // Update the processing container header to show completion
        const processingContainer = document.getElementById('processing-container');
        const header = processingContainer.querySelector('.text-center');
        if (header) {
            // Look for the icon div (it could have different classes after being updated)
            const icon = header.querySelector('div[class*="w-12"], div[class*="w-16"]') || header.querySelector('div:first-child');
            const title = header.querySelector('h3');
            const subtitle = header.querySelector('p');
            
            if (icon) {
                icon.className = 'w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3';
                icon.innerHTML = '<i class="fas fa-check text-lg text-green-600"></i>';
            }
            
            if (title) {
                title.textContent = 'Processing Complete!';
                title.className = 'text-lg font-semibold text-green-900 mb-1';
            }
            
            if (subtitle) {
                subtitle.textContent = 'Your listing has been created successfully.';
                subtitle.className = 'text-sm text-green-600';
            }
        }
        
        // Ensure processing container remains visible
        processingContainer.classList.remove('hidden');
        
        const resultsContent = document.getElementById('results-content');
        
        if (result.success) {
            // Show success animation
            this.showSuccessAnimation();
            
            // resultsContent.innerHTML = `
            //     <div class="space-y-6">
            //         <!-- Processing Summary -->
            //         <div class="bg-green-50 border border-green-200 rounded-2xl p-6">
            //             <div class="flex items-center mb-4">
            //                 <div class="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-4">
            //                     <i class="fas fa-check text-green-600"></i>
            //                 </div>
            //                 <div>
            //                     <h4 class="font-semibold text-green-900">Processing Complete!</h4>
            //                     <p class="text-green-700 text-sm">All ${this.selectedFiles.length} images processed successfully</p>
            //                 </div>
            //             </div>
            //             ${result.processingId ? `
            //                 <p class="text-green-600 text-xs font-mono">Processing ID: ${result.processingId}</p>
            //             ` : ''}
            //         </div>

            //         <!-- Assets Grid -->
            //         <div class="grid md:grid-cols-2 gap-6">
            //             <div class="bg-gray-50 rounded-2xl p-6">
            //                 <h4 class="font-semibold text-gray-900 mb-4">
            //                     <i class="fas fa-images text-primary mr-2"></i>
            //                     Processed Images
            //                 </h4>
            //                 <div class="space-y-2">
            //                     <p class="text-gray-600">
            //                         <i class="fas fa-check text-green-500 mr-2"></i>
            //                         ${result.assets?.watermarkedImages?.length || 0} watermarked images
            //                     </p>
            //                     ${result.assets?.collage ? `
            //                         <p class="text-gray-600">
            //                             <i class="fas fa-check text-green-500 mr-2"></i>
            //                             Product collage generated
            //                         </p>
            //                     ` : ''}
            //                     <p class="text-gray-600">
            //                         <i class="fas fa-check text-green-500 mr-2"></i>
            //                         Optimized for Etsy (2000x2000px)
            //                     </p>
            //                 </div>
            //             </div>
                        
            //             <div class="bg-gray-50 rounded-2xl p-6">
            //                 <h4 class="font-semibold text-gray-900 mb-4">
            //                     <i class="fas fa-cloud text-primary mr-2"></i>
            //                     File Storage
            //                 </h4>
            //                 ${result.assets?.originalZip ? `
            //                     <div class="space-y-3">
            //                         <p class="text-gray-600">
            //                             <i class="fas fa-check text-green-500 mr-2"></i>
            //                             Original images backed up
            //                         </p>
            //                         <a href="${result.assets.originalZip}" target="_blank" 
            //                            class="inline-flex items-center text-primary hover:text-primary-dark font-medium transition-colors">
            //                             <i class="fas fa-download mr-2"></i>
            //                             Download ZIP Archive
            //                         </a>
            //                     </div>
            //                 ` : `
            //                     <p class="text-gray-500">
            //                         <i class="fas fa-clock mr-2"></i>
            //                         Backup in progress...
            //                     </p>
            //                 `}
            //             </div>
            //         </div>
                    
            //         ${result.metadata ? `
            //             <div class="bg-gray-50 rounded-2xl p-6">
            //                 <h4 class="font-semibold text-gray-900 mb-4">
            //                     <i class="fas fa-robot text-primary mr-2"></i>
            //                     AI-Generated Content
            //                 </h4>
            //                 <div class="space-y-4">
            //                     <div>
            //                         <div class="flex items-center justify-between mb-2">
            //                             <h5 class="font-medium text-gray-900">Title</h5>
            //                             <span class="text-xs text-gray-500">${result.metadata.title?.length || 0}/140 chars</span>
            //                         </div>
            //                         <div class="bg-white p-3 rounded-xl border">
            //                             <p class="text-gray-700">${result.metadata.title}</p>
            //                             <button onclick="uploadManager.copyToClipboard('${result.metadata.title.replace(/'/g, "\\'")}', 'title')" 
            //                                     class="text-xs text-primary hover:text-primary-dark mt-2">
            //                                 <i class="fas fa-copy mr-1"></i>Copy
            //                             </button>
            //                         </div>
            //                     </div>
            //                     <div>
            //                         <div class="flex items-center justify-between mb-2">
            //                             <h5 class="font-medium text-gray-900">Tags</h5>
            //                             <span class="text-xs text-gray-500">${result.metadata.tags?.length || 0} tags</span>
            //                         </div>
            //                         <div class="bg-white p-3 rounded-xl border">
            //                             <div class="flex flex-wrap gap-2 mb-2">
            //                                 ${result.metadata.tags?.map(tag =>
            //     `<span class="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm">${tag}</span>`
            // ).join('') || ''}
            //                             </div>
            //                             <button onclick="uploadManager.copyToClipboard('${result.metadata.tags?.join(', ') || ''}', 'tags')" 
            //                                     class="text-xs text-primary hover:text-primary-dark">
            //                                 <i class="fas fa-copy mr-1"></i>Copy All Tags
            //                             </button>
            //                         </div>
            //                     </div>
            //                     <div>
            //                         <div class="flex items-center justify-between mb-2">
            //                             <h5 class="font-medium text-gray-900">Description</h5>
            //                             <span class="text-xs text-gray-500">${result.metadata.description?.length || 0} chars</span>
            //                         </div>
            //                         <div class="bg-white p-3 rounded-xl border">
            //                             <p class="text-gray-700 text-sm whitespace-pre-wrap">${result.metadata.description}</p>
            //                             <button onclick="uploadManager.copyToClipboard('${result.metadata.description?.replace(/'/g, "\\'").replace(/\n/g, '\\n') || ''}', 'description')" 
            //                                     class="text-xs text-primary hover:text-primary-dark mt-2">
            //                                 <i class="fas fa-copy mr-1"></i>Copy Description
            //                             </button>
            //                         </div>
            //                     </div>
            //                 </div>
            //             </div>
            //         ` : ''}
                    
            //         ${result.etsyListing ? `
            //             <div class="bg-green-50 border border-green-200 rounded-2xl p-6">
            //                 <h4 class="font-semibold text-green-900 mb-4">
            //                     <i class="fab fa-etsy text-green-600 mr-2"></i>
            //                     Etsy Draft Listing Created
            //                 </h4>
            //                 <div class="space-y-3">
            //                     <p class="text-green-700">Your draft listing has been created and is ready for review.</p>
            //                     <div class="flex gap-3">
            //                         <a href="${result.etsyListing.editUrl}" target="_blank" 
            //                            class="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-2xl font-medium transition-colors inline-flex items-center">
            //                             <i class="fas fa-external-link-alt mr-2"></i>
            //                             Edit on Etsy
            //                         </a>
            //                         <button onclick="uploadManager.copyToClipboard('${result.etsyListing.editUrl}', 'listing-url')" 
            //                                 class="bg-green-100 hover:bg-green-200 text-green-800 px-4 py-3 rounded-2xl font-medium transition-colors">
            //                             <i class="fas fa-copy mr-2"></i>
            //                             Copy Link
            //                         </button>
            //                     </div>
            //                 </div>
            //             </div>
            //         ` : ''}

            //         <!-- Action Buttons -->
            //         <div class="flex justify-center gap-4 pt-4">
            //             <button onclick="uploadManager.resetUpload()" 
            //                     class="bg-gray-100 hover:bg-gray-200 text-gray-900 px-6 py-3 rounded-2xl font-medium transition-colors">
            //                 <i class="fas fa-plus mr-2"></i>
            //                 Process More Images
            //             </button>
            //             <button onclick="showPage('home')" 
            //                     class="bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-2xl font-medium transition-colors">
            //                 <i class="fas fa-home mr-2"></i>
            //                 Back to Home
            //             </button>
            //         </div>
            //     </div>
            // `;
        } else {
            this.showProcessingError(
                result.message || 'There was an error processing your images. Please try again.',
                false
            );
            
            // Show partial results if available
            if (result.errors && result.errors.length > 0) {
                const partialResults = this.createPartialResultsDisplay(result);
                if (partialResults) {
                    resultsContent.innerHTML += partialResults;
                }
            }
        }
    }

    showSuccessAnimation() {
        // Add a subtle success animation to the results container
        const resultsContainer = document.getElementById('results-container');
        resultsContainer.style.opacity = '0';
        resultsContainer.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            resultsContainer.style.transition = 'all 0.5s ease-out';
            resultsContainer.style.opacity = '1';
            resultsContainer.style.transform = 'translateY(0)';
        }, 100);
    }

    createPartialResultsDisplay(result) {
        if (!result.errors || result.errors.length === 0) return null;
        
        const recoverableErrors = result.errors.filter(error => error.recoverable);
        const criticalErrors = result.errors.filter(error => !error.recoverable);
        
        return `
            <div class="mt-6 space-y-4">
                ${recoverableErrors.length > 0 ? `
                    <div class="bg-yellow-50 border border-yellow-200 rounded-2xl p-6">
                        <h4 class="font-semibold text-yellow-900 mb-4">
                            <i class="fas fa-exclamation-triangle text-yellow-600 mr-2"></i>
                            Partial Processing Issues
                        </h4>
                        <div class="text-sm text-yellow-700 space-y-1">
                            ${recoverableErrors.map(error => `<p>• ${error.message}</p>`).join('')}
                        </div>
                        <p class="text-yellow-600 text-sm mt-3">
                            Some features may not be available, but your main processing was successful.
                        </p>
                    </div>
                ` : ''}
                
                ${criticalErrors.length > 0 ? `
                    <div class="bg-red-50 border border-red-200 rounded-2xl p-6">
                        <h4 class="font-semibold text-red-900 mb-4">
                            <i class="fas fa-times-circle text-red-600 mr-2"></i>
                            Critical Errors
                        </h4>
                        <div class="text-sm text-red-700 space-y-1">
                            ${criticalErrors.map(error => `<p>• ${error.message}</p>`).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    async copyToClipboard(text, type) {
        try {
            await navigator.clipboard.writeText(text);
            this.showCopyFeedback(type);
        } catch (err) {
            console.error('Failed to copy to clipboard:', err);
            // Fallback for older browsers
            this.fallbackCopyToClipboard(text, type);
        }
    }

    fallbackCopyToClipboard(text, type) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            this.showCopyFeedback(type);
        } catch (err) {
            console.error('Fallback copy failed:', err);
        }
        
        document.body.removeChild(textArea);
    }

    showCopyFeedback(type) {
        // Create temporary feedback element
        const feedback = document.createElement('div');
        feedback.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-2xl shadow-lg z-50 transition-all duration-300';
        feedback.innerHTML = `
            <i class="fas fa-check mr-2"></i>
            ${type.charAt(0).toUpperCase() + type.slice(1)} copied to clipboard!
        `;
        
        document.body.appendChild(feedback);
        
        // Animate in
        setTimeout(() => {
            feedback.style.transform = 'translateX(0)';
        }, 10);
        
        // Remove after 3 seconds
        setTimeout(() => {
            feedback.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (feedback.parentNode) {
                    feedback.parentNode.removeChild(feedback);
                }
            }, 300);
        }, 3000);
    }

    showProcessingError(errorMessage, showRetry = false) {
        document.getElementById('processing-container').classList.add('hidden');
        document.getElementById('results-container').classList.remove('hidden');
        
        const resultsContent = document.getElementById('results-content');
        const canRetry = showRetry && this.retryCount < this.maxRetries;
        
        // Parse the error message to extract step information
        const stepMatch = errorMessage.match(/Processing failed at step: (.+?)\n\nError: (.+)/);
        const stepName = stepMatch ? stepMatch[1] : null;
        const actualError = stepMatch ? stepMatch[2] : errorMessage;
        
        resultsContent.innerHTML = `
            <div class="bg-red-50 border border-red-200 rounded-2xl p-6">
                <h4 class="font-semibold text-red-900 mb-4">
                    <i class="fas fa-exclamation-triangle text-red-600 mr-2"></i>
                    Processing Failed
                </h4>
                ${stepName ? `
                    <div class="bg-red-100 border border-red-300 rounded-xl p-4 mb-4">
                        <div class="flex items-center mb-2">
                            <i class="fas fa-times-circle text-red-600 mr-2"></i>
                            <span class="font-medium text-red-900">Failed Step:</span>
                        </div>
                        <p class="text-red-800 font-semibold">${stepName}</p>
                    </div>
                ` : ''}
                <div class="bg-white border border-red-200 rounded-xl p-4 mb-4">
                    <div class="flex items-center mb-2">
                        <i class="fas fa-bug text-red-600 mr-2"></i>
                        <span class="font-medium text-red-900">Error Details:</span>
                    </div>
                    <p class="text-red-700 text-sm whitespace-pre-wrap">${actualError}</p>
                </div>
                <div class="text-red-600 text-sm mb-4">
                    ${canRetry ? 
                        `<p>Attempt ${this.retryCount + 1} of ${this.maxRetries + 1} failed.</p>` :
                        '<p>Please check your internet connection and try again. If the problem persists, contact support.</p>'
                    }
                </div>
                ${canRetry ? `
                    <div class="flex gap-3">
                        <button onclick="uploadManager.retryProcessing()" 
                                class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-2xl font-medium transition-colors">
                            <i class="fas fa-redo mr-2"></i>
                            Retry Processing
                        </button>
                        <button onclick="uploadManager.resetUpload()" 
                                class="bg-gray-100 hover:bg-gray-200 text-gray-900 px-4 py-2 rounded-2xl font-medium transition-colors">
                            Start Over
                        </button>
                    </div>
                ` : `
                    <button onclick="uploadManager.resetUpload()" 
                            class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-2xl font-medium transition-colors">
                        <i class="fas fa-redo mr-2"></i>
                        Try Again
                    </button>
                `}
            </div>
        `;
    }

    async retryProcessing() {
        this.retryCount++;
        console.log(`Retrying processing (attempt ${this.retryCount + 1}/${this.maxRetries + 1})`);
        
        // Hide results and show processing again
        document.getElementById('results-container').classList.add('hidden');
        
        // Wait a moment before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Start processing again
        await this.startProcessing();
    }

    resetUpload() {
        // Reset all state
        this.selectedFiles = [];
        document.getElementById('file-input').value = '';
        if (document.getElementById('file-input-small')) {
            document.getElementById('file-input-small').value = '';
        }
        
        // Switch back to initial layout
        document.getElementById('initial-upload-container').classList.remove('hidden');
        document.getElementById('processing-layout').classList.add('hidden');
        
        // Hide all sections in initial layout
        document.getElementById('preview-container').classList.add('hidden');
        document.getElementById('error-container').classList.add('hidden');
        
        // Hide sections in processing layout
        document.getElementById('selected-images-display').classList.add('hidden');
        document.getElementById('processing-container').classList.add('hidden');
        document.getElementById('results-container').classList.add('hidden');
        document.getElementById('upload-button-container-small').classList.add('hidden');
        
        // Reset processing container header
        this.resetProcessingContainerHeader();
        
        // Hide preview sections
        const watermarkPreview = document.getElementById('watermark-preview');
        const collagePreview = document.getElementById('collage-preview');
        if (watermarkPreview) watermarkPreview.classList.add('hidden');
        if (collagePreview) collagePreview.classList.add('hidden');
        
        // Reset processing steps
        this.resetProgressIndicators();
        
        // Reset overall progress
        const progressBar = document.getElementById('overall-progress-bar');
        const progressText = document.getElementById('overall-progress-text');
        if (progressBar) progressBar.style.width = '0%';
        if (progressText) progressText.textContent = '0%';
    }
}

// Global function for removing files (called from HTML)
function resetUpload() {
    if (window.uploadManager) {
        window.uploadManager.resetUpload();
    }
}

// Initialize upload manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if we're on the upload page or if upload elements exist
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    
    if (dropZone && fileInput) {
        window.uploadManager = new UploadManager();
    }
});

console.log('Upload module loaded');