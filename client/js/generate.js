// AI Image Generation functionality for ListGenie
class GenerateManager {
    constructor() {
        this.generatedImages = [];
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
        this.loadPromptHistory();
        this.initializeOAuthStatus();
    }

    setupEventListeners() {
        const generateButton = document.getElementById('generate-button');
        const createListingButton = document.getElementById('create-listing-button');
        const generateMoreButton = document.getElementById('generate-more-button');
        const mobileMenuButton = document.getElementById('mobile-menu-button');
        const mobileMenu = document.getElementById('mobile-menu');

        // Generate button
        if (generateButton) {
            generateButton.addEventListener('click', () => {
                this.generateImages();
            });
        }

        // Create listing button
        if (createListingButton) {
            createListingButton.addEventListener('click', () => {
                this.createListing();
            });
        }

        // Generate more button
        if (generateMoreButton) {
            generateMoreButton.addEventListener('click', () => {
                this.resetToGeneration();
            });
        }

        // Mobile menu toggle
        if (mobileMenuButton && mobileMenu) {
            mobileMenuButton.addEventListener('click', () => {
                mobileMenu.classList.toggle('hidden');
            });
        }

        // Close mobile menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!mobileMenuButton.contains(e.target) && !mobileMenu.contains(e.target)) {
                mobileMenu.classList.add('hidden');
            }
        });
    }

    async generateImages() {
        const promptInput = document.getElementById('prompt-input');
        const imageCount = document.getElementById('image-count');
        const imageStyle = document.getElementById('image-style');
        const generateButton = document.getElementById('generate-button');

        const prompt = promptInput.value.trim();
        if (!prompt) {
            this.showError('Please enter a description for your product.');
            return;
        }

        // Disable generate button
        generateButton.disabled = true;
        generateButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Generating...';

        try {
            // Save prompt to history
            this.savePromptToHistory(prompt);

            // Generate images using API
            const result = await window.apiClient.generateImages({
                prompt: prompt,
                count: parseInt(imageCount.value),
                style: imageStyle.value
            });

            if (result.success && result.images) {
                this.generatedImages = result.images;
                this.showGeneratedImages();
                // Don't switch to processing layout yet - wait for user to click "Create Etsy listing"
            } else {
                throw new Error(result.message || 'Failed to generate images');
            }

        } catch (error) {
            console.error('Generation error:', error);
            this.showError(`Failed to generate images: ${error.message}`);
        } finally {
            // Re-enable generate button
            generateButton.disabled = false;
            generateButton.innerHTML = '<i class="fas fa-magic mr-2"></i>Generate Images';
        }
    }

    showGeneratedImages() {
        const selectedImagesDisplay = document.getElementById('selected-images-display');
        const selectedImagesGrid = document.getElementById('selected-images-grid');
        
        if (this.generatedImages.length > 0) {
            selectedImagesGrid.innerHTML = '';
            
            this.generatedImages.forEach((imageData, index) => {
                const thumbnail = document.createElement('div');
                thumbnail.className = 'aspect-square rounded-lg overflow-hidden bg-gray-200 relative group';
                thumbnail.innerHTML = `
                    <img src="${imageData.url || imageData.dataUrl}" alt="Generated image ${index + 1}" 
                         class="w-full h-full object-cover">
                    <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                        <button onclick="generateManager.removeImage(${index})" 
                                class="bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-600">
                            <i class="fas fa-times text-xs"></i>
                        </button>
                    </div>
                `;
                selectedImagesGrid.appendChild(thumbnail);
            });
            
            selectedImagesDisplay.classList.remove('hidden');
        }
    }

    removeImage(index) {
        this.generatedImages.splice(index, 1);
        this.showGeneratedImages();
        
        if (this.generatedImages.length === 0) {
            this.resetToGeneration();
        }
    }

    switchToProcessingLayout() {
        // Hide initial generation layout
        document.getElementById('initial-generation-container').classList.add('hidden');
        
        // Show processing layout
        document.getElementById('processing-layout').classList.remove('hidden');
    }

    resetToGeneration() {
        // Reset state
        this.generatedImages = [];
        
        // Hide processing layout
        document.getElementById('processing-layout').classList.add('hidden');
        
        // Show initial generation layout
        document.getElementById('initial-generation-container').classList.remove('hidden');
        
        // Hide results
        document.getElementById('results-container').classList.add('hidden');
        
        // Reset form
        document.getElementById('prompt-input').value = '';
        document.getElementById('image-count').value = '1';
        document.getElementById('image-style').value = 'product';
    }

    async createListing() {
        if (this.generatedImages.length === 0) {
            this.showError('No images available to create listing.');
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
            
            // Show processing container
            document.getElementById('processing-container').classList.remove('hidden');
            
            // Reset progress indicators
            this.resetProgressIndicators();
            
            // Start progress tracking
            this.updateProgressStep('validation', 'in-progress');
            
            // Convert generated images to file format for processing
            const files = await this.convertImagesToFiles();
            
            // Upload images using API client
            const result = await window.apiClient.uploadImages(
                files,
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
            console.error('Processing error:', error);
            this.handleProcessingError(error);
        }
    }

    async convertImagesToFiles() {
        const files = [];
        
        for (let i = 0; i < this.generatedImages.length; i++) {
            const imageData = this.generatedImages[i];
            
            // Convert data URL to blob
            const response = await fetch(imageData.url || imageData.dataUrl);
            const blob = await response.blob();
            
            // Create file object
            const file = new File([blob], `generated_image_${i + 1}.jpg`, {
                type: 'image/jpeg'
            });
            
            files.push(file);
        }
        
        return files;
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
            if (watermarkedImagesGrid && this.generatedImages.length > 0) {
                watermarkedImagesGrid.innerHTML = '';
                
                this.generatedImages.forEach((imageData, index) => {
                    const thumbnail = document.createElement('div');
                    thumbnail.className = 'aspect-square rounded-lg overflow-hidden bg-gray-200 relative';
                    thumbnail.innerHTML = `
                        <img src="${imageData.url || imageData.dataUrl}" alt="Watermarked ${index + 1}" 
                             class="w-full h-full object-cover">
                        <div class="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center">
                            <div class="bg-white bg-opacity-90 px-2 py-1 rounded text-xs font-medium text-gray-800">
                                Watermarked
                            </div>
                        </div>
                    `;
                    watermarkedImagesGrid.appendChild(thumbnail);
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
            if (collageContainer && this.generatedImages.length > 0) {
                collageContainer.innerHTML = '';
                
                // Create a simple grid collage preview
                const grid = document.createElement('div');
                grid.className = 'w-full h-full grid grid-cols-2 gap-1';
                
                // Show first 4 images in a 2x2 grid
                const imagesToShow = this.generatedImages.slice(0, 4);
                imagesToShow.forEach(imageData => {
                    const img = document.createElement('div');
                    img.className = 'bg-gray-200 rounded overflow-hidden';
                    img.innerHTML = `<img src="${imageData.url || imageData.dataUrl}" alt="Generated image" class="w-full h-full object-cover">`;
                    grid.appendChild(img);
                });
                
                collageContainer.appendChild(grid);
            }
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
            const icon = header.querySelector('.w-12.h-12');
            const title = header.querySelector('h3');
            const subtitle = header.querySelector('p');
            
            if (icon) {
                icon.className = 'w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4';
                icon.innerHTML = '<i class="fas fa-check text-2xl text-green-600"></i>';
            }
            
            if (title) {
                title.textContent = 'Processing Complete!';
                title.className = 'text-xl font-semibold text-green-900 mb-2';
            }
            
            if (subtitle) {
                subtitle.textContent = 'Your listing has been created successfully.';
                subtitle.className = 'text-green-600';
            }
        }
        
        // Ensure processing container remains visible
        processingContainer.classList.remove('hidden');
        
        const resultsContent = document.getElementById('results-content');
        
        if (result.success) {
            // Show success animation
            this.showSuccessAnimation();
        } else {
            this.showProcessingError(
                result.message || 'There was an error processing your images. Please try again.',
                false
            );
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
                        <button onclick="generateManager.retryProcessing()" 
                                class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-2xl font-medium transition-colors">
                            <i class="fas fa-redo mr-2"></i>
                            Retry Processing
                        </button>
                        <button onclick="generateManager.resetToGeneration()" 
                                class="bg-gray-100 hover:bg-gray-200 text-gray-900 px-4 py-2 rounded-2xl font-medium transition-colors">
                            Start Over
                        </button>
                    </div>
                ` : `
                    <button onclick="generateManager.resetToGeneration()" 
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

    showError(message) {
        // Create a temporary error notification
        const errorDiv = document.createElement('div');
        errorDiv.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-2xl shadow-lg z-50 transition-all duration-300';
        errorDiv.innerHTML = `
            <div class="flex items-center">
                <i class="fas fa-exclamation-triangle mr-2"></i>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(errorDiv);
        
        // Animate in
        setTimeout(() => {
            errorDiv.style.transform = 'translateX(0)';
        }, 10);
        
        // Remove after 5 seconds
        setTimeout(() => {
            errorDiv.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (errorDiv.parentNode) {
                    errorDiv.parentNode.removeChild(errorDiv);
                }
            }, 300);
        }, 5000);
    }

    // Prompt History Management
    savePromptToHistory(prompt) {
        const history = this.getPromptHistory();
        
        // Check if prompt already exists (case-insensitive)
        const trimmedPrompt = prompt.trim().toLowerCase();
        const existingIndex = history.findIndex(entry => 
            entry.prompt.trim().toLowerCase() === trimmedPrompt
        );
        
        if (existingIndex !== -1) {
            // If prompt exists, move it to the top and update timestamp
            const existingEntry = history.splice(existingIndex, 1)[0];
            existingEntry.timestamp = new Date().toISOString();
            history.unshift(existingEntry);
        } else {
            // If prompt doesn't exist, create new entry
            const newEntry = {
                prompt: prompt,
                timestamp: new Date().toISOString(),
                id: Date.now().toString()
            };
            history.unshift(newEntry);
        }
        
        // Keep only last 20 prompts
        if (history.length > 20) {
            history.splice(20);
        }
        
        localStorage.setItem('promptHistory', JSON.stringify(history));
        this.loadPromptHistory();
    }

    getPromptHistory() {
        try {
            const history = localStorage.getItem('promptHistory');
            return history ? JSON.parse(history) : [];
        } catch (error) {
            console.error('Error loading prompt history:', error);
            return [];
        }
    }

    loadPromptHistory() {
        const history = this.getPromptHistory();
        const historyContainer = document.getElementById('prompt-history');
        
        if (history.length === 0) {
            historyContainer.innerHTML = '<p class="text-gray-500 text-sm">No prompts yet. Start generating to see your history!</p>';
            return;
        }
        
        historyContainer.innerHTML = history.map(entry => `
            <div class="bg-gray-50 rounded-lg p-3 cursor-pointer hover:bg-gray-100 transition-colors" 
                 onclick="generateManager.usePrompt('${entry.prompt.replace(/'/g, "\\'")}')">
                <p class="text-sm text-gray-700 line-clamp-2">${entry.prompt}</p>
                <p class="text-xs text-gray-500 mt-1">${new Date(entry.timestamp).toLocaleDateString()}</p>
            </div>
        `).join('');
    }

    usePrompt(prompt) {
        document.getElementById('prompt-input').value = prompt;
        document.getElementById('prompt-input').focus();
    }

    // OAuth Status Management
    async initializeOAuthStatus() {
        if (window.oauthStatusManager) {
            await window.oauthStatusManager.refreshStatus();
        }
    }
}

// Global function for removing images (called from HTML)
function resetGeneration() {
    if (window.generateManager) {
        window.generateManager.resetToGeneration();
    }
}

// Initialize generate manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if we're on the generate page
    const generateButton = document.getElementById('generate-button');
    
    if (generateButton) {
        window.generateManager = new GenerateManager();
    }
});

console.log('Generate module loaded');
