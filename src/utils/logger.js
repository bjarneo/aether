/**
 * Logger - Centralized logging utility with log levels
 *
 * Provides structured logging with levels: debug, info, warn, error
 * Can be configured to filter by level and add timestamps
 *
 * Usage:
 * ```javascript
 * import { log } from './utils/logger.js';
 *
 * log.debug('Processing colors', { count: 16 });
 * log.info('Theme applied successfully');
 * log.warn('No wallpaper found, using default');
 * log.error('Failed to load blueprint', error);
 * ```
 *
 * @module logger
 */

/** Log levels enum */
const LogLevel = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    NONE: 4,
};

/** Current minimum log level (can be changed at runtime) */
let currentLevel = LogLevel.INFO;

/** Whether to include timestamps in log output */
let includeTimestamp = false;

/** Whether to include the component/source name */
let includeSource = true;

/**
 * Formats a log message with optional metadata
 * @param {string} level - Log level string
 * @param {string} message - Main log message
 * @param {string} [source] - Optional source/component name
 * @param {Object} [data] - Optional data to include
 * @returns {string} Formatted log message
 */
function formatMessage(level, message, source, data) {
    const parts = [];

    if (includeTimestamp) {
        const now = new Date();
        parts.push(`[${now.toISOString()}]`);
    }

    parts.push(`[${level}]`);

    if (includeSource && source) {
        parts.push(`[${source}]`);
    }

    parts.push(message);

    if (data !== undefined) {
        if (data instanceof Error) {
            parts.push(`- ${data.message}`);
            if (data.stack) {
                parts.push(`\n${data.stack}`);
            }
        } else if (typeof data === 'object') {
            try {
                parts.push(`- ${JSON.stringify(data)}`);
            } catch (e) {
                parts.push(`- [Object]`);
            }
        } else {
            parts.push(`- ${data}`);
        }
    }

    return parts.join(' ');
}

/**
 * Main logger object with level methods
 */
export const log = {
    /**
     * Log a debug message (for development/troubleshooting)
     * @param {string} message - Log message
     * @param {Object} [data] - Optional data
     * @param {string} [source] - Optional source name
     */
    debug(message, data, source) {
        if (currentLevel <= LogLevel.DEBUG) {
            console.log(formatMessage('DEBUG', message, source, data));
        }
    },

    /**
     * Log an info message (normal operation)
     * @param {string} message - Log message
     * @param {Object} [data] - Optional data
     * @param {string} [source] - Optional source name
     */
    info(message, data, source) {
        if (currentLevel <= LogLevel.INFO) {
            console.log(formatMessage('INFO', message, source, data));
        }
    },

    /**
     * Log a warning message (something unexpected but recoverable)
     * @param {string} message - Log message
     * @param {Object} [data] - Optional data
     * @param {string} [source] - Optional source name
     */
    warn(message, data, source) {
        if (currentLevel <= LogLevel.WARN) {
            console.warn(formatMessage('WARN', message, source, data));
        }
    },

    /**
     * Log an error message (operation failed)
     * @param {string} message - Log message
     * @param {Error|Object} [error] - Error object or data
     * @param {string} [source] - Optional source name
     */
    error(message, error, source) {
        if (currentLevel <= LogLevel.ERROR) {
            console.error(formatMessage('ERROR', message, source, error));
        }
    },

    /**
     * Set the minimum log level
     * @param {'debug'|'info'|'warn'|'error'|'none'} level - Level name
     */
    setLevel(level) {
        const levelMap = {
            debug: LogLevel.DEBUG,
            info: LogLevel.INFO,
            warn: LogLevel.WARN,
            error: LogLevel.ERROR,
            none: LogLevel.NONE,
        };
        currentLevel = levelMap[level] ?? LogLevel.INFO;
    },

    /**
     * Enable or disable timestamps
     * @param {boolean} enabled
     */
    setTimestamp(enabled) {
        includeTimestamp = enabled;
    },

    /**
     * Enable or disable source names
     * @param {boolean} enabled
     */
    setSource(enabled) {
        includeSource = enabled;
    },

    /** Log level constants */
    Level: LogLevel,
};

/**
 * Creates a scoped logger with a fixed source name
 * @param {string} source - The source/component name
 * @returns {Object} Logger with debug, info, warn, error methods
 *
 * @example
 * const log = createLogger('ColorExtraction');
 * log.info('Starting extraction');
 * log.error('Failed to load image', error);
 */
export function createLogger(source) {
    return {
        debug: (message, data) => log.debug(message, data, source),
        info: (message, data) => log.info(message, data, source),
        warn: (message, data) => log.warn(message, data, source),
        error: (message, error) => log.error(message, error, source),
    };
}
