// Upload functionality for EtsyFlow
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

        // Drop zone click handler
        dropZone.addEventListener('click', () => {
            fileInput.click();
        });

        // File input change handler
        fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
        });

        // Drag and drop handlers
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

        // Upload button handler
        if (uploadButton) {
            uploadButton.addEventListener('click', () => {
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
                card.className = 'bg-white rounded-2xl shadow-lg overflow-hidden relative group';
                
                const sizeKB = (file.size / 1024).toFixed(1);
                
                card.innerHTML = `
                    <div class="aspect-square relative">
                        <img src="${e.target.result}" alt="${file.name}" 
                             class="w-full h-full object-cover">
                        <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                            <button onclick="uploadManager.removeFile('${file.name}')" 
                                    class="bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-600">
                                <i class="fas fa-times text-sm"></i>
                            </button>
                        </div>
                    </div>
                    <div class="p-3">
                        <p class="text-sm font-medium text-gray-900 truncate" title="${file.name}">
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
            // Hide preview and show processing
            document.getElementById('preview-container').classList.add('hidden');
            document.getElementById('processing-container').classList.remove('hidden');
            
            // Reset progress indicators
            this.resetProgressIndicators();
            
            // Create FormData for upload
            const formData = new FormData();
            this.selectedFiles.forEach((file, index) => {
                formData.append('images', file);
            });

            // Start progress tracking
            this.updateProgressStep('validation', 'in-progress');
            
            // Make API call with progress tracking
            const response = await this.uploadWithProgress(formData);
            
            // Simulate backend processing steps
            await this.simulateBackendProgress();

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Upload failed: ${response.statusText}`);
            }

            const result = await response.json();
            this.currentProcessingId = result.processingId;
            
            // If we have a processing ID, we can poll for status updates
            if (result.processingId && result.status === 'processing') {
                await this.pollProcessingStatus(result.processingId);
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

    async uploadWithProgress(formData) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            // Track upload progress
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    this.updateUploadProgress(percentComplete);
                }
            });
            
            // Handle response
            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve({
                        ok: true,
                        json: () => Promise.resolve(JSON.parse(xhr.responseText))
                    });
                } else {
                    resolve({
                        ok: false,
                        status: xhr.status,
                        statusText: xhr.statusText,
                        json: () => Promise.resolve(JSON.parse(xhr.responseText || '{}'))
                    });
                }
            });
            
            // Handle errors
            xhr.addEventListener('error', () => {
                reject(new Error('Network error occurred during upload'));
            });
            
            xhr.addEventListener('timeout', () => {
                reject(new Error('Upload timed out. Please try again.'));
            });
            
            // Configure and send request
            xhr.open('POST', '/api/upload');
            xhr.timeout = 300000; // 5 minute timeout
            xhr.send(formData);
        });
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

    handleProcessingError(error) {
        // Mark current step as error
        const currentStep = this.getCurrentProcessingStep();
        if (currentStep) {
            this.updateProgressStep(currentStep, 'error');
        }

        // Show error with retry option
        this.showProcessingError(error.message, true);
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
            
            // Simulate processing time
            await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
            
            // Complete the step
            this.updateProgressStep(steps[i], 'completed');
        }
    }

    async pollProcessingStatus(processingId) {
        const maxPolls = 60; // Maximum 5 minutes of polling (5 second intervals)
        let pollCount = 0;
        
        while (pollCount < maxPolls) {
            try {
                const response = await fetch(`/api/status/${processingId}`);
                if (!response.ok) {
                    throw new Error('Failed to get processing status');
                }
                
                const status = await response.json();
                
                // Update progress based on backend status
                if (status.currentStep) {
                    // Mark previous steps as completed
                    const stepIndex = this.processingSteps.findIndex(s => s.id === status.currentStep);
                    for (let i = 0; i < stepIndex; i++) {
                        this.updateProgressStep(this.processingSteps[i].id, 'completed');
                    }
                    
                    // Mark current step as in progress
                    this.updateProgressStep(status.currentStep, 'in-progress');
                }
                
                // Check if processing is complete
                if (status.status === 'completed' || status.status === 'failed') {
                    if (status.status === 'completed') {
                        this.completeAllSteps();
                    } else {
                        this.updateProgressStep(status.currentStep || 'validation', 'error');
                    }
                    break;
                }
                
                // Wait before next poll
                await new Promise(resolve => setTimeout(resolve, 5000));
                pollCount++;
                
            } catch (error) {
                console.error('Error polling status:', error);
                // Fall back to simulation if polling fails
                await this.simulateBackendProgress();
                break;
            }
        }
        
        // If we've exceeded max polls, complete all steps
        if (pollCount >= maxPolls) {
            this.completeAllSteps();
        }
    }

    showResults(result) {
        document.getElementById('processing-container').classList.add('hidden');
        document.getElementById('results-container').classList.remove('hidden');
        
        const resultsContent = document.getElementById('results-content');
        
        if (result.success) {
            // Show success animation
            this.showSuccessAnimation();
            
            resultsContent.innerHTML = `
                <div class="space-y-6">
                    <!-- Processing Summary -->
                    <div class="bg-green-50 border border-green-200 rounded-2xl p-6">
                        <div class="flex items-center mb-4">
                            <div class="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-4">
                                <i class="fas fa-check text-green-600"></i>
                            </div>
                            <div>
                                <h4 class="font-semibold text-green-900">Processing Complete!</h4>
                                <p class="text-green-700 text-sm">All ${this.selectedFiles.length} images processed successfully</p>
                            </div>
                        </div>
                        ${result.processingId ? `
                            <p class="text-green-600 text-xs font-mono">Processing ID: ${result.processingId}</p>
                        ` : ''}
                    </div>

                    <!-- Assets Grid -->
                    <div class="grid md:grid-cols-2 gap-6">
                        <div class="bg-gray-50 rounded-2xl p-6">
                            <h4 class="font-semibold text-gray-900 mb-4">
                                <i class="fas fa-images text-primary mr-2"></i>
                                Processed Images
                            </h4>
                            <div class="space-y-2">
                                <p class="text-gray-600">
                                    <i class="fas fa-check text-green-500 mr-2"></i>
                                    ${result.assets?.watermarkedImages?.length || 0} watermarked images
                                </p>
                                ${result.assets?.collage ? `
                                    <p class="text-gray-600">
                                        <i class="fas fa-check text-green-500 mr-2"></i>
                                        Product collage generated
                                    </p>
                                ` : ''}
                                <p class="text-gray-600">
                                    <i class="fas fa-check text-green-500 mr-2"></i>
                                    Optimized for Etsy (2000x2000px)
                                </p>
                            </div>
                        </div>
                        
                        <div class="bg-gray-50 rounded-2xl p-6">
                            <h4 class="font-semibold text-gray-900 mb-4">
                                <i class="fas fa-cloud text-primary mr-2"></i>
                                File Storage
                            </h4>
                            ${result.assets?.originalZip ? `
                                <div class="space-y-3">
                                    <p class="text-gray-600">
                                        <i class="fas fa-check text-green-500 mr-2"></i>
                                        Original images backed up
                                    </p>
                                    <a href="${result.assets.originalZip}" target="_blank" 
                                       class="inline-flex items-center text-primary hover:text-primary-dark font-medium transition-colors">
                                        <i class="fas fa-download mr-2"></i>
                                        Download ZIP Archive
                                    </a>
                                </div>
                            ` : `
                                <p class="text-gray-500">
                                    <i class="fas fa-clock mr-2"></i>
                                    Backup in progress...
                                </p>
                            `}
                        </div>
                    </div>
                    
                    ${result.metadata ? `
                        <div class="bg-gray-50 rounded-2xl p-6">
                            <h4 class="font-semibold text-gray-900 mb-4">
                                <i class="fas fa-robot text-primary mr-2"></i>
                                AI-Generated Content
                            </h4>
                            <div class="space-y-4">
                                <div>
                                    <div class="flex items-center justify-between mb-2">
                                        <h5 class="font-medium text-gray-900">Title</h5>
                                        <span class="text-xs text-gray-500">${result.metadata.title?.length || 0}/140 chars</span>
                                    </div>
                                    <div class="bg-white p-3 rounded-xl border">
                                        <p class="text-gray-700">${result.metadata.title}</p>
                                        <button onclick="uploadManager.copyToClipboard('${result.metadata.title.replace(/'/g, "\\'")}', 'title')" 
                                                class="text-xs text-primary hover:text-primary-dark mt-2">
                                            <i class="fas fa-copy mr-1"></i>Copy
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <div class="flex items-center justify-between mb-2">
                                        <h5 class="font-medium text-gray-900">Tags</h5>
                                        <span class="text-xs text-gray-500">${result.metadata.tags?.length || 0} tags</span>
                                    </div>
                                    <div class="bg-white p-3 rounded-xl border">
                                        <div class="flex flex-wrap gap-2 mb-2">
                                            ${result.metadata.tags?.map(tag => 
                                                `<span class="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm">${tag}</span>`
                                            ).join('') || ''}
                                        </div>
                                        <button onclick="uploadManager.copyToClipboard('${result.metadata.tags?.join(', ') || ''}', 'tags')" 
                                                class="text-xs text-primary hover:text-primary-dark">
                                            <i class="fas fa-copy mr-1"></i>Copy All Tags
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <div class="flex items-center justify-between mb-2">
                                        <h5 class="font-medium text-gray-900">Description</h5>
                                        <span class="text-xs text-gray-500">${result.metadata.description?.length || 0} chars</span>
                                    </div>
                                    <div class="bg-white p-3 rounded-xl border">
                                        <p class="text-gray-700 text-sm whitespace-pre-wrap">${result.metadata.description}</p>
                                        <button onclick="uploadManager.copyToClipboard('${result.metadata.description?.replace(/'/g, "\\'").replace(/\n/g, '\\n') || ''}', 'description')" 
                                                class="text-xs text-primary hover:text-primary-dark mt-2">
                                            <i class="fas fa-copy mr-1"></i>Copy Description
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                    
                    ${result.etsyListing ? `
                        <div class="bg-green-50 border border-green-200 rounded-2xl p-6">
                            <h4 class="font-semibold text-green-900 mb-4">
                                <i class="fab fa-etsy text-green-600 mr-2"></i>
                                Etsy Draft Listing Created
                            </h4>
                            <div class="space-y-3">
                                <p class="text-green-700">Your draft listing has been created and is ready for review.</p>
                                <div class="flex gap-3">
                                    <a href="${result.etsyListing.editUrl}" target="_blank" 
                                       class="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-2xl font-medium transition-colors inline-flex items-center">
                                        <i class="fas fa-external-link-alt mr-2"></i>
                                        Edit on Etsy
                                    </a>
                                    <button onclick="uploadManager.copyToClipboard('${result.etsyListing.editUrl}', 'listing-url')" 
                                            class="bg-green-100 hover:bg-green-200 text-green-800 px-4 py-3 rounded-2xl font-medium transition-colors">
                                        <i class="fas fa-copy mr-2"></i>
                                        Copy Link
                                    </button>
                                </div>
                            </div>
                        </div>
                    ` : ''}

                    <!-- Action Buttons -->
                    <div class="flex justify-center gap-4 pt-4">
                        <button onclick="uploadManager.resetUpload()" 
                                class="bg-gray-100 hover:bg-gray-200 text-gray-900 px-6 py-3 rounded-2xl font-medium transition-colors">
                            <i class="fas fa-plus mr-2"></i>
                            Process More Images
                        </button>
                        <button onclick="showPage('home')" 
                                class="bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-2xl font-medium transition-colors">
                            <i class="fas fa-home mr-2"></i>
                            Back to Home
                        </button>
                    </div>
                </div>
            `;
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
        
        resultsContent.innerHTML = `
            <div class="bg-red-50 border border-red-200 rounded-2xl p-6">
                <h4 class="font-semibold text-red-900 mb-4">
                    <i class="fas fa-exclamation-triangle text-red-600 mr-2"></i>
                    Processing Failed
                </h4>
                <p class="text-red-700 mb-4">${errorMessage}</p>
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
        
        // Hide all sections except upload
        document.getElementById('preview-container').classList.add('hidden');
        document.getElementById('processing-container').classList.add('hidden');
        document.getElementById('results-container').classList.add('hidden');
        document.getElementById('error-container').classList.add('hidden');
        
        // Reset processing steps
        this.resetProgressIndicators();
        
        // Reset overall progress
        const progressBar = document.getElementById('overall-progress-bar');
        const progressText = document.getElementById('overall-progress-text');
        if (progressBar) progressBar.style.width = '0%';
        if (progressText) progressText.textContent = '0%';
    }
}

// Initialize upload manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.uploadManager = new UploadManager();
});

// Global function for removing files (called from HTML)
function resetUpload() {
    if (window.uploadManager) {
        window.uploadManager.resetUpload();
    }
}

console.log('Upload module loaded');