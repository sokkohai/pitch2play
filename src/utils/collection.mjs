/**
 * Collection utility functions.
 * Functions for working with arrays and sets.
 */

/**
 * Deduplicates an array based on a key function.
 * @param {Array} array - Array to deduplicate
 * @param {Function} keyFn - Function that extracts the key from each item
 * @returns {Array} Deduplicated array (preserves order)
 */
export function uniqueBy(array, keyFn) {
  const seen = new Set();
  const result = [];

  for (const item of array) {
    const key = keyFn(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }

  return result;
}

/**
 * Removes duplicate values from an array.
 * @param {Array} array - Array to deduplicate
 * @returns {Array} Array with unique values
 */
export function unique(array) {
  return [...new Set(array)];
}

/**
 * Groups array items by a key function.
 * @param {Array} array - Array to group
 * @param {Function} keyFn - Function that extracts the grouping key
 * @returns {Map} Map of key -> array of items
 */
export function groupBy(array, keyFn) {
  const map = new Map();

  for (const item of array) {
    const key = keyFn(item);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(item);
  }

  return map;
}

/**
 * Chunks an array into smaller arrays of a given size.
 * @param {Array} array - Array to chunk
 * @param {number} size - Chunk size
 * @returns {Array<Array>} Array of chunks
 */
export function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Flattens an array by one level.
 * @param {Array} array - Array to flatten
 * @returns {Array} Flattened array
 */
export function flatten(array) {
  return array.reduce((acc, val) => acc.concat(val), []);
}

/**
 * Checks if all items in an array match a predicate.
 * @param {Array} array - Array to check
 * @param {Function} predicate - Test function
 * @returns {boolean} True if all items match
 */
export function all(array, predicate) {
  return array.every(predicate);
}

/**
 * Checks if any item in an array matches a predicate.
 * @param {Array} array - Array to check
 * @param {Function} predicate - Test function
 * @returns {boolean} True if any item matches
 */
export function any(array, predicate) {
  return array.some(predicate);
}
