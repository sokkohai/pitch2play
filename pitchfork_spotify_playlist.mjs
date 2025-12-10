/**
 * Pitchfork Newsletter to Spotify Playlist
 * 
 * Automatically creates Spotify playlists from Pitchfork's "10 Best Reviewed Albums of the Week" newsletter emails.
 * 
 * Features:
 * - Fetches emails via IMAP (tested with iCloud)
 * - Parses HTML email content to extract album and artist information
 * - Searches Spotify for albums using multiple strategies
 * - Creates monthly playlists with discovered albums
 * - Handles duplicates and error recovery
 * 
 * Usage:
 * - npm start: Run the playlist creator
 * - npm run auth: Set up Spotify OAuth (one-time setup)
 * 
 * @author Sokkohai
 * @version 1.0.0
 * @license MIT
 */

import 'dotenv/config';
import Imap from 'node-imap';
import fetch from 'node-fetch';
import { AuthorizationCode } from 'simple-oauth2';
import http from 'http';
import { URL } from 'url';
import fs from 'fs';
import path from 'path';
import { load as loadHtml } from 'cheerio';

// =============================
// Load configuration from .env
// =============================
const {
  EMAIL_USER,
  EMAIL_PASS,
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
  SPOTIFY_REDIRECT_URI,
  SPOTIFY_REFRESH_TOKEN,
} = process.env;

// Expected email filters
const EXPECTED_FROM = 'newsletter@pitchfork.com';
const EXPECTED_SUBJECT = '10 Best Reviewed Albums of the Week';

// Playlist naming schema
const PLAYLIST_PREFIX = 'Pitchfork Best Albums';

// Scopes: Read/Create/Modify playlists
const SPOTIFY_SCOPES = [
  'playlist-read-private',
  'playlist-modify-private',
  'playlist-modify-public',
];

// Path for optional token storage (if generated during auth flow)
const TOKEN_STORE_PATH = path.resolve(process.cwd(), 'spotify_token.json');

const IMAP_MAILBOX = process.env.IMAP_MAILBOX || 'INBOX';

// =============================
// Helper functions
// =============================
function assertEnv(...vars) {
  const missing = vars.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripHtml(input) {
  if (!input) return '';
  let text = input.replace(/<style[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<[^>]+>/g, ' ');
  // Decode simple HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
  // Normalize multiple spaces
  return text.replace(/\s+/g, ' ').trim();
}

function decodeMimeEncodedWords(str) {
  if (!str) return '';
  return str.replace(/=\?([^?]+)\?([QqBb])\?([^?]+)\?=/g, (match, charset, enc, text) => {
    try {
      const encoding = String(enc).toUpperCase();
      if (encoding === 'B') {
        const buf = Buffer.from(text, 'base64');
        return buf.toString('utf8');
      }
      // Q-Encoded: "_" = Space, =HH Hex
      const replaced = text
        .replace(/_/g, ' ')
        .replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
      return replaced;
    } catch (_) {
      return text;
    }
  });
}

function getLastSunday(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  const diff = day; // Days since last Sunday
  const sunday = new Date(d);
  sunday.setHours(0, 0, 0, 0);
  sunday.setDate(sunday.getDate() - diff);
  return sunday;
}

function formatDateYYYYMMDD(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatMonthYYYYMM(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

function uniqueBy(array, keyFn) {
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

// =============================
// IMAP: Fetch all matching emails and move support
// =============================
function openImapConnection() {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: EMAIL_USER,
      password: EMAIL_PASS,
      host: 'imap.mail.me.com',
      port: 993,
      tls: true,
      autotls: 'required',
    });

    imap.once('ready', () => resolve(imap));
    imap.once('error', (err) => reject(err));
    imap.connect();
  });
}

async function fetchAllMatchingEmails() {
  const imap = await openImapConnection();
  try {
    await new Promise((resolve, reject) => {
      imap.openBox(IMAP_MAILBOX, false, (err) => (err ? reject(err) : resolve()))
    });

    const criteria = [
      'ALL',
      ['FROM', EXPECTED_FROM],
      ['SUBJECT', EXPECTED_SUBJECT],
    ];

    const uids = await new Promise((resolve, reject) => {
      imap.search(criteria, (err, results) => (err ? reject(err) : resolve(results || [])));
    });

    if (!uids || uids.length === 0) {
      imap.end();
      return [];
    }

    // Fetch emails in UID order (old → new)
    uids.sort((a, b) => a - b);

    const emails = [];

    // Fetch in batches to process large mailboxes more robustly
    const batchSize = 20;
    for (let i = 0; i < uids.length; i += batchSize) {
      const batch = uids.slice(i, i + batchSize);
      await new Promise((resolve, reject) => {
        const f = imap.fetch(batch, {
          bodies: ['HEADER.FIELDS (DATE SUBJECT FROM)', 'TEXT'],
          struct: true,
          uid: true,
        });

        const messages = []; // sammelt pro Nachricht

        f.on('message', (msg) => {
          const agg = { uid: null, headers: '', body: '' };

          msg.on('attributes', (attrs) => {
            agg.uid = attrs && attrs.uid ? attrs.uid : agg.uid;
          });

          msg.on('body', (stream, info) => {
            const chunks = [];
            stream.on('data', (chunk) => chunks.push(chunk));
            stream.on('end', () => {
              const buffer = Buffer.concat(chunks).toString('utf8');
              if (info.which && String(info.which).toUpperCase().includes('HEADER')) {
                agg.headers += buffer;
              } else {
                agg.body += buffer;
              }
            });
          });

          msg.once('end', () => {
            messages.push(agg);
          });
        });

        f.once('error', (err) => reject(err));
        f.once('end', () => {
          for (const { uid, headers, body } of messages) {
            // only accept with valid UID
            const validUid = Number.isInteger(uid) ? uid : (typeof uid === 'number' && !isNaN(uid) ? Math.trunc(uid) : null);

            const dateMatch = headers.match(/^Date:\s*(.*)$/im);
            const fromMatch = headers.match(/^From:\s*(.*)$/im);
            const subjectMatch = headers.match(/^Subject:\s*(.*)$/im);

            const date = dateMatch ? new Date(dateMatch[1]) : new Date();
            const from = decodeMimeEncodedWords(fromMatch ? fromMatch[1] : '');
            const subject = decodeMimeEncodedWords(subjectMatch ? subjectMatch[1] : '');

            emails.push({ uid: validUid, date, from, subject, body });
          }
          resolve();
        });
      });
    }

    imap.end();
    return emails;
  } catch (err) {
    imap.end();
    throw err;
  }
}

const TRASH_MAILBOX = process.env.TRASH_MAILBOX || 'Deleted Messages';

async function moveEmailToTrash(uid) {
  if (!Number.isInteger(uid) || uid <= 0) {
    throw new Error(`Invalid UID: ${uid}`);
  }
  const imap = await openImapConnection();
  try {
    await new Promise((resolve, reject) => {
      imap.openBox(IMAP_MAILBOX, false, (err) => (err ? reject(err) : resolve()))
    });

    await new Promise((resolve, reject) => {
      imap.move([uid], TRASH_MAILBOX, (err) => (err ? reject(err) : resolve()))
    });
    imap.end();
    return true;
  } catch (err) {
    // Fallback: Versuch in 'Trash'
    try {
      await new Promise((resolve, reject) => {
        imap.openBox(IMAP_MAILBOX, false, (err) => (err ? reject(err) : resolve()))
      });
      await new Promise((resolve, reject) => {
        imap.move([uid], 'Trash', (err) => (err ? reject(err) : resolve()))
      });
      imap.end();
      return true;
    } catch (e2) {
      try { imap.end(); } catch {}
      throw e2;
    }
  }
}

// =============================
// Parsing: Album/Artist aus Text extrahieren
// =============================
function extractAlbumArtistPairs(rawBody) {
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

  // 1) Structure-based parsing with Cheerio – over the entire HTML
  try {
    const $ = loadHtml(rawBody, { decodeEntities: true });

    // Primary: Card-specific, precise selection
    $('table.text_block.block-2').each((_, block) => {
      if (pairs.length >= 10) return;
      const root = $(block);

      // Artist: explizit der Link im starken Absatz
      const artistLink = root.find('p strong a[rel="noopener"]').first();
      const artist = (artistLink.text() || '').trim() || (root.find('strong a').first().text() || '').trim();

      // Album: in the next paragraph with an <em> after the artist paragraph
      let album = '';
      if (artistLink.length) {
        const artistP = artistLink.closest('p');
        if (artistP && artistP.length) {
          const nextEm = artistP.nextAll('p').find('em').first();
          if (nextEm && nextEm.length) album = (nextEm.text() || '').trim();
        }
      }
      if (!album) {
        // Fallback innerhalb des Blocks: erstes <em>
        album = (root.find('em').first().text() || '').trim();
      }

      addPair(artist, album);
    });

    if (pairs.length < 10) {
      // Secondary: generic approach within the entire document
      const findNearestEm = (startEl) => {
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
        const parent = container.parent();
        if (parent && parent.length) {
          let sib = container.next();
          for (let i = 0; i < 4 && sib && sib.length; i++) {
            em = sib.find('em').first();
            if (em && em.length) {
              const text = em.text().trim();
              if (text) return text;
            }
            sib = sib.next();
          }
        }
        return '';
      };

      $('strong a').each((_, el) => {
        if (pairs.length >= 10) return;
        const artist = $(el).text().trim();
        const album = findNearestEm(el);
        addPair(artist, album);
      });
    }

    if (pairs.length < 10) {
      // Image metadata as additional source
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

    if (pairs.length >= 1) {
      return pairs.slice(0, 10);
    }
  } catch (_) {
    // Ignorieren und auf Fallback gehen
  }

  // 2) Fallback: Plain-Text Regex aufbereitetem Text
  const text = stripHtml(rawBody);
  const lines = text.split(/\n|\r|\r\n|\u2028|\u2029/g).map((l) => l.trim()).filter(Boolean);

  // Muster 1: Artist – Album (en dash oder hyphen)
  const patternArtistDashAlbum = /^(.*?)\s*[–-]\s*(.*?)$/;
  // Muster 2: Album by Artist
  const patternAlbumByArtist = /^(.*?)\s+by\s+(.*?)$/i;

  for (const line of lines) {
    if (pairs.length >= 10) break;
    let m = line.match(patternArtistDashAlbum);
    if (m) {
      const artist = m[1].trim();
      const album = m[2].trim();
      addPair(artist, album);
      continue;
    }
    m = line.match(patternAlbumByArtist);
    if (m) {
      const album = m[1].trim();
      const artist = m[2].trim();
      addPair(artist, album);
      continue;
    }
  }

  return pairs.slice(0, 10);
}

// =============================
// Spotify OAuth2
// =============================
function createSpotifyAuthClient() {
  return new AuthorizationCode({
    client: {
      id: SPOTIFY_CLIENT_ID,
      secret: SPOTIFY_CLIENT_SECRET,
    },
    auth: {
      tokenHost: 'https://accounts.spotify.com',
      tokenPath: '/api/token',
      authorizePath: '/authorize',
    },
    options: {
      authorizationMethod: 'body',
    },
  });
}

async function getAccessTokenFromRefresh(refreshToken) {
  const client = createSpotifyAuthClient();
  const token = client.createToken({ refresh_token: refreshToken });
  const refreshed = await token.refresh();
  // Optional: neuen Refresh-Token speichern (Rotationsschutz)
  const newRefresh = refreshed.token.refresh_token || refreshToken;
  if (newRefresh !== refreshToken) {
    try {
      fs.writeFileSync(TOKEN_STORE_PATH, JSON.stringify({ refresh_token: newRefresh }, null, 2));
      console.log(`Neuer Refresh-Token in ${TOKEN_STORE_PATH} gespeichert.`);
    } catch (_) {}
  }
  return refreshed.token.access_token;
}

async function runInteractiveAuthIfRequested() {
  if (!process.argv.includes('--auth')) return null;

  assertEnv('SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET', 'SPOTIFY_REDIRECT_URI');
  const client = createSpotifyAuthClient();

  const authorizeUrl = client.authorizeURL({
    redirect_uri: SPOTIFY_REDIRECT_URI,
    scope: SPOTIFY_SCOPES.join(' '),
    state: Math.random().toString(36).slice(2),
    show_dialog: true,
  });

  console.log('Open the following URL in your browser and allow access:');
  console.log(authorizeUrl);

  const { port, pathname } = (() => {
    const u = new URL(SPOTIFY_REDIRECT_URI);
    return { port: Number(u.port || 80), pathname: u.pathname };
  })();

  const refreshToken = await new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        if (req.url && req.method === 'GET') {
          const fullUrl = `http://localhost:${port}${req.url}`;
          const u = new URL(fullUrl);
          if (u.pathname === pathname) {
            const code = u.searchParams.get('code');
            const error = u.searchParams.get('error');
            if (error) throw new Error(`Spotify error: ${error}`);
            if (!code) throw new Error('Kein Code erhalten.');

            const tokenParams = {
              code,
              redirect_uri: SPOTIFY_REDIRECT_URI,
            };
            const accessToken = await client.getToken(tokenParams);
            const rt = accessToken.token.refresh_token;

            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('Success. You can close this window.');

            server.close();
            resolve(rt);
            return;
          }
        }
        res.writeHead(404);
        res.end('Not found');
      } catch (e) {
        res.writeHead(500);
        res.end('Error');
        try { server.close(); } catch {}
        reject(e);
      }
    });

    server.listen(port, () => {
      console.log(`Warte auf Redirect unter ${SPOTIFY_REDIRECT_URI} ...`);
    });
  });

  if (refreshToken) {
    console.log('\nDein SPOTIFY_REFRESH_TOKEN:');
    console.log(refreshToken);
    try {
      fs.writeFileSync(TOKEN_STORE_PATH, JSON.stringify({ refresh_token: refreshToken }, null, 2));
      console.log(`\nAuch gespeichert in: ${TOKEN_STORE_PATH}`);
    } catch (_) {}
  }

  console.log('\nAdd this value to your .env as SPOTIFY_REFRESH_TOKEN and run the script without --auth.');
  process.exit(0);
}

// =============================
// Spotify API: Helfer
// =============================
async function spotifyRequest(method, url, accessToken, body) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify API ${method} ${url} fehlgeschlagen: ${res.status} ${res.statusText} - ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function getCurrentUserId(accessToken) {
  const me = await spotifyRequest('GET', 'https://api.spotify.com/v1/me', accessToken);
  return me.id;
}

async function findPlaylistByName(accessToken, name) {
  let url = 'https://api.spotify.com/v1/me/playlists?limit=50';
  while (url) {
    const data = await spotifyRequest('GET', url, accessToken);
    const found = data.items.find((p) => p.name === name);
    if (found) return found;
    url = data.next;
  }
  return null;
}

async function createPlaylist(accessToken, userId, name, description) {
  const body = {
    name,
    description,
    public: false,
  };
  return spotifyRequest('POST', `https://api.spotify.com/v1/users/${encodeURIComponent(userId)}/playlists`, accessToken, body);
}

async function getPlaylistTrackUris(accessToken, playlistId) {
  const uris = new Set();
  let url = `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks?limit=100&fields=items(track(uri,id)),next`;
  while (url) {
    const data = await spotifyRequest('GET', url, accessToken);
    for (const item of data.items) {
      if (item.track && item.track.uri) uris.add(item.track.uri);
    }
    url = data.next;
  }
  return uris;
}

async function searchAlbum(accessToken, album, artist) {
  function sanitize(input) {
    return (input || '')
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2018\u2019]/g, "'")
      .trim();
  }
  function truncate(str, maxLen) {
    if (str.length <= maxLen) return str;
    return str.slice(0, maxLen).trim();
  }

  const cleanAlbum = sanitize(album);
  const cleanArtist = sanitize(artist);

  // Baue Kandidaten in abnehmender Strenge
  const albumShortByWords = cleanAlbum.split(' ').slice(0, 6).join(' ');
  const candidates = [
    `album:"${cleanAlbum}" artist:"${cleanArtist}"`,
    `artist:"${cleanArtist}" album:"${albumShortByWords}"`,
    `album:"${cleanAlbum}"`,
    `${cleanAlbum}`,
  ];

  for (let q of candidates) {
    // Spotify q can be max ~250 characters (server-side checked)
    if (q.length > 230) {
      // Try to shorten album part first
      const albumQuoted = /album:\"([^\"]*)\"/;
      const m = q.match(albumQuoted);
      if (m) {
        const currentAlbum = m[1];
        const overflow = q.length - 230;
        const targetLen = Math.max(10, currentAlbum.length - overflow - 5);
        const reduced = truncate(currentAlbum, targetLen);
        q = q.replace(albumQuoted, `album:\"${reduced}\"`);
      }
      if (q.length > 230) {
        // If still too long: globally shorten remaining characters
        q = truncate(q, 230);
      }
    }

    const url = `https://api.spotify.com/v1/search?type=album&limit=5&q=${encodeURIComponent(q)}`;
    try {
      const data = await spotifyRequest('GET', url, accessToken);
      if (data.albums && data.albums.items && data.albums.items.length > 0) {
        // Prefer exact/close matches
        const exact = data.albums.items.find((a) =>
          a.name && a.name.toLowerCase().includes(cleanAlbum.toLowerCase()) &&
          a.artists && a.artists.some((ar) => ar.name && ar.name.toLowerCase().includes(cleanArtist.toLowerCase()))
        );
        return exact || data.albums.items[0];
      }
    } catch (e) {
      // Fallback on 400 limit error or other search errors → try next candidate
      if (!/maximum length of 250/i.test(String(e && e.message))) {
        // other errors just log and continue trying
        // console.warn(`Spotify-Suche fehlgeschlagen (${q}): ${e.message}`);
      }
      continue;
    }
  }

  return null;
}

async function getAlbumFirstTrackUri(accessToken, albumId) {
  const url = `https://api.spotify.com/v1/albums/${encodeURIComponent(albumId)}/tracks?limit=50`;
  const data = await spotifyRequest('GET', url, accessToken);
  if (data.items && data.items.length > 0) {
    return data.items[0].uri;
  }
  return null;
}

async function getAlbumTrackUris(accessToken, albumId) {
  const uris = [];
  let url = `https://api.spotify.com/v1/albums/${encodeURIComponent(albumId)}/tracks?limit=50&offset=0`;
  while (url) {
    const data = await spotifyRequest('GET', url, accessToken);
    if (data.items && data.items.length > 0) {
      for (const item of data.items) {
        if (item && item.uri) uris.push(item.uri);
      }
    }
    url = data.next;
  }
  return uris;
}

async function addTracksToPlaylist(accessToken, playlistId, trackUris) {
  const chunkSize = 100; // Spotify-Limit pro Request
  for (let i = 0; i < trackUris.length; i += chunkSize) {
    const chunk = trackUris.slice(i, i + chunkSize);
    await spotifyRequest(
      'POST',
      `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks`,
      accessToken,
      { uris: chunk }
    );
    await sleep(200);
  }
}

async function reorderPlaylistByDateAdded(accessToken, playlistId) {
  // Get all tracks with their added_at timestamps
  const tracks = [];
  let url = `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks?limit=100&fields=items(track(uri),added_at),next`;
  
  while (url) {
    const data = await spotifyRequest('GET', url, accessToken);
    for (const item of data.items) {
      if (item.track && item.track.uri) {
        tracks.push({
          uri: item.track.uri,
          added_at: new Date(item.added_at)
        });
      }
    }
    url = data.next;
  }
  
  if (tracks.length === 0) return;
  
  // Sort by added_at descending (newest first)
  tracks.sort((a, b) => b.added_at.getTime() - a.added_at.getTime());
  
  // Reorder tracks in playlist
  const trackUris = tracks.map(t => t.uri);
  const rangeLength = trackUris.length;
  
  await spotifyRequest(
    'PUT',
    `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks`,
    accessToken,
    {
      range_start: 0,
      range_length: rangeLength,
      insert_before: rangeLength
    }
  );
}

// =============================
// Hauptablauf
// =============================
async function main() {
  try {
    // Optionaler Einmal-Flow zur Gewinnung des Refresh-Tokens
    await runInteractiveAuthIfRequested();

    // Check basic configuration
    assertEnv('EMAIL_USER', 'EMAIL_PASS', 'SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET', 'SPOTIFY_REDIRECT_URI');

    // Refresh-Token beziehen: aus .env, oder optional aus Datei (falls via --auth erzeugt)
    let refreshToken = SPOTIFY_REFRESH_TOKEN;
    if (!refreshToken && fs.existsSync(TOKEN_STORE_PATH)) {
      try {
        const stored = JSON.parse(fs.readFileSync(TOKEN_STORE_PATH, 'utf8'));
        refreshToken = stored.refresh_token;
      } catch (_) {}
    }

    if (!refreshToken) {
      console.error('No SPOTIFY_REFRESH_TOKEN found. Run `node pitchfork_spotify_playlist.mjs --auth` once, add the token to .env and restart.');
      process.exit(1);
    }

    // 1) E-Mails abrufen (alle passenden, inkl. gelesene)
    console.log('Searching for all matching Pitchfork emails in INBOX...');
    const emails = await fetchAllMatchingEmails();
    if (!emails || emails.length === 0) {
      console.log('No matching emails found.');
      return;
    }

    // 2) Datenextraktion aus allen E-Mails
    // Map: monthStr -> Array<{artist, album}>
    const monthToPairs = new Map();
    const successfulEmailUids = new Set();

    for (const mail of emails) {
      // Sicherheitscheck Absender/Betreff (sollte durch Suche schon passen)
      if (!String(mail.from).toLowerCase().includes(EXPECTED_FROM) || decodeMimeEncodedWords(mail.subject).trim() !== EXPECTED_SUBJECT) {
        continue;
      }
      const rawPairs = extractAlbumArtistPairs(mail.body);
      const pairs = uniqueBy(rawPairs, (p) => `${p.artist.toLowerCase()}::${p.album.toLowerCase()}`);
      if (!pairs || pairs.length === 0) {
        console.warn(`Email (UID ${mail.uid || 'unknown'}) has no valid album-artist pairs. Skipping this email.`);
        continue;
      }

      const emailDate = new Date(mail.date);
      const monthStr = formatMonthYYYYMM(emailDate);
      const existing = monthToPairs.get(monthStr) || [];
      // kumulativ sammeln
      monthToPairs.set(monthStr, existing.concat(pairs));
      if (Number.isInteger(mail.uid)) {
        successfulEmailUids.add(mail.uid);
      }
    }

    if (monthToPairs.size === 0) {
      console.log('No usable emails found with valid album-artist pairs.');
      return;
    }

    // 3) Spotify: Access Token via Refresh holen
    const accessToken = await getAccessTokenFromRefresh(refreshToken);

    // 4) For each month: search/create playlist and populate
    for (const [monthStr, rawPairs] of monthToPairs.entries()) {
      const pairs = uniqueBy(rawPairs, (p) => `${p.artist.toLowerCase()}::${p.album.toLowerCase()}`);
      if (pairs.length === 0) continue;

      const playlistName = `Pitchfork Best Albums ${monthStr}`;

      const userId = await getCurrentUserId(accessToken);
      let playlist = await findPlaylistByName(accessToken, playlistName);
      if (!playlist) {
        const description = `Pitchfork's Best Reviewed Albums of ${monthStr}`;
        playlist = await createPlaylist(accessToken, userId, playlistName, description);
        console.log(`Playlist created: ${playlist.name}`);
      } else {
        console.log(`Playlist found: ${playlist.name}`);
      }

      const existingUris = await getPlaylistTrackUris(accessToken, playlist.id);

      const toAdd = [];
      for (const { album, artist } of pairs) {
        try {
          const foundAlbum = await searchAlbum(accessToken, album, artist);
          if (!foundAlbum) {
            console.warn(`No album found for: ${artist} – ${album}`);
            continue;
          }
          const firstTrackUri = await getAlbumFirstTrackUri(accessToken, foundAlbum.id);
          if (!firstTrackUri) {
            console.warn(`No first track found for album: ${foundAlbum.name}`);
            continue;
          }
          if (!existingUris.has(firstTrackUri) && !toAdd.includes(firstTrackUri)) {
            toAdd.push(firstTrackUri);
          }
          await sleep(200);
        } catch (e) {
          console.warn(`Error with "${artist} – ${album}": ${e.message}`);
        }
      }

      if (toAdd.length > 0) {
        await addTracksToPlaylist(accessToken, playlist.id, toAdd);
        console.log(`Added: ${toAdd.length} track(s) to "${playlist.name}".`);
        
        // Reorder playlist by date added descending
        await reorderPlaylistByDateAdded(accessToken, playlist.id);
        console.log(`Playlist "${playlist.name}" sorted by date (newest first).`);
      } else {
        console.log(`No new tracks to add for "${playlist.name}".`);
      }
    }

    // 5) Move successfully processed emails to trash
    for (const uid of successfulEmailUids) {
      try {
        await moveEmailToTrash(uid);
        console.log(`Email (UID ${uid}) moved to "${TRASH_MAILBOX}".`);
      } catch (e) {
        console.warn(`Could not move email (UID ${uid}): ${e.message}`);
      }
    }

  } catch (err) {
    console.error('Error:', err.message);
    process.exitCode = 1;
  }
}

// Einstieg
main(); 