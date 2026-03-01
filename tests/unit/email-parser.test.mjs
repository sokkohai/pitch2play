/**
 * Unit tests for email parser service
 */

import { describe, it, expect } from 'vitest';
import { extractAlbumArtistPairs } from '../../src/services/email/parser.mjs';

describe('spotify-playlist-creator', () => {
  describe('extractAlbumArtistPairs', () => {
    it('should extract album-artist pairs from HTML', () => {
      const html = `
        <table class="text_block block-2">
          <tr><td>
            <p><strong><a rel="noopener">The Beatles</a></strong></p>
            <p><em>Abbey Road</em></p>
          </td></tr>
        </table>
      `;

      const pairs = extractAlbumArtistPairs(html);
      expect(pairs.length).toBeGreaterThan(0);
      expect(pairs[0]).toMatchObject({
        artist: expect.any(String),
        album: expect.any(String),
      });
    });

    it('should handle empty HTML gracefully', () => {
      const pairs = extractAlbumArtistPairs('<html></html>');
      expect(Array.isArray(pairs)).toBe(true);
      expect(pairs.length).toBe(0);
    });

    it('should deduplicate pairs', () => {
      const html = `
        <strong><a>Artist</a></strong>
        <em>Album</em>
        <strong><a>Artist</a></strong>
        <em>Album</em>
      `;

      const pairs = extractAlbumArtistPairs(html);
      const dedupCount = pairs.filter((p) => p.artist === 'Artist' && p.album === 'Album').length;
      expect(dedupCount).toBeLessThanOrEqual(1);
    });

    it('should reject pairs with short names', () => {
      const html = `
        <strong><a>A</a></strong>
        <em>B</em>
      `;

      const pairs = extractAlbumArtistPairs(html);
      expect(pairs.length).toBe(0);
    });

    it('should extract up to 10 pairs', () => {
      let html = '';
      for (let i = 0; i < 15; i++) {
        html += `
          <table class="text_block block-2">
            <tr><td>
              <p><strong><a rel="noopener">Artist ${i}</a></strong></p>
              <p><em>Album ${i}</em></p>
            </td></tr>
          </table>
        `;
      }

      const pairs = extractAlbumArtistPairs(html);
      expect(pairs.length).toBeLessThanOrEqual(10);
    });
  });
});
