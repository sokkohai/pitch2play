/**
 * Text processing utilities.
 * Functions for HTML stripping, encoding, and text normalization.
 */

/**
 * Decodes Quoted-Printable encoded text (used in MIME email bodies).
 * Handles sequences like =E2=80=9C (UTF-8) and =\n (soft line breaks).
 * @param {string} text - Quoted-Printable encoded text
 * @returns {string} Decoded text
 */
export function decodeQuotedPrintable(text) {
  if (!text) return '';

  // Remove soft line breaks (=\n)
  let decoded = text.replace(/=\r?\n/g, '');

  // Decode hex sequences (=HH) as UTF-8 bytes
  const bytes = [];
  for (let i = 0; i < decoded.length; i++) {
    if (decoded[i] === '=' && i + 2 < decoded.length) {
      const hex = decoded.substring(i + 1, i + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(parseInt(hex, 16));
        i += 2;
        continue;
      }
    }
    bytes.push(decoded.charCodeAt(i));
  }

  // Convert bytes to UTF-8 string
  return Buffer.from(bytes).toString('utf8');
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

/**
 * Strips HTML tags from a string.
 * @param {string} str - String with HTML
 * @returns {string} Plain text string
 */
export function stripHtml(str) {
  if (!str) return '';
  return str.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').trim();
}
