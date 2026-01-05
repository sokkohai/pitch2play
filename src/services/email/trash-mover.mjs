/**
 * Email Trash Mover
 * 
 * Moves messages to trash folder via IMAP.
 * Uses UID MOVE if supported, otherwise falls back to COPY + mark \Deleted + EXPUNGE.
 */

import Imap from 'imap';
import logger from '../../logger.mjs';

const DEFAULT_HOST = 'imap.mail.me.com';
const DEFAULT_PORT = 993;
const TRASH_KEYWORDS = ['trash', 'deleted', 'papierkorb', 'gelöscht', 'eliminados'];

/**
 * Connect to IMAP server.
 * @param {string} host - IMAP host
 * @param {string} user - Email address
 * @param {string} password - Email password
 * @param {number} port - IMAP port (default: 993)
 * @returns {Promise<Object>} IMAP connection
 * @throws {Error} If connection fails
 */
export async function connect(host, user, password, port = DEFAULT_PORT) {
  return new Promise((resolve, reject) => {
    logger.info('Connecting to IMAP server', { host, user });
    
    const imap = new Imap({
      user,
      password,
      host,
      port,
      tls: true,
      autotls: 'required',
    });

    imap.once('ready', () => {
      logger.info('IMAP connection established');
      resolve(imap);
    });

    imap.once('error', (err) => {
      logger.error('IMAP connection failed', { error: err.message });
      reject(err);
    });

    imap.connect();
  });
}

/**
 * Parse a single LIST response line.
 * @param {Buffer} lineBytes - Raw LIST response
 * @returns {Object} { flags, name }
 */
function _parseListLine(lineBytes) {
  try {
    const line = lineBytes.toString();
    const match = line.match(/\((?<flags>[^)]*)\).*"(?<name>.+)"\s*$/);
    if (match) {
      return {
        flags: match.groups.flags.trim(),
        name: match.groups.name.trim(),
      };
    }
    const fallbackMatch = line.match(/"(?<name>[^"]+)"\s*$/);
    if (fallbackMatch) {
      return {
        flags: null,
        name: fallbackMatch.groups.name,
      };
    }
    return { flags: null, name: null };
  } catch (err) {
    logger.warn('Failed to parse LIST line', { error: err.message });
    return { flags: null, name: null };
  }
}

/**
 * List all mailboxes on the server.
 * @param {Object} imap - IMAP connection
 * @returns {Promise<Array>} Array of { flags, name }
 */
async function _listMailboxes(imap) {
  return new Promise((resolve, reject) => {
    imap.list((err, boxes) => {
      if (err) {
        reject(new Error(`LIST failed: ${err.message}`));
        return;
      }
      const parsed = boxes
        .filter((line) => line)
        .map((line) => _parseListLine(line))
        .filter((item) => item.name);
      resolve(parsed);
    });
  });
}

/**
 * Find trash folder via SPECIAL-USE flags or name heuristics.
 * @param {Object} imap - IMAP connection
 * @returns {Promise<string|null>} Exact mailbox name or null
 */
export async function findTrashFolder(imap) {
  logger.info('Looking for trash folder via LIST');
  
  const boxes = await _listMailboxes(imap);
  
  // Primary: look for special-use flags
  for (const { flags, name } of boxes) {
    if (flags && (flags.includes('\\Trash') || flags.includes('\\Deleted'))) {
      logger.info('Found special-use trash folder', { name, flags });
      return name;
    }
  }
  
  // Secondary: name contains keyword
  for (const { flags, name } of boxes) {
    const nameLower = name.toLowerCase();
    if (TRASH_KEYWORDS.some((k) => nameLower.includes(k))) {
      logger.info('Found probable trash folder by name', { name, flags });
      return name;
    }
  }
  
  logger.info('No trash folder found via heuristics');
  return null;
}

/**
 * Ensure mailbox exists; create if missing.
 * @param {Object} imap - IMAP connection
 * @param {string} target - Target mailbox name
 * @returns {Promise<boolean>} True if present/created
 */
export async function ensureMailbox(imap, target) {
  const boxes = await _listMailboxes(imap);
  const exists = boxes.some((box) => box.name === target);
  
  if (exists) {
    logger.info('Target mailbox exists', { target });
    return true;
  }
  
  logger.info('Target mailbox not found; attempting to create', { target });
  
  return new Promise((resolve) => {
    imap.createBox(target, false, (err) => {
      if (err) {
        logger.error('Failed to create mailbox', { target, error: err.message });
        resolve(false);
      } else {
        logger.info('Mailbox created', { target });
        resolve(true);
      }
    });
  });
}

/**
 * Check if server supports MOVE capability.
 * @param {Object} imap - IMAP connection
 * @returns {boolean} True if MOVE is supported
 */
function _supportsMove(imap) {
  const caps = imap.serverCapabilities || [];
  return caps.some((c) => c.toUpperCase() === 'MOVE');
}

/**
 * Move a single UID to target mailbox.
 * Uses UID MOVE if supported, otherwise COPY + mark \Deleted + EXPUNGE.
 * @param {Object} imap - IMAP connection
 * @param {string} uid - Message UID
 * @param {string} target - Target mailbox
 * @param {boolean} dryRun - Don't perform actual changes
 * @returns {Promise<boolean>} True on success
 */
export async function moveUid(imap, uid, target, dryRun = false) {
  logger.info('Moving UID to target mailbox', { uid, target, dryRun });
  
  if (dryRun) {
    logger.info('DRY RUN: would move UID', { uid, target });
    return true;
  }

  if (_supportsMove(imap)) {
    return new Promise((resolve) => {
      imap.move(uid, target, (err) => {
        if (err) {
          logger.warn('MOVE failed; falling back to COPY+DELETE', { uid, error: err.message });
          resolve(false);
        } else {
          logger.info('UID moved via MOVE', { uid });
          resolve(true);
        }
      });
    });
  }

  // Fallback: COPY, mark \Deleted, EXPUNGE
  logger.info('Falling back to COPY + \\Deleted + EXPUNGE', { uid });
  
  try {
    await new Promise((resolve, reject) => {
      imap.copy(uid, target, (err) => (err ? reject(err) : resolve()));
    });

    await new Promise((resolve, reject) => {
      imap.addFlags(uid, '\\Deleted', (err) => (err ? reject(err) : resolve()));
    });

    await new Promise((resolve, reject) => {
      imap.expunge((err) => (err ? reject(err) : resolve()));
    });

    logger.info('UID moved via fallback', { uid });
    return true;
  } catch (err) {
    logger.error('Fallback move failed', { uid, error: err.message });
    return false;
  }
}

/**
 * Move multiple UIDs to trash folder.
 * @param {Object} imap - IMAP connection
 * @param {string} source - Source mailbox
 * @param {Array<string>} uids - UIDs to move
 * @param {string} target - Target mailbox (auto-detected if omitted)
 * @param {boolean} dryRun - Don't perform actual changes
 * @returns {Promise<number>} Number of successfully moved UIDs
 */
export async function moveUidsToTrash(imap, source, uids, target = null, dryRun = false) {
  if (!uids || uids.length === 0) {
    logger.error('No UIDs provided');
    throw new Error('No UIDs provided');
  }

  logger.info('Opening source mailbox', { source });
  
  await new Promise((resolve, reject) => {
    imap.openBox(source, false, (err) => (err ? reject(err) : resolve()));
  });

  let trashFolder = target;
  if (!trashFolder) {
    trashFolder = await findTrashFolder(imap);
    if (!trashFolder) {
      const fallback = 'INBOX/Trash';
      const created = await ensureMailbox(imap, fallback);
      if (!created) {
        throw new Error('Could not determine or create trash mailbox');
      }
      trashFolder = fallback;
    }
  }

  logger.info('Using trash folder', { folder: trashFolder });

  let successCount = 0;
  for (const uid of uids) {
    try {
      const ok = await moveUid(imap, uid, trashFolder, dryRun);
      if (ok) successCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 200)); // Rate limit
    } catch (err) {
      logger.error('Error moving UID', { uid, error: err.message });
    }
  }

  return successCount;
}

/**
 * Close IMAP connection.
 * @param {Object} imap - IMAP connection
 * @returns {Promise<void>}
 */
export async function closeConnection(imap) {
  return new Promise((resolve) => {
    imap.end();
    imap.state === 'CLOSED' ? resolve() : imap.once('close', resolve);
  });
}
