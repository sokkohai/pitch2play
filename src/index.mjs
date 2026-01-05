#!/usr/bin/env node
/**
 * CLI Entry Point
 * 
 * Main entry point for all operations:
 * - Pitchfork to Spotify playlist creation (default)
 * - Email trash mover (trash-move)
 * - Spotify OAuth setup (auth)
 * 
 * Usage:
 *   npm start                    - Create Spotify playlists
 *   npm run auth                 - Set up Spotify OAuth
 *   npm run trash-move -- [...args]  - Move emails to trash
 */

import 'dotenv/config';
import logger from './logger.mjs';
import { syncPlaylistsFromEmails, setupOAuth } from './services/sync/playlists.mjs';
import { moveEmailsToTrashCli } from './cli.mjs';

const command = process.argv[2];
const args = process.argv.slice(3);

async function main() {
  try {
    if (command === '--auth' || command === 'auth') {
      logger.info('Starting Spotify OAuth authentication');
      await setupOAuth();
    } else if (command === 'trash-move' || command === 'move-trash') {
      logger.info('Moving emails to trash', { argsCount: args.length });
      await moveEmailsToTrashCli(args);
    } else {
      // Default: sync playlists
      logger.info('Creating Spotify playlists from Pitchfork emails');
      await syncPlaylistsFromEmails();
    }
  } catch (err) {
    logger.error('Fatal error', { error: err.message });
    process.exit(1);
  }
}

main();
