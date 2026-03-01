/**
 * Spotify Playlist Service
 * 
 * Handles Spotify playlist operations: creation, updates, track management.
 */

import fetch from 'node-fetch';
import logger from '../../logger.mjs';
import { stripHtml } from '../../utils/text.mjs';

const CHUNK_SIZE = 100; // Spotify API limit per request

/**
 * Make authenticated Spotify API request.
 * @param {string} method - HTTP method
 * @param {string} url - Request URL
 * @param {string} accessToken - Spotify access token
 * @param {Object} body - Request body (optional)
 * @returns {Promise<Object>} Response data
 * @throws {Error} If request fails
 */
async function _spotifyRequest(method, url, accessToken, body = null) {
  const options = {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
    logger.debug('Spotify request body', { body, bodyString: options.body });
  }

  const res = await fetch(url, options);
  if (!res.ok) {
    const error = await res.text();
    logger.warn('Spotify API error', { 
      status: res.status, 
      url, 
      method, 
      error: error.substring(0, 200),
      tokenLength: accessToken ? accessToken.length : 0,
      body: typeof body === 'object' ? JSON.stringify(body) : body
    });
    throw new Error(`Spotify API error (${res.status}): ${error}`);
  }

  return res.json();
}

/**
 * Get current Spotify user ID.
 * @param {string} accessToken - Spotify access token
 * @returns {Promise<string>} User ID
 * @throws {Error} If request fails
 */
export async function getCurrentUserId(accessToken) {
  const data = await _spotifyRequest('GET', 'https://api.spotify.com/v1/me', accessToken);
  return data.id;
}

/**
 * Find playlist by name.
 * @param {string} accessToken - Spotify access token
 * @param {string} name - Playlist name
 * @returns {Promise<Object|null>} Playlist or null
 */
export async function findPlaylistByName(accessToken, name) {
  const userId = await getCurrentUserId(accessToken);
  let url = `https://api.spotify.com/v1/users/${encodeURIComponent(userId)}/playlists?limit=50`;

  while (url) {
    const data = await _spotifyRequest('GET', url, accessToken);
    const found = data.items?.find((p) => p.name === name);
    if (found) return found;
    url = data.next;
  }

  return null;
}

/**
 * Create a new playlist.
 * @param {string} accessToken - Spotify access token
 * @param {string} userId - User ID
 * @param {string} name - Playlist name
 * @param {string} description - Playlist description
 * @returns {Promise<Object>} Created playlist
 */
export async function createPlaylist(accessToken, userId, name, description) {
  return _spotifyRequest(
    'POST',
    `https://api.spotify.com/v1/users/${encodeURIComponent(userId)}/playlists`,
    accessToken,
    { name, description, public: false }
  );
}

/**
 * Get track URIs from playlist.
 * @param {string} accessToken - Spotify access token
 * @param {string} playlistId - Playlist ID
 * @returns {Promise<Set>} Set of track URIs
 */
export async function getPlaylistTrackUris(accessToken, playlistId) {
  const uris = new Set();
  let url = `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks?limit=100`;

  while (url) {
    const data = await _spotifyRequest('GET', url, accessToken);
    for (const item of data.items || []) {
      if (item.track?.uri) uris.add(item.track.uri);
    }
    url = data.next;
  }

  return uris;
}

/**
 * Add tracks to playlist in batches.
 * @param {string} accessToken - Spotify access token
 * @param {string} playlistId - Playlist ID
 * @param {Array<string>} trackUris - Track URIs
 * @returns {Promise<void>}
 */
export async function addTracksToPlaylist(accessToken, playlistId, trackUris) {
  for (let i = 0; i < trackUris.length; i += CHUNK_SIZE) {
    const chunk = trackUris.slice(i, i + CHUNK_SIZE);
    await _spotifyRequest(
      'POST',
      `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks`,
      accessToken,
      { uris: chunk }
    );
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

/**
 * Reorder playlist by date added (newest first).
 * @param {string} accessToken - Spotify access token
 * @param {string} playlistId - Playlist ID
 * @returns {Promise<void>}
 */
export async function reorderPlaylistByDateAdded(accessToken, playlistId) {
  const tracks = [];
  let url = `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks?limit=100&fields=items(track(uri),added_at),next`;

  while (url) {
    const data = await _spotifyRequest('GET', url, accessToken);
    for (const item of data.items || []) {
      if (item.track?.uri) {
        tracks.push({
          uri: item.track.uri,
          added_at: new Date(item.added_at),
        });
      }
    }
    url = data.next;
  }

  if (tracks.length === 0) return;

  tracks.sort((a, b) => b.added_at.getTime() - a.added_at.getTime());

  const trackUris = tracks.map((t) => t.uri);
  const rangeLength = trackUris.length;

  await _spotifyRequest(
    'PUT',
    `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks`,
    accessToken,
    {
      range_start: 0,
      range_length: rangeLength,
      insert_before: rangeLength,
    }
  );
}

/**
 * Search for album on Spotify.
 * @param {string} accessToken - Spotify access token
 * @param {string} album - Album name
 * @param {string} artist - Artist name
 * @returns {Promise<Object|null>} Album or null
 */
export async function searchAlbum(accessToken, album, artist) {
  const cleanAlbum = stripHtml(album).toLowerCase().trim();
  const cleanArtist = stripHtml(artist).toLowerCase().trim();

  // Build search candidates with progressively looser criteria
  const candidates = [
    // 1. Full album + artist
    { album: cleanAlbum, artist: cleanArtist, weight: 1 },
    // 2. Album only
    { album: cleanAlbum, artist: null, weight: 2 },
    // 3. First few words of album + artist
    { album: cleanAlbum.split(/\s+/).slice(0, 3).join(' '), artist: cleanArtist, weight: 3 },
    // 4. First word of album + artist
    { album: cleanAlbum.split(/\s+/)[0], artist: cleanArtist, weight: 4 },
    // 5. Artist search (fallback)
    { album: null, artist: cleanArtist, weight: 5 },
  ];

  for (const { album: a, artist: ar } of candidates) {
    if (!a && !ar) continue; // Skip empty searches
    
    let q = '';
    if (a) q += `album:"${a}"`;
    if (ar) {
      if (q) q += ' ';
      q += `artist:"${ar}"`;
    }

    // Truncate if too long
    if (q.length > 250) {
      if (a) {
        const overflow = q.length - 250;
        const targetLen = Math.max(10, a.length - overflow - 10);
        const reduced = a.substring(0, targetLen);
        q = q.replace(`album:"${a}"`, `album:"${reduced}"`);
      }
      if (q.length > 230) {
        q = q.substring(0, 230);
      }
    }

    const url = `https://api.spotify.com/v1/search?type=album&limit=10&q=${encodeURIComponent(q)}`;
    try {
      const data = await _spotifyRequest('GET', url, accessToken);
      if (data.albums?.items?.length > 0) {
        // For full searches, look for exact match
        if (a && ar) {
          const exact = data.albums.items.find((album) =>
            album.name?.toLowerCase().includes(cleanAlbum.toLowerCase()) &&
            album.artists?.some((artist) => artist.name?.toLowerCase().includes(cleanArtist.toLowerCase()))
          );
          if (exact) return exact;
        }
        
        // Otherwise return first result
        return data.albums.items[0];
      }
    } catch (e) {
      if (!/maximum length of 250/i.test(String(e?.message))) {
        logger.warn('Album search failed', { album: a, artist: ar, error: e.message });
      }
      continue;
    }
  }

  return null;
}

/**
 * Get first track URI from album.
 * @param {string} accessToken - Spotify access token
 * @param {string} albumId - Album ID
 * @returns {Promise<string|null>} Track URI or null
 */
export async function getAlbumFirstTrackUri(accessToken, albumId) {
  const url = `https://api.spotify.com/v1/albums/${encodeURIComponent(albumId)}/tracks?limit=50`;
  const data = await _spotifyRequest('GET', url, accessToken);
  return data.items?.[0]?.uri || null;
}
