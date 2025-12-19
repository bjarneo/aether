/**
 * ServiceLocator - Centralized service instance management
 *
 * Provides singleton access to services with lazy initialization.
 * This standardizes service access patterns across the codebase.
 *
 * Usage:
 *   import { ServiceLocator } from './services/service-locator.js';
 *   import { BlueprintService } from './services/BlueprintService.js';
 *
 *   const blueprintService = ServiceLocator.get(BlueprintService);
 *
 * @module service-locator
 */

/**
 * Service locator for centralized service instance management
 * @class ServiceLocator
 */
export class ServiceLocator {
    /** @type {Map<Function, Object>} */
    static _instances = new Map();

    /** @type {Map<Function, Function>} */
    static _factories = new Map();

    /**
     * Gets or creates a singleton instance of the given service class
     * @template T
     * @param {new (...args: any[]) => T} ServiceClass - The service class to instantiate
     * @param {...any} args - Constructor arguments (only used on first instantiation)
     * @returns {T} The singleton service instance
     * @example
     * const blueprintService = ServiceLocator.get(BlueprintService);
     * const favoritesService = ServiceLocator.get(FavoritesService);
     */
    static get(ServiceClass, ...args) {
        if (!this._instances.has(ServiceClass)) {
            // Check if there's a factory registered
            if (this._factories.has(ServiceClass)) {
                const factory = this._factories.get(ServiceClass);
                this._instances.set(ServiceClass, factory(...args));
            } else {
                this._instances.set(ServiceClass, new ServiceClass(...args));
            }
        }
        return this._instances.get(ServiceClass);
    }

    /**
     * Registers a factory function for creating a service instance
     * Useful for services that need special initialization
     * @template T
     * @param {new (...args: any[]) => T} ServiceClass - The service class
     * @param {(...args: any[]) => T} factory - Factory function to create instance
     * @example
     * ServiceLocator.register(BlueprintService, (manager) => new BlueprintService(manager));
     */
    static register(ServiceClass, factory) {
        this._factories.set(ServiceClass, factory);
    }

    /**
     * Sets an existing instance for a service class
     * Useful for testing or special initialization scenarios
     * @template T
     * @param {new (...args: any[]) => T} ServiceClass - The service class
     * @param {T} instance - The instance to use
     * @example
     * ServiceLocator.set(BlueprintService, mockBlueprintService);
     */
    static set(ServiceClass, instance) {
        this._instances.set(ServiceClass, instance);
    }

    /**
     * Checks if a service instance exists
     * @param {Function} ServiceClass - The service class to check
     * @returns {boolean} True if instance exists
     */
    static has(ServiceClass) {
        return this._instances.has(ServiceClass);
    }

    /**
     * Removes a service instance (useful for cleanup/testing)
     * @param {Function} ServiceClass - The service class to remove
     * @returns {boolean} True if instance was removed
     */
    static remove(ServiceClass) {
        return this._instances.delete(ServiceClass);
    }

    /**
     * Clears all service instances
     * Useful for testing or application shutdown
     */
    static clear() {
        // Call destroy/cleanup on instances that have it
        for (const instance of this._instances.values()) {
            if (typeof instance.destroy === 'function') {
                try {
                    instance.destroy();
                } catch (e) {
                    console.error('Error destroying service:', e);
                }
            }
        }
        this._instances.clear();
        this._factories.clear();
    }

    /**
     * Gets all registered service instances
     * @returns {Map<Function, Object>} Map of service classes to instances
     */
    static getAll() {
        return new Map(this._instances);
    }
}
