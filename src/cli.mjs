/**
 * CLI Argument Parsing & Handlers
 * 
 * Handles command-line argument parsing and command execution.
 */

import fs from 'fs';
import logger from './logger.mjs';
import { connect, moveUidsToTrash, closeConnection } from './services/email/trash-mover.mjs';

/**
 * Parse command-line arguments for trash-move command.
 * @param {Array<string>} argv - Argument array
 * @returns {Object} Parsed arguments
 */
function _parseTrashMoveArgs(argv) {
  const args = {
    user: null,
    password: null,
    host: 'imap.mail.me.com',
    source: 'INBOX',
    target: null,
    uids: null,
    dryRun: false,
    envFile: '.env',
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--user') {
      args.user = argv[++i];
    } else if (arg === '--password') {
      args.password = argv[++i];
    } else if (arg === '--host') {
      args.host = argv[++i];
    } else if (arg === '--source') {
      args.source = argv[++i];
    } else if (arg === '--target') {
      args.target = argv[++i];
    } else if (arg === '--uids') {
      args.uids = argv[++i];
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--env-file') {
      args.envFile = argv[++i];
    } else if (arg === '--help') {
      _printTrashMoveHelp();
      process.exit(0);
    }
  }

  return args;
}

/**
 * Print help for trash-move command.
 */
function _printTrashMoveHelp() {
  console.log(`
Move emails to trash via IMAP.

Usage:
  npm run trash-move -- --uids <uid-list> [options]

Options:
  --uids <list>          Comma-separated UIDs to move (required)
  --user <email>         Email address (or set EMAIL_USER)
  --password <pass>      Email password (or set EMAIL_PASS)
  --host <host>          IMAP host (default: imap.mail.me.com)
  --source <mailbox>     Source mailbox (default: INBOX)
  --target <mailbox>     Target mailbox (auto-detect if omitted)
  --dry-run              Preview without executing
  --env-file <path>      Load .env file (default: .env)
  --help                 Show this help

Examples:
  npm run trash-move -- --uids 130,131
  npm run trash-move -- --user alice@icloud.com --uids 130,131 --dry-run
`);
}

/**
 * Get environment variable.
 * @param {string} key - Variable name
 * @returns {string|null} Value or null
 */
function _getEnvVar(key) {
  return process.env[key] || null;
}

/**
 * Move emails to trash via CLI.
 * @param {Array<string>} argv - Command arguments
 * @returns {Promise<void>}
 * @throws {Error} If operation fails
 */
export async function moveEmailsToTrashCli(argv) {
  const args = _parseTrashMoveArgs(argv);

  // Load env file if specified
  if (args.envFile && fs.existsSync(args.envFile)) {
    const envContent = fs.readFileSync(args.envFile, 'utf8');
    envContent.split('\n').forEach((line) => {
      const [key, value] = line.split('=').map((s) => s.trim());
      if (key && !process.env[key]) {
        process.env[key] = value;
      }
    });
    logger.info('Loaded env file', { file: args.envFile });
  }

  // Get credentials
  let user = args.user || _getEnvVar('EMAIL_USER');
  let password = args.password || _getEnvVar('EMAIL_PASS');

  if (!user) {
    throw new Error('Email user required (--user or EMAIL_USER env)');
  }

  if (!password) {
    throw new Error('Email password required (--password or EMAIL_PASS env)');
  }

  // Validate UIDs
  if (!args.uids) {
    throw new Error('UIDs required (--uids comma-separated)');
  }

  const uids = args.uids
    .split(',')
    .map((u) => u.trim())
    .filter((u) => u);

  if (uids.length === 0) {
    throw new Error('No valid UIDs provided');
  }

  let imap;
  try {
    logger.info('Connecting to IMAP server...', { host: args.host, user });
    imap = await connect(args.host, user, password);

    logger.info('Moving UIDs to trash...', { count: uids.length, dryRun: args.dryRun });
    const successCount = await moveUidsToTrash(imap, args.source, uids, args.target, args.dryRun);

    logger.info('Trash move completed', { successCount, total: uids.length });
  } catch (err) {
    logger.error('Trash move failed', { error: err.message });
    throw err;
  } finally {
    if (imap) {
      await closeConnection(imap);
    }
  }
}
