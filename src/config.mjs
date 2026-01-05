/**
 * Configuration management for pitch2play.
 * Loads and validates environment variables.
 */

import 'dotenv/config';

/**
 * Validates that all required environment variables are set.
 * @throws {Error} If required variables are missing
 */
function validateConfig() {
  const required = [
    'EMAIL_USER',
    'EMAIL_PASS',
    'SPOTIFY_CLIENT_ID',
    'SPOTIFY_CLIENT_SECRET',
    'SPOTIFY_REDIRECT_URI',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
        'See .env.example for the template.'
    );
  }
}

/**
 * Returns configuration object with defaults.
 * @returns {Object} Configuration object
 */
export function getConfig() {
  return {
    email: {
      user: process.env.EMAIL_USER,
      password: process.env.EMAIL_PASS,
      imap: {
        host: 'imap.mail.me.com',
        port: 993,
        tls: true,
      },
      inbox: process.env.IMAP_MAILBOX || 'INBOX',
      trash: process.env.TRASH_MAILBOX || 'Trash',
    },
    spotify: {
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
      redirectUri: process.env.SPOTIFY_REDIRECT_URI,
      refreshToken: process.env.SPOTIFY_REFRESH_TOKEN || null,
    },
    logging: {
      level: process.env.LOG_LEVEL || 'info',
    },
  };
}

export { validateConfig };
