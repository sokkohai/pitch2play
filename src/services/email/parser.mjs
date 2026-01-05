/**
 * Email Parser Service
 * 
 * Parses HTML email content to extract album and artist information.
 */

import { load as loadHtml } from 'cheerio';
import logger from '../../logger.mjs';

/**
 * Extract album-artist pairs from email body.
 * @param {string} rawBody - HTML email body
 * @returns {Array} Array of { artist, album } pairs
 */
export function extractAlbumArtistPairs(rawBody) {
  const pairs = [];

  const addPair = (artist, album) => {
    const a = (artist || '').trim();
    const b = (album || '').trim();
    if (!a || !b || a.length < 2 || b.length < 2) return;
    const key = `${a.toLowerCase()}::${b.toLowerCase()}`;
    if (!pairs.some((p) => `${p.artist.toLowerCase()}::${p.album.toLowerCase()}` === key)) {
      pairs.push({ artist: a, album: b });
    }
  };

  try {
    const $ = loadHtml(rawBody, { decodeEntities: true });

    // Primary: Card-specific parsing
    $('table.text_block.block-2').each((_, block) => {
      if (pairs.length >= 10) return;
      const root = $(block);

      const artistLink = root.find('p strong a[rel="noopener"]').first();
      const artist = (artistLink.text() || '').trim() || (root.find('strong a').first().text() || '').trim();

      let album = '';
      if (artistLink.length) {
        const artistP = artistLink.closest('p');
        if (artistP && artistP.length) {
          const nextEm = artistP.nextAll('p').find('em').first();
          if (nextEm && nextEm.length) album = (nextEm.text() || '').trim();
        }
      }
      if (!album) {
        album = (root.find('em').first().text() || '').trim();
      }

      addPair(artist, album);
    });

    if (pairs.length < 10) {
      // Secondary: generic approach
      const _findNearestEm = (startEl) => {
        const container = $(startEl).closest('table, td, div');
        let em = container.find('em').first();
        if (em && em.length) {
          const text = em.text().trim();
          if (text) return text;
        }
        let next = container.next();
        for (let i = 0; i < 4 && next && next.length; i++) {
          em = next.find('em').first();
          if (em && em.length) {
            const text = em.text().trim();
            if (text) return text;
          }
          next = next.next();
        }
        return '';
      };

      $('strong a').each((_, el) => {
        if (pairs.length >= 10) return;
        const artist = $(el).text().trim();
        const album = _findNearestEm(el);
        addPair(artist, album);
      });
    }

    // Image metadata
    if (pairs.length < 10) {
      const pat = /^(.{2,80})\s*[:–-]\s*(.{2,140})$/;
      $('img[alt], img[title]').each((_, img) => {
        if (pairs.length >= 10) return;
        const alt = ($(img).attr('alt') || '').trim();
        const title = ($(img).attr('title') || '').trim();
        const candidates = [alt, title].filter(Boolean);
        for (const txt of candidates) {
          const m = txt.match(pat);
          if (m) {
            addPair(m[1], m[2]);
            if (pairs.length >= 10) break;
          }
        }
      });
    }
  } catch (err) {
    logger.warn('Failed to extract album-artist pairs', { error: err.message });
  }

  return pairs;
}
