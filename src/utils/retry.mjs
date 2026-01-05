/**
 * Retry and backoff utilities.
 * Functions for handling transient failures with exponential backoff.
 */

import logger from '../logger.mjs';

/**
 * Sleeps for a given number of milliseconds.
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>} Resolves after the delay
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calls a function with automatic retry and exponential backoff.
 * @param {Function} fn - Async function to call
 * @param {number} [maxRetries=3] - Maximum number of retries
 * @param {number} [baseDelayMs=1000] - Base delay in milliseconds
 * @returns {Promise<*>} Result of the function
 * @throws {Error} If all retries fail
 */
export async function callWithRetry(fn, maxRetries = 3, baseDelayMs = 1000) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) {
        logger.error(`All ${maxRetries} retry attempts failed`, {
          error: error.message,
        });
        throw error;
      }

      const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
      logger.warn(`Attempt ${attempt} failed, retrying in ${delayMs}ms`, {
        error: error.message,
      });

      await sleep(delayMs);
    }
  }

  throw lastError;
}

/**
 * Calls a function with a timeout.
 * @param {Function} fn - Async function to call
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<*>} Result of the function
 * @throws {Error} If the function times out
 */
export async function callWithTimeout(fn, timeoutMs) {
  return Promise.race([
    fn(),
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`Operation timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
    ),
  ]);
}
