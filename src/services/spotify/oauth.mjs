/**
 * Spotify OAuth Service
 * 
 * Handles OAuth authentication and token refresh.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { AuthorizationCode } from 'simple-oauth2';
import http from 'http';
import { URL } from 'url';
import logger from '../../logger.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKEN_STORE_PATH = path.resolve(process.cwd(), 'spotify_token.json');

const SPOTIFY_SCOPES = [
  'playlist-read-private',
  'playlist-modify-private',
  'playlist-modify-public',
];

/**
 * Get access token via OAuth refresh token.
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<string>} Access token
 * @throws {Error} If refresh fails
 */
export async function getAccessTokenFromRefresh(refreshToken) {
  const oauth2Client = new AuthorizationCode({
    client: {
      id: process.env.SPOTIFY_CLIENT_ID,
      secret: process.env.SPOTIFY_CLIENT_SECRET,
    },
    auth: {
      tokenHost: 'https://accounts.spotify.com',
      tokenPath: '/api/token',
    },
  });

  try {
    const token = await oauth2Client.getToken({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
    return token.token.access_token;
  } catch (err) {
    throw new Error(`Failed to refresh access token: ${err.message}`);
  }
}

/**
 * Run interactive OAuth authentication flow.
 * @returns {Promise<void>}
 * @throws {Error} If required env vars missing
 */
export async function runInteractiveAuth() {
  const required = ['SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET', 'SPOTIFY_REDIRECT_URI'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }

  const oauth2 = new AuthorizationCode({
    client: {
      id: process.env.SPOTIFY_CLIENT_ID,
      secret: process.env.SPOTIFY_CLIENT_SECRET,
    },
    auth: {
      tokenHost: 'https://accounts.spotify.com',
      tokenPath: '/api/token',
      authorizePath: '/authorize',
    },
  });

  const authorizationUri = oauth2.authorizeURL({
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
    scope: SPOTIFY_SCOPES,
  });

  logger.info('Open this URL to authorize:', { url: authorizationUri });
  console.log(`\nOpen this URL in your browser:\n${authorizationUri}\n`);

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, process.env.SPOTIFY_REDIRECT_URI);
      const code = url.searchParams.get('code');

      if (!code) {
        res.writeHead(400);
        res.end('No authorization code received');
        return;
      }

      const token = await oauth2.getToken({
        code,
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
      });

      fs.writeFileSync(TOKEN_STORE_PATH, JSON.stringify(token.token, null, 2));
      logger.info('Token saved', { file: TOKEN_STORE_PATH });

      res.writeHead(200);
      res.end('Authorization successful! You can close this window.');
      server.close();
    } catch (err) {
      logger.error('Authorization failed', { error: err.message });
      res.writeHead(500);
      res.end(`Authorization failed: ${err.message}`);
      server.close();
    }
  });

  const PORT = new URL(process.env.SPOTIFY_REDIRECT_URI).port || 80;
  server.listen(PORT);
  logger.info('Listening for authorization callback', { port: PORT });
}

/**
 * Load refresh token from env or saved file.
 * @returns {string|null} Refresh token or null
 */
export function loadRefreshToken() {
  let refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
  if (!refreshToken && fs.existsSync(TOKEN_STORE_PATH)) {
    try {
      const stored = JSON.parse(fs.readFileSync(TOKEN_STORE_PATH, 'utf8'));
      refreshToken = stored.refresh_token;
    } catch (_) {}
  }
  return refreshToken || null;
}
