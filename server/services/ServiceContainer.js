/**
 * Service Container for Dependency Injection
 * Manages service lifecycle and dependencies
 */

const config = require('../config');
const { ValidationError } = require('../utils/errors');

class ServiceContainer {
  constructor() {
    this.services = new Map();
    this.singletons = new Map();
    this.factories = new Map();
  }

  /**
   * Register a service factory function
   * @param {string} name - Service name
   * @param {Function} factory - Factory function that creates the service
   * @param {Object} options - Registration options
   */
  register(name, factory, options = {}) {
    if (typeof factory !== 'function') {
      throw new ValidationError(`Service factory for '${name}' must be a function`);
    }

    this.factories.set(name, {
      factory,
      singleton: options.singleton !== false, // Default to singleton
      dependencies: options.dependencies || [],
      initialized: false
    });
  }

  /**
   * Register a singleton service instance
   * @param {string} name - Service name
   * @param {*} instance - Service instance
   */
  registerInstance(name, instance) {
    this.singletons.set(name, instance);
  }

  /**
   * Get a service instance
   * @param {string} name - Service name
   * @returns {*} Service instance
   */
  get(name) {
    // Check if it's a registered singleton instance
    if (this.singletons.has(name)) {
      return this.singletons.get(name);
    }

    // Check if it's a registered factory
    if (this.factories.has(name)) {
      return this.createFromFactory(name);
    }

    throw new Error(`Service '${name}' is not registered`);
  }

  /**
   * Create service instance from factory
   * @param {string} name - Service name
   * @returns {*} Service instance
   * @private
   */
  createFromFactory(name) {
    const serviceConfig = this.factories.get(name);
    
    // Return existing singleton if available
    if (serviceConfig.singleton && this.services.has(name)) {
      return this.services.get(name);
    }

    // Resolve dependencies
    const dependencies = serviceConfig.dependencies.map(dep => this.get(dep));
    
    // Create service instance
    const instance = serviceConfig.factory(...dependencies);
    
    // Store singleton
    if (serviceConfig.singleton) {
      this.services.set(name, instance);
    }

    return instance;
  }

  /**
   * Check if a service is registered
   * @param {string} name - Service name
   * @returns {boolean}
   */
  has(name) {
    return this.singletons.has(name) || this.factories.has(name);
  }

  /**
   * Initialize all registered services
   * @returns {Promise<void>}
   */
  async initialize() {
    const initPromises = [];

    for (const [name, serviceConfig] of this.factories.entries()) {
      if (!serviceConfig.initialized) {
        const service = this.get(name);
        
        // Initialize service if it has an initialize method
        if (service && typeof service.initialize === 'function') {
          initPromises.push(
            service.initialize().then(() => {
              serviceConfig.initialized = true;
              console.log(`Service '${name}' initialized successfully`);
            }).catch(error => {
              console.error(`Failed to initialize service '${name}':`, error.message);
              throw error;
            })
          );
        } else {
          serviceConfig.initialized = true;
        }
      }
    }

    await Promise.all(initPromises);
  }

  /**
   * Destroy all services and clean up resources
   * @returns {Promise<void>}
   */
  async destroy() {
    const destroyPromises = [];

    // Destroy singleton instances
    for (const [name, service] of this.services.entries()) {
      if (service && typeof service.destroy === 'function') {
        destroyPromises.push(
          service.destroy().catch(error => {
            console.error(`Error destroying service '${name}':`, error.message);
          })
        );
      }
    }

    // Destroy registered singleton instances
    for (const [name, service] of this.singletons.entries()) {
      if (service && typeof service.destroy === 'function') {
        destroyPromises.push(
          service.destroy().catch(error => {
            console.error(`Error destroying service '${name}':`, error.message);
          })
        );
      }
    }

    await Promise.all(destroyPromises);
    
    // Clear all registrations
    this.services.clear();
    this.singletons.clear();
    this.factories.clear();
  }
}

/**
 * Create and configure the default service container
 */
function createServiceContainer() {
  const container = new ServiceContainer();

  // Register configuration service
  container.registerInstance('config', config);

  // Register core services
  container.register('imageService', () => {
    const ImageService = require('./imageService');
    return new ImageService();
  });

  container.register('fileService', () => {
    return require('./fileService'); // Singleton instance
  });

  container.register('settingsService', () => {
    const SettingsService = require('./settingsService');
    return new SettingsService();
  });

  container.register('googleDriveService', (config) => {
    const GoogleDriveService = require('./googleDriveService');
    const service = new GoogleDriveService();
    
    // Initialize with config if available
    if (config.isGoogleConfigured()) {
      service.initialize({
        client_id: config.get('google.clientId'),
        client_secret: config.get('google.clientSecret'),
        redirect_uri: config.get('google.redirectUri')
      }).catch(error => {
        console.warn('Google Drive service initialization failed:', error.message);
      });
    }
    
    return service;
  }, { dependencies: ['config'] });

  container.register('etsyService', (config) => {
    const EtsyService = require('./etsyService');
    const service = new EtsyService();
    
    // Initialize with config if available
    if (config.isEtsyConfigured()) {
      service.initialize({
        client_id: config.get('etsy.clientId'),
        client_secret: config.get('etsy.clientSecret'),
        redirect_uri: config.get('etsy.redirectUri')
      }).catch(error => {
        console.warn('Etsy service initialization failed:', error.message);
      });
    }
    
    return service;
  }, { dependencies: ['config'] });

  container.register('aiService', (config) => {
    const AIService = require('./aiService');
    const service = new AIService();
    
    // Set API key if available
    if (config.isAIConfigured()) {
      process.env.GOOGLE_AI_API_KEY = config.get('google.aiApiKey');
    }
    
    return service;
  }, { dependencies: ['config'] });

  return container;
}

// Create default container instance
const defaultContainer = createServiceContainer();

module.exports = {
  ServiceContainer,
  createServiceContainer,
  container: defaultContainer
};