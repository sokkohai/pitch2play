/**
 * Text processing utilities.
 * Functions for HTML stripping, encoding, and text normalization.
 */

/**
 * Strips HTML tags from a string and decodes HTML entities.
 * @param {string} input - HTML string
 * @returns {string} Plain text
 */
export function stripHtml(input) {
  if (!input) return '';

  let text = input;

  // Remove style and script blocks
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<script[\s\S]*?<\/script>/gi, '');

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode HTML entities
  text = decodeHtmlEntities(text);

  // Normalize whitespace
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Decodes common HTML entities.
 * @param {string} text - Text with HTML entities
 * @returns {string} Decoded text
 */
export function decodeHtmlEntities(text) {
  const entities = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&quot;': '"',
    '&#39;': "'",
    '&lt;': '<',
    '&gt;': '>',
  };

  let result = text;
  for (const [entity, char] of Object.entries(entities)) {
    result = result.replaceAll(entity, char);
  }

  return result;
}

/**
 * Decodes RFC 2047 encoded-words (MIME header encoding).
 * Handles both Base64 (B) and Quoted-Printable (Q) encodings.
 * @param {string} str - MIME encoded string
 * @returns {string} Decoded string
 */
export function decodeMimeEncodedWords(str) {
  if (!str) return '';

  return str.replace(/=\?([^?]+)\?([QqBb])\?([^?]+)\?=/g, (match, charset, enc, text) => {
    try {
      const encoding = String(enc).toUpperCase();

      if (encoding === 'B') {
        // Base64 encoding
        const buf = Buffer.from(text, 'base64');
        return buf.toString('utf8');
      }

      // Quoted-Printable encoding: "_" = Space, =HH = hex byte
      const decoded = text
        .replace(/_/g, ' ')
        .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

      return decoded;
    } catch (_) {
      // If decoding fails, return original text
      return text;
    }
  });
}

/**
 * Normalizes a string by trimming and lowercasing.
 * @param {string} str - String to normalize
 * @returns {string} Normalized string
 */
export function normalize(str) {
  return str.trim().toLowerCase();
}

/**
 * Truncates a string to a maximum length.
 * @param {string} str - String to truncate
 * @param {number} maxLength - Maximum length
 * @param {string} [suffix='...'] - Suffix to add if truncated
 * @returns {string} Truncated string
 */
export function truncate(str, maxLength, suffix = '...') {
  if (str.length <= maxLength) {
    return str;
  }

  return str.slice(0, maxLength - suffix.length) + suffix;
}
