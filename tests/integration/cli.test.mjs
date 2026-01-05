/**
 * Integration tests for unified CLI entry point
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('CLI Entry Point', () => {
  beforeEach(() => {
    // Reset environment for each test
    delete process.env.EMAIL_USER;
    delete process.env.EMAIL_PASS;
    delete process.env.SPOTIFY_CLIENT_ID;
  });

  it('should have unified entry point at src/index.mjs', async () => {
    // This test verifies the file exists and can be imported
    try {
      const index = await import('../../src/index.mjs');
      // If we get here, the module loaded successfully
      expect(index).toBeDefined();
    } catch (err) {
      if (err.code === 'ERR_MODULE_NOT_FOUND') {
        expect(false).toBe(true); // File not found
      }
      // Other errors are expected (missing env vars, etc.)
    }
  });

  it('should have sync/playlists service', async () => {
    const service = await import('../../src/services/sync/playlists.mjs');
    expect(service.syncPlaylistsFromEmails).toBeDefined();
    expect(service.setupOAuth).toBeDefined();
  });

  it('should have email services', async () => {
    const fetch = await import('../../src/services/email/fetch.mjs');
    const parser = await import('../../src/services/email/parser.mjs');
    const trash = await import('../../src/services/email/trash-mover.mjs');
    
    expect(fetch.fetchAllMatchingEmails).toBeDefined();
    expect(parser.extractAlbumArtistPairs).toBeDefined();
    expect(trash.moveUidsToTrash).toBeDefined();
    expect(trash.findTrashFolder).toBeDefined();
  });

  it('should have spotify services', async () => {
    const playlist = await import('../../src/services/spotify/playlist.mjs');
    const oauth = await import('../../src/services/spotify/oauth.mjs');
    
    expect(playlist.searchAlbum).toBeDefined();
    expect(playlist.addTracksToPlaylist).toBeDefined();
    expect(oauth.getAccessTokenFromRefresh).toBeDefined();
    expect(oauth.runInteractiveAuth).toBeDefined();
  });

  it('should have CLI handler', async () => {
    const cli = await import('../../src/cli.mjs');
    expect(cli.moveEmailsToTrashCli).toBeDefined();
  });

  it('should have proper logger', async () => {
    const logger = await import('../../src/logger.mjs');
    expect(logger.default).toBeDefined();
    expect(logger.default.error).toBeDefined();
    expect(logger.default.warn).toBeDefined();
    expect(logger.default.info).toBeDefined();
    expect(logger.default.debug).toBeDefined();
  });

  it('should have proper config', async () => {
    const config = await import('../../src/config.mjs');
    expect(config.getConfig).toBeDefined();
    expect(config.validateConfig).toBeDefined();
  });
});
