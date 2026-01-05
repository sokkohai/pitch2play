/**
 * Email Fetching Service
 * 
 * Handles email retrieval via IMAP connection.
 */

import Imap from 'imap';
import logger from '../../logger.mjs';
import { decodeMimeEncodedWords } from '../../utils/text.mjs';

const BATCH_SIZE = 20; // Process emails in batches

/**
 * Open IMAP connection.
 * @returns {Promise<Object>} IMAP connection
 * @throws {Error} If connection fails
 */
export function openImapConnection() {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: process.env.EMAIL_USER,
      password: process.env.EMAIL_PASS,
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

/**
 * Fetch all matching Pitchfork emails.
 * @returns {Promise<Array>} Array of email objects
 */
export async function fetchAllMatchingEmails() {
  const imap = await openImapConnection();
  try {
    await new Promise((resolve, reject) => {
      imap.openBox(process.env.IMAP_MAILBOX || 'INBOX', false, (err) => (err ? reject(err) : resolve()));
    });

    const criteria = ['ALL', ['FROM', 'newsletter@pitchfork.com'], ['SUBJECT', '10 Best Reviewed Albums of the Week']];

    const uids = await new Promise((resolve, reject) => {
      imap.search(criteria, (err, results) => (err ? reject(err) : resolve(results || [])));
    });

    if (!uids || uids.length === 0) {
      imap.end();
      return [];
    }

    uids.sort((a, b) => a - b);

    const emails = [];

    for (let i = 0; i < uids.length; i += BATCH_SIZE) {
      const batch = uids.slice(i, i + BATCH_SIZE);
      await new Promise((resolve, reject) => {
        const f = imap.fetch(batch, {
          bodies: ['HEADER.FIELDS (DATE SUBJECT FROM)', 'TEXT'],
          struct: true,
          uid: true,
        });

        const messages = [];

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

/**
 * Move email to trash.
 * @param {number} uid - Email UID
 * @returns {Promise<boolean>} Success
 */
export async function moveEmailToTrash(uid) {
  if (!Number.isInteger(uid) || uid <= 0) {
    throw new Error(`Invalid UID: ${uid}`);
  }
  const imap = await openImapConnection();
  try {
    await new Promise((resolve, reject) => {
      imap.openBox(process.env.IMAP_MAILBOX || 'INBOX', false, (err) => (err ? reject(err) : resolve()));
    });

    const trashMailbox = process.env.TRASH_MAILBOX || 'Deleted Messages';
    await new Promise((resolve, reject) => {
      imap.move([uid], trashMailbox, (err) => (err ? reject(err) : resolve()));
    });
    imap.end();
    return true;
  } catch (err) {
    // Try fallback trash folder
    try {
      await new Promise((resolve, reject) => {
        imap.openBox(process.env.IMAP_MAILBOX || 'INBOX', false, (err) => (err ? reject(err) : resolve()));
      });
      await new Promise((resolve, reject) => {
        imap.move([uid], 'Trash', (err) => (err ? reject(err) : resolve()));
      });
      imap.end();
      return true;
    } catch (e2) {
      try {
        imap.end();
      } catch {}
      throw e2;
    }
  }
}
