/**
 * Structured logging for pitch2play.
 * All application logging should use this module.
 */

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

let currentLevel = LOG_LEVELS[process.env.LOG_LEVEL || 'info'];

/**
 * Logs an error message with optional context.
 * @param {string} message - The error message
 * @param {Object} [context={}] - Additional context data
 */
export function error(message, context = {}) {
  if (LOG_LEVELS.error <= currentLevel) {
    console.error(`[ERROR] ${message}`, context);
  }
}

/**
 * Logs a warning message with optional context.
 * @param {string} message - The warning message
 * @param {Object} [context={}] - Additional context data
 */
export function warn(message, context = {}) {
  if (LOG_LEVELS.warn <= currentLevel) {
    console.warn(`[WARN] ${message}`, context);
  }
}

/**
 * Logs an info message with optional context.
 * @param {string} message - The info message
 * @param {Object} [context={}] - Additional context data
 */
export function info(message, context = {}) {
  if (LOG_LEVELS.info <= currentLevel) {
    console.log(`[INFO] ${message}`, context);
  }
}

/**
 * Logs a debug message with optional context.
 * @param {string} message - The debug message
 * @param {Object} [context={}] - Additional context data
 */
export function debug(message, context = {}) {
  if (LOG_LEVELS.debug <= currentLevel) {
    console.debug(`[DEBUG] ${message}`, context);
  }
}

/**
 * Sets the logging level.
 * @param {string} level - One of: 'error', 'warn', 'info', 'debug'
 */
export function setLevel(level) {
  if (!(level in LOG_LEVELS)) {
    throw new Error(`Invalid log level: ${level}`);
  }
  currentLevel = LOG_LEVELS[level];
}

export default {
  error,
  warn,
  info,
  debug,
  setLevel,
};
