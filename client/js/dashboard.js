// Enhanced Dashboard functionality for ListGenie with tabs and marketplace
class DashboardManager {
    constructor() {
        this.charts = {};
        this.data = null;
        this.currentTab = 'my-shop';
        this.marketplaceData = {
            listings: [],
            offset: 0,
            hasMore: true,
            loading: false
        };
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAuthenticationAndLoadData();
    }

    setupEventListeners() {
        // Retry button
        const retryButton = document.getElementById('retry-button');
        if (retryButton) {
            retryButton.addEventListener('click', () => {
                this.checkAuthenticationAndLoadData();
            });
        }

        // Tab switching
        const myShopTab = document.getElementById('my-shop-tab');
        const marketplaceTab = document.getElementById('marketplace-tab');
        
        if (myShopTab) {
            myShopTab.addEventListener('click', () => this.switchTab('my-shop'));
        }
        
        if (marketplaceTab) {
            marketplaceTab.addEventListener('click', () => this.switchTab('marketplace'));
        }

        // Marketplace refresh
        const refreshButton = document.getElementById('refresh-button');
        const loadMoreButton = document.getElementById('load-more-button');

        if (refreshButton) {
            refreshButton.addEventListener('click', () => this.refreshMarketplace());
        }

        if (loadMoreButton) {
            loadMoreButton.addEventListener('click', () => this.loadMoreMarketplace());
        }

        // Modal controls
        const closeModal = document.getElementById('close-modal');
        const modal = document.getElementById('listing-modal');

        if (closeModal) {
            closeModal.addEventListener('click', () => this.closeModal());
        }

        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal();
                }
            });
        }
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
            btn.classList.add('border-transparent', 'text-gray-500');
            btn.classList.remove('border-primary', 'text-primary');
        });

        const activeTab = document.getElementById(`${tabName}-tab`);
        if (activeTab) {
            activeTab.classList.add('active', 'border-primary', 'text-primary');
            activeTab.classList.remove('border-transparent', 'text-gray-500');
        }

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.add('hidden');
        });

        const activeContent = document.getElementById(`${tabName}-content`);
        if (activeContent) {
            activeContent.classList.remove('hidden');
        }

        this.currentTab = tabName;

        // Load marketplace data if switching to marketplace tab
        if (tabName === 'marketplace' && this.marketplaceData.listings.length === 0) {
            this.refreshMarketplace();
        }
    }

    async checkAuthenticationAndLoadData() {
        try {
            this.showLoadingState();
            
            // Debug: Check if we have a token
            const storedToken = localStorage.getItem('ListGenie-auth-token');
            console.log('Dashboard auth check - Token in localStorage:', storedToken ? 'present' : 'missing');
            
            // Check authentication status first
            const authResponse = await window.apiClient.makeRequest('/api/auth/status', {
                method: 'GET',
                includeAuth: true // Include auth token to check authentication status
            });

            if (!authResponse.ok) {
                throw new Error(`HTTP error! status: ${authResponse.status}`);
            }

            const authResult = await authResponse.json();
            console.log('Dashboard auth result:', authResult);
            
            if (!authResult.authenticated) {
                this.showNotAuthenticatedState();
                return;
            }

            if (!authResult.services.etsy) {
                this.showEtsyNotConnectedState();
                return;
            }

            // User is authenticated and has Etsy connected, load dashboard data
            await this.loadDashboardData();
        } catch (error) {
            console.error('Authentication check error:', error);
            this.showErrorState(error.message);
        }
    }

    async loadDashboardData() {
        try {
            this.showLoadingState();
            
            // Use the API client for authenticated requests
            const response = await window.apiClient.makeRequest('/api/dashboard/overview', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success) {
                this.data = result.data;
                this.renderDashboard();
                this.hideLoadingState();
            } else {
                throw new Error(result.message || 'Failed to load dashboard data');
            }
        } catch (error) {
            console.error('Dashboard loading error:', error);
            this.showErrorState(error.message);
        }
    }

    async refreshMarketplace() {
        try {
            const sortOn = document.getElementById('sort-filter').value;

            this.marketplaceData.offset = 0;
            this.marketplaceData.listings = [];
            this.marketplaceData.hasMore = true;

            await this.loadMarketplaceListings(sortOn);
        } catch (error) {
            console.error('Marketplace refresh error:', error);
            this.showErrorState(error.message);
        }
    }

    async loadMoreMarketplace() {
        if (this.marketplaceData.loading || !this.marketplaceData.hasMore) return;

        const sortOn = document.getElementById('sort-filter').value;

        await this.loadMarketplaceListings(sortOn);
    }

    async loadMarketplaceListings(sortOn) {
        try {
            this.marketplaceData.loading = true;
            this.updateLoadMoreButton();

            // Map frontend sort options to Etsy API parameters
            let etsySortOn = 'score';
            let etsySortOrder = 'desc';

            switch (sortOn) {
                case 'price_asc':
                    etsySortOn = 'price';
                    etsySortOrder = 'asc';
                    break;
                case 'price_desc':
                    etsySortOn = 'price';
                    etsySortOrder = 'desc';
                    break;
                case 'created':
                    etsySortOn = 'created';
                    etsySortOrder = 'desc';
                    break;
                case 'updated':
                    etsySortOn = 'updated';
                    etsySortOrder = 'desc';
                    break;
                default:
                    etsySortOn = 'score';
                    etsySortOrder = 'desc';
            }

            const searchOptions = {
                sortOn: etsySortOn,
                sortOrder: etsySortOrder,
                limit: 20,
                offset: this.marketplaceData.offset
            };

            const response = await window.apiClient.makeRequest(`/api/marketplace/featured?${new URLSearchParams(searchOptions).toString()}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success) {
                const newListings = result.data.results || [];
                this.marketplaceData.listings = this.marketplaceData.offset === 0 
                    ? newListings 
                    : [...this.marketplaceData.listings, ...newListings];
                
                this.marketplaceData.offset += newListings.length;
                this.marketplaceData.hasMore = newListings.length === 20;

                this.renderMarketplaceListings();
                this.updateResultsCount();
            } else {
                throw new Error(result.message || 'Failed to load featured listings');
            }
        } catch (error) {
            console.error('Marketplace loading error:', error);
            this.showErrorState(error.message);
        } finally {
            this.marketplaceData.loading = false;
            this.updateLoadMoreButton();
        }
    }

    renderMarketplaceListings() {
        const container = document.getElementById('marketplace-listings');
        if (!container) return;

        container.innerHTML = '';

        if (this.marketplaceData.listings.length === 0) {
            container.innerHTML = `
                <div class="col-span-full text-center py-12">
                    <i class="fas fa-star text-4xl text-gray-400 mb-4"></i>
                    <p class="text-gray-600">No featured listings found. Try refreshing or check back later.</p>
                </div>
            `;
            return;
        }

        this.marketplaceData.listings.forEach(listing => {
            const listingCard = this.createListingCard(listing);
            container.appendChild(listingCard);
        });
    }

    createListingCard(listing) {
        const card = document.createElement('div');
        card.className = 'listing-card bg-white rounded-lg shadow-md overflow-hidden cursor-pointer';
        
        // Get the best available image from the listing data
        let imageUrl = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzY2NjY2NiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==';
        
        if (listing.images && listing.images.length > 0) {
            const image = listing.images[0];
            imageUrl = image.url_570xN || image.url_340x270 || image.url_75x75 || image.url_fullxfull;
        }
        
        // Fix price parsing - handle Etsy price structure (amount/divisor)
        let price = 0;
        if (listing.price && listing.price.amount && listing.price.divisor) {
            const amount = typeof listing.price.amount === 'string' ? parseFloat(listing.price.amount) : Number(listing.price.amount);
            const divisor = typeof listing.price.divisor === 'string' ? parseFloat(listing.price.divisor) : Number(listing.price.divisor);
            price = amount / divisor;
        }
        if (isNaN(price)) price = 0;
        const formattedPrice = price.toFixed(2);
        const views = listing.views || 0;
        const favorites = listing.num_favorers || 0;
        const reviews = listing.num_reviews || 0;
        const rating = listing.rating || 0;
        const state = listing.state || 'active';

        card.innerHTML = `
            <div class="relative">
                <div class="w-full h-48 bg-gray-200 flex items-center justify-center">
                    <img src="${imageUrl}" 
                         alt="${listing.title}" 
                         class="listing-image w-full h-full object-cover" 
                         onload="this.style.display='block'"
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                    <div class="absolute inset-0 bg-gray-200 flex items-center justify-center text-gray-500 text-sm" style="display: none;">
                        <i class="fas fa-image mr-2"></i>No Image
                    </div>
                </div>
                <div class="absolute top-2 right-2 bg-white rounded-full px-2 py-1 text-xs font-semibold text-gray-700">
                    $${formattedPrice}
                </div>
                ${state === 'draft' ? '<div class="absolute top-2 left-2 bg-yellow-500 text-white px-2 py-1 rounded text-xs font-semibold">Draft</div>' : ''}
            </div>
            <div class="p-4">
                <h3 class="font-semibold text-gray-900 text-sm mb-2 line-clamp-2">${listing.title}</h3>
                <div class="flex items-center justify-between text-xs text-gray-500 mb-2">
                    <span><i class="fas fa-eye mr-1"></i>${views}</span>
                    <span><i class="fas fa-heart mr-1"></i>${favorites}</span>
                    <span><i class="fas fa-star mr-1"></i>${rating.toFixed(1)}</span>
                </div>
                <div class="text-xs text-gray-600">
                    <span class="font-medium">${listing.Shop?.shop_name || 'Unknown Shop'}</span>
                    ${reviews > 0 ? `<span class="ml-2">(${reviews} reviews)</span>` : ''}
                </div>
            </div>
        `;

        // Handle click based on listing state
        card.addEventListener('click', (e) => {
            e.preventDefault();
            if (state === 'draft') {
                // Draft listings open in modal since they're not published
                this.showListingDetails(listing.listing_id);
            } else {
                // Active listings open in browser
                const listingUrl = `https://www.etsy.com/listing/${listing.listing_id}`;
                window.open(listingUrl, '_blank');
            }
        });
        
        return card;
    }


    async showListingDetails(listingId) {
        try {
            const response = await window.apiClient.makeRequest(`/api/marketplace/listing/${listingId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success) {
                this.renderListingModal(result.data);
            } else {
                throw new Error(result.message || 'Failed to load listing details');
            }
        } catch (error) {
            console.error('Listing details error:', error);
            this.showErrorState(error.message);
        }
    }

    renderListingModal(data) {
        const { listing, reviews } = data;
        const modal = document.getElementById('listing-modal');
        const title = document.getElementById('modal-title');
        const content = document.getElementById('modal-content');

        if (!modal || !title || !content) return;

        title.textContent = listing.title;

        // Get the best available image from the listing data
        let imageUrl = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzY2NjY2NiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==';
        
        if (listing.images && listing.images.length > 0) {
            const image = listing.images[0];
            imageUrl = image.url_570xN || image.url_340x270 || image.url_75x75 || image.url_fullxfull;
        }

        // Fix price parsing for modal - handle Etsy price structure (amount/divisor)
        let price = 0;
        if (listing.price && listing.price.amount && listing.price.divisor) {
            const amount = typeof listing.price.amount === 'string' ? parseFloat(listing.price.amount) : Number(listing.price.amount);
            const divisor = typeof listing.price.divisor === 'string' ? parseFloat(listing.price.divisor) : Number(listing.price.divisor);
            price = amount / divisor;
        }
        if (isNaN(price)) price = 0;
        const formattedPrice = price.toFixed(2);
        const views = listing.views || 0;
        const favorites = listing.num_favorers || 0;
        const reviewCount = listing.num_reviews || 0;
        const rating = listing.rating || 0;
        const state = listing.state || 'active';

        // Create image gallery HTML
        let imageGalleryHtml = '';
        if (listing.images && listing.images.length > 0) {
            imageGalleryHtml = `
                <div class="mb-4">
                    <!-- Main Image Display -->
                    <div class="relative mb-4">
                        <img src="${imageUrl}" 
                             alt="${listing.title}" 
                             class="main-image w-full h-80 object-cover rounded-lg"
                             onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzY2NjY2NiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIE5vdCBBdmFpbGFibGU8L3RleHQ+PC9zdmc+'">
                        
                        <!-- Navigation Arrows (only show if more than 1 image) -->
                        ${listing.images.length > 1 ? `
                            <button onclick="this.parentElement.parentElement.querySelector('.prev-btn').click()" 
                                    class="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-all">
                                <i class="fas fa-chevron-left"></i>
                            </button>
                            <button onclick="this.parentElement.parentElement.querySelector('.next-btn').click()" 
                                    class="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-all">
                                <i class="fas fa-chevron-right"></i>
                            </button>
                        ` : ''}
                    </div>
                    
                    <!-- Thumbnail Navigation -->
                    <div class="flex space-x-2 overflow-x-auto pb-2">
                        ${listing.images.map((image, index) => {
                            const imageUrl = image.url_570xN || image.url_340x270 || image.url_75x75 || image.url_fullxfull;
                            return `
                                <img src="${imageUrl}" 
                                     alt="${listing.title} - Image ${index + 1}" 
                                     class="thumbnail-image w-20 h-20 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity border-2 border-transparent hover:border-blue-500 flex-shrink-0"
                                     data-index="${index}"
                                     onclick="this.parentElement.parentElement.parentElement.querySelector('.main-image').src='${imageUrl}'; this.parentElement.querySelectorAll('.thumbnail-image').forEach(thumb => thumb.classList.remove('border-blue-500')); this.classList.add('border-blue-500')"
                                     onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2YzZjRmNiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTAiIGZpbGw9IiM2NjY2NjYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBJbWFnZTwvdGV4dD48L3N2Zz4='">
                            `;
                        }).join('')}
                    </div>
                    
                    <!-- Hidden Navigation Buttons for Arrow Clicks -->
                    <div class="hidden">
                        <button class="prev-btn" onclick="
                            const thumbnails = this.parentElement.parentElement.querySelectorAll('.thumbnail-image');
                            const current = Array.from(thumbnails).find(thumb => thumb.classList.contains('border-blue-500'));
                            const currentIndex = current ? parseInt(current.dataset.index) : 0;
                            const prevIndex = currentIndex > 0 ? currentIndex - 1 : thumbnails.length - 1;
                            const prevThumb = thumbnails[prevIndex];
                            const mainImg = this.parentElement.parentElement.querySelector('.main-image');
                            const prevImgUrl = prevThumb.src;
                            mainImg.src = prevImgUrl;
                            thumbnails.forEach(thumb => thumb.classList.remove('border-blue-500'));
                            prevThumb.classList.add('border-blue-500');
                        "></button>
                        <button class="next-btn" onclick="
                            const thumbnails = this.parentElement.parentElement.querySelectorAll('.thumbnail-image');
                            const current = Array.from(thumbnails).find(thumb => thumb.classList.contains('border-blue-500'));
                            const currentIndex = current ? parseInt(current.dataset.index) : 0;
                            const nextIndex = currentIndex < thumbnails.length - 1 ? currentIndex + 1 : 0;
                            const nextThumb = thumbnails[nextIndex];
                            const mainImg = this.parentElement.parentElement.querySelector('.main-image');
                            const nextImgUrl = nextThumb.src;
                            mainImg.src = nextImgUrl;
                            thumbnails.forEach(thumb => thumb.classList.remove('border-blue-500'));
                            nextThumb.classList.add('border-blue-500');
                        "></button>
                    </div>
                </div>
            `;
        } else {
            imageGalleryHtml = `
                <img src="${imageUrl}" alt="${listing.title}" class="w-full h-80 object-cover rounded-lg mb-4"
                     onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzY2NjY2NiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIE5vdCBBdmFpbGFibGU8L3RleHQ+PC9zdmc+'">
            `;
        }

        content.innerHTML = `
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                    ${imageGalleryHtml}
                    ${state !== 'draft' ? `
                        <div class="flex justify-center mb-4">
                            <a href="https://www.etsy.com/listing/${listing.listing_id}" 
                               target="_blank" 
                               class="bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary-dark transition-colors inline-flex items-center">
                                <i class="fas fa-external-link-alt mr-2"></i>
                                View on Etsy
                            </a>
                        </div>
                    ` : `
                        <div class="flex justify-center mb-4">
                            <div class="bg-yellow-100 text-yellow-800 px-6 py-2 rounded-lg inline-flex items-center">
                                <i class="fas fa-edit mr-2"></i>
                                Draft Listing (Not Published)
                            </div>
                        </div>
                    `}
                    <div class="grid grid-cols-2 gap-4 text-center">
                        <div class="bg-gray-50 p-3 rounded-lg">
                            <div class="text-2xl font-bold text-gray-900">$${formattedPrice}</div>
                            <div class="text-sm text-gray-600">Price</div>
                        </div>
                        <div class="bg-gray-50 p-3 rounded-lg">
                            <div class="text-2xl font-bold text-gray-900">${rating.toFixed(1)}</div>
                            <div class="text-sm text-gray-600">Rating</div>
                        </div>
                    </div>
                </div>
                <div>
                    <div class="mb-4">
                        <h4 class="font-semibold text-gray-900 mb-2">Shop Information</h4>
                        <p class="text-gray-600">DreamyDigiGoods</p>
                        <p class="text-sm text-gray-500">${listing.Shop?.url || ''}</p>
                    </div>
                    
                    ${state !== 'draft' ? `
                        <div class="mb-4">
                            <h4 class="font-semibold text-gray-900 mb-2">Statistics</h4>
                            <div class="grid grid-cols-2 gap-4 text-sm">
                                <div class="flex justify-between">
                                    <span>Views:</span>
                                    <span class="font-medium">${views}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span>Favorites:</span>
                                    <span class="font-medium">${favorites}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span>Reviews:</span>
                                    <span class="font-medium">${reviewCount}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span>State:</span>
                                    <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                        state === 'active' 
                                            ? 'bg-green-100 text-green-800' 
                                            : state === 'draft'
                                            ? 'bg-yellow-100 text-yellow-800'
                                            : 'bg-gray-100 text-gray-800'
                                    }">
                                        ${state}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ` : `
                        <div class="mb-4">
                            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                <div class="flex items-center">
                                    <i class="fas fa-edit text-yellow-600 mr-2"></i>
                                    <span class="text-yellow-800 font-medium">Draft Listing</span>
                                </div>
                                <p class="text-yellow-700 text-sm mt-1">This listing is not yet published and is not visible to customers.</p>
                            </div>
                        </div>
                    `}

                    ${listing.description ? `
                        <div class="mb-4">
                            <h4 class="font-semibold text-gray-900 mb-2">Description</h4>
                            <div class="text-sm text-gray-600 max-h-32 overflow-y-auto">
                                ${listing.description.substring(0, 500)}${listing.description.length > 500 ? '...' : ''}
                            </div>
                        </div>
                    ` : ''}

                    ${listing.tags && listing.tags.length > 0 ? `
                        <div class="mb-4">
                            <h4 class="font-semibold text-gray-900 mb-2">Tags</h4>
                            <div class="flex flex-wrap gap-1">
                                ${listing.tags.map(tag => `<span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">${tag}</span>`).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>

            ${reviews.length > 0 ? `
                <div class="mt-6 border-t pt-6">
                    <h4 class="font-semibold text-gray-900 mb-4">Recent Reviews</h4>
                    <div class="space-y-3 max-h-64 overflow-y-auto">
                        ${reviews.slice(0, 5).map(review => `
                            <div class="bg-gray-50 p-3 rounded-lg">
                                <div class="flex items-center justify-between mb-2">
                                    <div class="flex items-center">
                                        <div class="text-yellow-400">${'★'.repeat(review.rating || 0)}${'☆'.repeat(5 - (review.rating || 0))}</div>
                                        <span class="ml-2 text-sm text-gray-600">${review.rating || 0}/5</span>
                                    </div>
                                    <span class="text-xs text-gray-500">
                                        ${new Date(review.creation_tsz * 1000).toLocaleDateString()}
                                    </span>
                                </div>
                                <p class="text-sm text-gray-800">${review.review || 'No review text'}</p>
                                <div class="text-xs text-gray-500 mt-1">
                                    by ${review.buyer_name || 'Anonymous'}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        `;

        // Initialize image gallery - highlight first thumbnail
        if (listing.images && listing.images.length > 0) {
            setTimeout(() => {
                const firstThumbnail = content.querySelector('.thumbnail-image');
                if (firstThumbnail) {
                    firstThumbnail.classList.add('border-blue-500');
                }
            }, 100);
        }

        modal.classList.remove('hidden');
    }

    closeModal() {
        const modal = document.getElementById('listing-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    updateLoadMoreButton() {
        const button = document.getElementById('load-more-button');
        if (!button) return;

        if (this.marketplaceData.loading) {
            button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Loading...';
            button.disabled = true;
        } else if (this.marketplaceData.hasMore) {
            button.innerHTML = '<i class="fas fa-plus mr-2"></i>Load More Listings';
            button.disabled = false;
            button.classList.remove('hidden');
        } else {
            button.classList.add('hidden');
        }
    }

    updateResultsCount() {
        const countElement = document.getElementById('marketplace-results-count');
        if (countElement) {
            const count = this.marketplaceData.listings.length;
            countElement.textContent = `Showing ${count} featured listing${count !== 1 ? 's' : ''}`;
        }
    }

    showLoadingState() {
        document.getElementById('loading-state').classList.remove('hidden');
        document.getElementById('error-state').classList.add('hidden');
        document.getElementById('dashboard-content').classList.add('hidden');
    }

    hideLoadingState() {
        document.getElementById('loading-state').classList.add('hidden');
        document.getElementById('dashboard-content').classList.remove('hidden');
    }

    showErrorState(message) {
        document.getElementById('loading-state').classList.add('hidden');
        document.getElementById('error-message').textContent = message;
        document.getElementById('error-state').classList.remove('hidden');
    }

    showNotAuthenticatedState() {
        document.getElementById('loading-state').classList.add('hidden');
        document.getElementById('error-state').classList.add('hidden');
        document.getElementById('dashboard-content').classList.add('hidden');
        
        // Show not authenticated message
        const errorState = document.getElementById('error-state');
        errorState.innerHTML = `
            <div class="text-center py-12">
                <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-6 max-w-md mx-auto">
                    <i class="fas fa-user-slash text-yellow-500 text-3xl mb-4"></i>
                    <h3 class="text-lg font-semibold text-yellow-800 mb-2">Authentication Required</h3>
                    <p class="text-yellow-600 mb-4">Please log in to view your dashboard.</p>
                    <a href="settings.html" class="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition-colors inline-block">
                        <i class="fas fa-cog mr-2"></i>Go to Settings
                    </a>
                </div>
            </div>
        `;
        errorState.classList.remove('hidden');
    }

    showEtsyNotConnectedState() {
        document.getElementById('loading-state').classList.add('hidden');
        document.getElementById('error-state').classList.add('hidden');
        document.getElementById('dashboard-content').classList.add('hidden');
        
        // Show Etsy not connected message
        const errorState = document.getElementById('error-state');
        errorState.innerHTML = `
            <div class="text-center py-12">
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-6 max-w-md mx-auto">
                    <i class="fas fa-store text-blue-500 text-3xl mb-4"></i>
                    <h3 class="text-lg font-semibold text-blue-800 mb-2">Etsy Not Connected</h3>
                    <p class="text-blue-600 mb-4">Please connect your Etsy account to view dashboard data.</p>
                    <a href="settings.html" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors inline-block">
                        <i class="fas fa-link mr-2"></i>Connect Etsy
                    </a>
                </div>
            </div>
        `;
        errorState.classList.remove('hidden');
    }

    renderDashboard() {
        this.renderMetrics();
        this.renderCharts();
        this.renderListingsTable();
        this.renderReviews();
    }

    renderMetrics() {
        const metrics = this.data.metrics;
        
        // Update metric cards
        document.getElementById('total-sales').textContent = metrics.totalSales || 0;
        document.getElementById('total-revenue').textContent = `$${Number(metrics.totalRevenue || 0).toFixed(2)}`;
        document.getElementById('avg-order-value').textContent = `$${Number(metrics.averageOrderValue || 0).toFixed(2)}`;
        document.getElementById('avg-rating').textContent = Number(metrics.averageRating || 0).toFixed(1);
    }

    renderCharts() {
        this.renderSalesChart();
        this.renderRevenueChart();
    }

    renderSalesChart() {
        const ctx = document.getElementById('sales-chart').getContext('2d');
        
        // Generate sample data for the last 7 days
        const labels = [];
        const salesData = [];
        const revenueData = [];
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            
            // Generate sample data (in real implementation, this would come from the API)
            salesData.push(Math.floor(Math.random() * 10) + 1);
            revenueData.push(Math.floor(Math.random() * 200) + 50);
        }

        if (this.charts.sales) {
            this.charts.sales.destroy();
        }

        this.charts.sales = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Sales',
                    data: salesData,
                    borderColor: 'rgb(99, 102, 241)',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }

    renderRevenueChart() {
        const ctx = document.getElementById('revenue-chart').getContext('2d');
        
        // Sample revenue breakdown data
        const revenueData = [
            { label: 'Digital Products', value: 65, color: 'rgb(99, 102, 241)' },
            { label: 'Physical Products', value: 25, color: 'rgb(59, 130, 246)' },
            { label: 'Services', value: 10, color: 'rgb(139, 92, 246)' }
        ];

        if (this.charts.revenue) {
            this.charts.revenue.destroy();
        }

        this.charts.revenue = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: revenueData.map(item => item.label),
                datasets: [{
                    data: revenueData.map(item => item.value),
                    backgroundColor: revenueData.map(item => item.color),
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    }
                }
            }
        });
    }

    renderListingsTable() {
        const tbody = document.getElementById('listings-table-body');
        tbody.innerHTML = '';

        if (!this.data.listings || this.data.listings.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="px-6 py-4 text-center text-gray-500">
                        <i class="fas fa-inbox text-2xl mb-2 block"></i>
                        No listings found
                    </td>
                </tr>
            `;
            return;
        }

        this.data.listings.slice(0, 10).forEach(listing => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50 transition-colors cursor-pointer';
            
            // Get the best available image from the listing data
            let imageUrl = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNzUiIGhlaWdodD0iNzUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2YzZjRmNiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTAiIGZpbGw9IiM2NjY2NjYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=';

            if (listing.images && listing.images.length > 0) {
                const image = listing.images[0];
                imageUrl = image.url_75x75 || image.url_340x270 || image.url_570xN || image.url_fullxfull;
            }
            
            // Fix price parsing for table - handle Etsy price structure (amount/divisor)
            let price = 0;
            if (listing.price && listing.price.amount && listing.price.divisor) {
                const amount = typeof listing.price.amount === 'string' ? parseFloat(listing.price.amount) : Number(listing.price.amount);
                const divisor = typeof listing.price.divisor === 'string' ? parseFloat(listing.price.divisor) : Number(listing.price.divisor);
                price = amount / divisor;
            }
            if (isNaN(price)) price = 0;
            const formattedPrice = price.toFixed(2);
            
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="flex-shrink-0 h-12 w-12">
                            <img class="table-image h-12 w-12 rounded-lg object-cover" 
                                 src="${imageUrl}" 
                                 alt="${listing.title}"
                                 onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNzUiIGhlaWdodD0iNzUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2YzZjRmNiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTAiIGZpbGw9IiM2NjY2NjYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZSBOb3QgQXZhaWxhYmxlPC90ZXh0Pjwvc3ZnPg=='">
                        </div>
                        <div class="ml-4">
                            <div class="text-sm font-medium text-gray-900 max-w-xs truncate">${listing.title}</div>
                            <div class="text-sm text-gray-500">ID: ${listing.listing_id}</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    $${formattedPrice}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${listing.views || 0}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${listing.num_favorers || 0}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        listing.state === 'active' 
                            ? 'bg-green-100 text-green-800' 
                            : listing.state === 'draft'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                    }">
                        ${listing.state || 'unknown'}
                    </span>
                </td>
            `;
            
            // Handle click based on listing state
            row.addEventListener('click', (e) => {
                e.preventDefault();
                if (listing.state === 'draft') {
                    // Draft listings open in modal since they're not published
                    this.showListingDetails(listing.listing_id);
                } else {
                    // Active listings open in browser
                    const listingUrl = `https://www.etsy.com/listing/${listing.listing_id}`;
                    window.open(listingUrl, '_blank');
                }
            });
            
            tbody.appendChild(row);
        });
    }

    renderReviews() {
        const container = document.getElementById('reviews-container');
        container.innerHTML = '';

        if (!this.data.reviews || this.data.reviews.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-comments text-3xl mb-4 block"></i>
                    <p>No reviews found</p>
                </div>
            `;
            return;
        }

        this.data.reviews.slice(0, 5).forEach(review => {
            const reviewCard = document.createElement('div');
            reviewCard.className = 'bg-gray-50 rounded-lg p-4 border border-gray-200';
            
            const stars = '★'.repeat(review.rating || 0) + '☆'.repeat(5 - (review.rating || 0));
            
            reviewCard.innerHTML = `
                <div class="flex items-start justify-between mb-2">
                    <div class="flex items-center">
                        <div class="text-yellow-400 text-lg">${stars}</div>
                        <span class="ml-2 text-sm text-gray-600">${review.rating || 0}/5</span>
                    </div>
                    <span class="text-xs text-gray-500">
                        ${new Date(review.creation_tsz * 1000).toLocaleDateString()}
                    </span>
                </div>
                <p class="text-gray-800 text-sm mb-2">${review.review || 'No review text'}</p>
                <div class="text-xs text-gray-500">
                    by ${review.buyer_name || 'Anonymous'}
                </div>
            `;
            
            container.appendChild(reviewCard);
        });
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Dashboard page loaded, initializing dashboard manager...');
    
    // Wait a bit for API client to be fully initialized
    setTimeout(() => {
        if (window.apiClient) {
            window.dashboardManager = new DashboardManager();
            console.log('Dashboard manager initialized');
        } else {
            console.error('API client not available');
            // Show error state
            document.getElementById('loading-state').classList.add('hidden');
            document.getElementById('error-message').textContent = 'API client not available. Please refresh the page.';
            document.getElementById('error-state').classList.remove('hidden');
        }
    }, 100);
});