/**
 * Playlist Sync Service
 * 
 * Orchestrates Pitchfork email → Spotify playlist creation workflow.
 */

import logger from '../../logger.mjs';
import { fetchAllMatchingEmails, moveEmailToTrash } from '../email/fetch.mjs';
import { extractAlbumArtistPairs } from '../email/parser.mjs';
import {
  getCurrentUserId,
  findPlaylistByName,
  createPlaylist,
  getPlaylistTrackUris,
  searchAlbum,
  getAlbumFirstTrackUri,
  addTracksToPlaylist,
  reorderPlaylistByDateAdded,
} from '../spotify/playlist.mjs';
import { getAccessTokenFromRefresh, loadRefreshToken, runInteractiveAuth } from '../spotify/oauth.mjs';
import { formatMonthYYYYMM, uniqueBy } from '../../utils/index.mjs';

const PLAYLIST_PREFIX = 'Pitchfork Best Albums';
const REPO_URL = 'https://github.com/sokkohai/pitch2play';

/**
 * Create Spotify playlists from Pitchfork emails.
 * @returns {Promise<void>}
 * @throws {Error} If workflow fails
 */
export async function syncPlaylistsFromEmails() {
  try {
    logger.info('Validating configuration...');
    const required = ['EMAIL_USER', 'EMAIL_PASS', 'SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET', 'SPOTIFY_REDIRECT_URI'];
    const missing = required.filter((k) => !process.env[k]);
    if (missing.length > 0) {
      throw new Error(`Missing required env vars: ${missing.join(', ')}`);
    }

    const refreshToken = loadRefreshToken();
    if (!refreshToken) {
      throw new Error('No SPOTIFY_REFRESH_TOKEN found. Run `npm run auth` first.');
    }

    logger.info('Fetching Pitchfork emails...');
    const emails = await fetchAllMatchingEmails();

    if (!emails || emails.length === 0) {
      logger.info('No matching emails found');
      return;
    }

    logger.info('Processing emails', { count: emails.length });

    const monthToPairs = new Map();
    const successfulEmailUids = new Set();

    for (const mail of emails) {
      if (!String(mail.from).toLowerCase().includes('newsletter@pitchfork.com')) {
        continue;
      }

      const rawPairs = extractAlbumArtistPairs(mail.body);
      const pairs = uniqueBy(rawPairs, (p) => `${p.artist.toLowerCase()}::${p.album.toLowerCase()}`);

      if (!pairs || pairs.length === 0) {
        logger.warn('Email has no album-artist pairs', { uid: mail.uid });
        continue;
      }

      const emailDate = new Date(mail.date);
      const monthStr = formatMonthYYYYMM(emailDate);
      const existing = monthToPairs.get(monthStr) || [];
      monthToPairs.set(monthStr, existing.concat(pairs));

      if (Number.isInteger(mail.uid)) {
        successfulEmailUids.add(mail.uid);
      }
    }

    if (monthToPairs.size === 0) {
      logger.info('No usable emails with album-artist pairs');
      return;
    }

    const accessToken = await getAccessTokenFromRefresh(refreshToken);

    for (const [monthStr, rawPairs] of monthToPairs.entries()) {
      const pairs = uniqueBy(rawPairs, (p) => `${p.artist.toLowerCase()}::${p.album.toLowerCase()}`);
      if (pairs.length === 0) continue;

      const playlistName = `${PLAYLIST_PREFIX} ${monthStr}`;
      const userId = await getCurrentUserId(accessToken);
      let playlist = await findPlaylistByName(accessToken, playlistName);

      if (!playlist) {
        const description = `Pitchfork's Best Reviewed Albums of ${monthStr}\n\n${REPO_URL}`;
        playlist = await createPlaylist(accessToken, userId, playlistName, description);
        logger.info('Playlist created', { name: playlist.name });
      } else {
        logger.info('Playlist found', { name: playlist.name });
      }

      const existingUris = await getPlaylistTrackUris(accessToken, playlist.id);

      const toAdd = [];
      for (const { album, artist } of pairs) {
        try {
          const foundAlbum = await searchAlbum(accessToken, album, artist);
          if (!foundAlbum) {
            logger.warn('No album found', { artist, album });
            continue;
          }

          const firstTrackUri = await getAlbumFirstTrackUri(accessToken, foundAlbum.id);
          if (!firstTrackUri) {
            logger.warn('No first track found', { album: foundAlbum.name });
            continue;
          }

          if (!existingUris.has(firstTrackUri) && !toAdd.includes(firstTrackUri)) {
            toAdd.push(firstTrackUri);
          }

          await new Promise((resolve) => setTimeout(resolve, 200));
        } catch (e) {
          logger.warn('Error processing album', { artist, album, error: e.message });
        }
      }

      if (toAdd.length > 0) {
        await addTracksToPlaylist(accessToken, playlist.id, toAdd);
        logger.info('Tracks added to playlist', { playlist: playlist.name, count: toAdd.length });

        await reorderPlaylistByDateAdded(accessToken, playlist.id);
        logger.info('Playlist reordered', { playlist: playlist.name });
      } else {
        logger.info('No new tracks to add', { playlist: playlist.name });
      }
    }

    // Move processed emails to trash
    for (const uid of successfulEmailUids) {
      try {
        await moveEmailToTrash(uid);
        logger.info('Email moved to trash', { uid });
      } catch (e) {
        logger.warn('Could not move email to trash', { uid, error: e.message });
      }
    }

    logger.info('Playlist sync completed successfully');
  } catch (err) {
    logger.error('Playlist sync failed', { error: err.message });
    throw err;
  }
}

/**
 * Run OAuth setup.
 * @returns {Promise<void>}
 */
export async function setupOAuth() {
  try {
    logger.info('Starting OAuth setup...');
    await runInteractiveAuth();
  } catch (err) {
    logger.error('OAuth setup failed', { error: err.message });
    throw err;
  }
}
