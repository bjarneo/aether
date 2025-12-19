/**
 * error-utils.js - Centralized error handling utilities for Aether
 *
 * Provides:
 * - Custom error classes for different error domains
 * - Centralized error logging with context
 * - User-friendly error message mapping
 * - Result pattern for operations that can fail
 *
 * Error Handling Policy:
 * - Service methods: Throw errors (let caller decide how to handle)
 * - UI event handlers: Catch and show toast notification
 * - Utility functions: Return Result objects for critical operations
 *
 * @module error-utils
 */

/**
 * Base error class for Aether-specific errors
 * Includes additional context for debugging
 */
export class AetherError extends Error {
    /**
     * @param {string} message - Error message
     * @param {string} [code] - Error code for programmatic handling
     * @param {Object} [context] - Additional context for debugging
     */
    constructor(message, code = 'AETHER_ERROR', context = {}) {
        super(message);
        this.name = 'AetherError';
        this.code = code;
        this.context = context;
        this.timestamp = new Date().toISOString();
    }

    /**
     * Returns a user-friendly error message
     * @returns {string}
     */
    toUserMessage() {
        return this.message;
    }

    /**
     * Returns detailed debug information
     * @returns {string}
     */
    toDebugString() {
        return `[${this.code}] ${this.message} | Context: ${JSON.stringify(this.context)}`;
    }
}

/**
 * Error for file system operations
 */
export class FileError extends AetherError {
    /**
     * @param {string} message - Error message
     * @param {string} path - File path that caused the error
     * @param {string} [operation] - Operation that failed (read, write, delete, etc.)
     */
    constructor(message, path, operation = 'access') {
        super(message, 'FILE_ERROR', {path, operation});
        this.name = 'FileError';
        this.path = path;
        this.operation = operation;
    }

    toUserMessage() {
        const operationMessages = {
            read: `Could not read file: ${this.path}`,
            write: `Could not write file: ${this.path}`,
            delete: `Could not delete file: ${this.path}`,
            copy: `Could not copy file: ${this.path}`,
            access: `Could not access file: ${this.path}`,
            not_found: `File not found: ${this.path}`,
        };
        return operationMessages[this.operation] || this.message;
    }
}

/**
 * Error for network operations (API calls, downloads)
 */
export class NetworkError extends AetherError {
    /**
     * @param {string} message - Error message
     * @param {string} [url] - URL that caused the error
     * @param {number} [statusCode] - HTTP status code if applicable
     */
    constructor(message, url = '', statusCode = null) {
        super(message, 'NETWORK_ERROR', {url, statusCode});
        this.name = 'NetworkError';
        this.url = url;
        this.statusCode = statusCode;
    }

    toUserMessage() {
        if (this.statusCode === 404) {
            return 'Resource not found';
        }
        if (this.statusCode === 429) {
            return 'Rate limit exceeded. Please wait and try again.';
        }
        if (this.statusCode >= 500) {
            return 'Server error. Please try again later.';
        }
        return 'Network error. Check your connection and try again.';
    }
}

/**
 * Error for validation failures
 */
export class ValidationError extends AetherError {
    /**
     * @param {string} message - Error message
     * @param {string} field - Field that failed validation
     * @param {*} value - Value that was invalid
     */
    constructor(message, field, value = undefined) {
        super(message, 'VALIDATION_ERROR', {field, value});
        this.name = 'ValidationError';
        this.field = field;
        this.value = value;
    }

    toUserMessage() {
        return `Invalid ${this.field}: ${this.message}`;
    }
}

/**
 * Error for color extraction and processing
 */
export class ColorExtractionError extends AetherError {
    /**
     * @param {string} message - Error message
     * @param {string} [imagePath] - Path to image being processed
     * @param {string} [phase] - Phase of extraction that failed
     */
    constructor(message, imagePath = '', phase = 'extraction') {
        super(message, 'COLOR_EXTRACTION_ERROR', {imagePath, phase});
        this.name = 'ColorExtractionError';
        this.imagePath = imagePath;
        this.phase = phase;
    }

    toUserMessage() {
        if (this.phase === 'imagemagick') {
            return 'ImageMagick is required for color extraction. Please ensure it is installed.';
        }
        return 'Could not extract colors from image. Please try a different image.';
    }
}

/**
 * Error for theme application failures
 */
export class ThemeError extends AetherError {
    /**
     * @param {string} message - Error message
     * @param {string} [component] - Component that failed (GTK, Neovim, etc.)
     */
    constructor(message, component = 'theme') {
        super(message, 'THEME_ERROR', {component});
        this.name = 'ThemeError';
        this.component = component;
    }

    toUserMessage() {
        return `Failed to apply ${this.component} theme: ${this.message}`;
    }
}

/**
 * Error for blueprint operations
 */
export class BlueprintError extends AetherError {
    /**
     * @param {string} message - Error message
     * @param {string} [blueprintName] - Name of blueprint
     * @param {string} [operation] - Operation that failed
     */
    constructor(message, blueprintName = '', operation = 'load') {
        super(message, 'BLUEPRINT_ERROR', {blueprintName, operation});
        this.name = 'BlueprintError';
        this.blueprintName = blueprintName;
        this.operation = operation;
    }

    toUserMessage() {
        const operationMessages = {
            load: `Could not load blueprint "${this.blueprintName}"`,
            save: `Could not save blueprint "${this.blueprintName}"`,
            delete: `Could not delete blueprint "${this.blueprintName}"`,
            import: `Could not import blueprint`,
            export: `Could not export blueprint`,
            validate: `Invalid blueprint format`,
        };
        return operationMessages[this.operation] || this.message;
    }
}

// ============================================================================
// Result Pattern
// ============================================================================

/**
 * Result class for operations that can fail
 * Provides a functional way to handle success/failure without exceptions
 *
 * @template T The type of the success value
 * @template E The type of the error (defaults to Error)
 *
 * @example
 * function loadConfig() {
 *     try {
 *         const data = readFile(path);
 *         return Result.ok(JSON.parse(data));
 *     } catch (e) {
 *         return Result.err(new FileError('Failed to load config', path, 'read'));
 *     }
 * }
 *
 * const result = loadConfig();
 * if (result.isOk()) {
 *     console.log(result.value);
 * } else {
 *     showToast(result.error.toUserMessage());
 * }
 */
export class Result {
    /**
     * @param {boolean} success
     * @param {*} value
     * @param {Error} [error]
     */
    constructor(success, value, error = null) {
        this._ok = success;
        this._value = value;
        this._error = error;
    }

    /**
     * Create a successful result
     * @template T
     * @param {T} value - The success value
     * @returns {Result<T>}
     */
    static ok(value) {
        return new Result(true, value, null);
    }

    /**
     * Create a failed result
     * @template E
     * @param {E} error - The error
     * @returns {Result<never, E>}
     */
    static err(error) {
        return new Result(false, null, error);
    }

    /**
     * Check if result is successful
     * @returns {boolean}
     */
    isOk() {
        return this._ok;
    }

    /**
     * Check if result is an error
     * @returns {boolean}
     */
    isErr() {
        return !this._ok;
    }

    /**
     * Get the success value (throws if error)
     * @returns {T}
     */
    get value() {
        if (!this._ok) {
            throw new Error('Cannot get value from error result');
        }
        return this._value;
    }

    /**
     * Get the error (throws if success)
     * @returns {E}
     */
    get error() {
        if (this._ok) {
            throw new Error('Cannot get error from success result');
        }
        return this._error;
    }

    /**
     * Get value or default
     * @template D
     * @param {D} defaultValue
     * @returns {T|D}
     */
    unwrapOr(defaultValue) {
        return this._ok ? this._value : defaultValue;
    }

    /**
     * Map the success value
     * @template U
     * @param {function(T): U} fn
     * @returns {Result<U, E>}
     */
    map(fn) {
        if (this._ok) {
            return Result.ok(fn(this._value));
        }
        return this;
    }

    /**
     * Map the error
     * @template F
     * @param {function(E): F} fn
     * @returns {Result<T, F>}
     */
    mapErr(fn) {
        if (!this._ok) {
            return Result.err(fn(this._error));
        }
        return this;
    }

    /**
     * Chain operations that return Results
     * @template U
     * @param {function(T): Result<U, E>} fn
     * @returns {Result<U, E>}
     */
    andThen(fn) {
        if (this._ok) {
            return fn(this._value);
        }
        return this;
    }
}

// ============================================================================
// Error Logging Utilities
// ============================================================================

/**
 * Log levels for error reporting
 */
export const LogLevel = {
    DEBUG: 'debug',
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error',
};

/**
 * Centralized error logger with context
 * @param {Error} error - The error to log
 * @param {string} [level='error'] - Log level
 * @param {Object} [additionalContext={}] - Additional context
 */
export function logError(error, level = LogLevel.ERROR, additionalContext = {}) {
    const timestamp = new Date().toISOString();
    const context = error instanceof AetherError ? error.context : {};

    const logEntry = {
        timestamp,
        level,
        name: error.name,
        message: error.message,
        code: error.code || 'UNKNOWN',
        context: {...context, ...additionalContext},
        stack: error.stack,
    };

    // Log based on level
    switch (level) {
        case LogLevel.DEBUG:
            console.debug(`[${timestamp}] DEBUG:`, error.message, logEntry.context);
            break;
        case LogLevel.INFO:
            console.info(`[${timestamp}] INFO:`, error.message);
            break;
        case LogLevel.WARN:
            console.warn(`[${timestamp}] WARN:`, error.message, logEntry.context);
            break;
        case LogLevel.ERROR:
        default:
            console.error(`[${timestamp}] ERROR:`, error.message);
            if (error.stack) {
                console.error(error.stack);
            }
            break;
    }
}

/**
 * Wrap a function to automatically catch and log errors
 * @template T
 * @param {function(): T} fn - Function to wrap
 * @param {string} [context=''] - Context description for logging
 * @param {*} [defaultValue=null] - Default value to return on error
 * @returns {T|*}
 */
export function withErrorLogging(fn, context = '', defaultValue = null) {
    try {
        return fn();
    } catch (error) {
        logError(error, LogLevel.ERROR, {context});
        return defaultValue;
    }
}

/**
 * Async version of withErrorLogging
 * @template T
 * @param {function(): Promise<T>} fn - Async function to wrap
 * @param {string} [context=''] - Context description for logging
 * @param {*} [defaultValue=null] - Default value to return on error
 * @returns {Promise<T|*>}
 */
export async function withErrorLoggingAsync(fn, context = '', defaultValue = null) {
    try {
        return await fn();
    } catch (error) {
        logError(error, LogLevel.ERROR, {context});
        return defaultValue;
    }
}

// ============================================================================
// Error Message Helpers
// ============================================================================

/**
 * Get user-friendly message from any error
 * @param {Error} error - The error
 * @returns {string} User-friendly message
 */
export function getUserMessage(error) {
    if (error instanceof AetherError) {
        return error.toUserMessage();
    }

    // Handle common error types
    if (error.message?.includes('ENOENT') || error.message?.includes('not found')) {
        return 'File or resource not found';
    }
    if (error.message?.includes('EACCES') || error.message?.includes('permission')) {
        return 'Permission denied';
    }
    if (error.message?.includes('ECONNREFUSED') || error.message?.includes('network')) {
        return 'Network connection failed';
    }

    // Fallback to generic message
    return 'An unexpected error occurred';
}

/**
 * Check if an error is of a specific type
 * @param {Error} error - The error to check
 * @param {string} code - The error code to check for
 * @returns {boolean}
 */
export function isErrorCode(error, code) {
    return error instanceof AetherError && error.code === code;
}
