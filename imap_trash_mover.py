#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""imap_trash_mover.py

Small utility to find the Trash mailbox on an iCloud IMAP account and move messages
by UID. Uses UID MOVE if supported, otherwise falls back to COPY + mark \\Deleted + EXPUNGE.

Usage:
  python imap_trash_mover.py --user alice@icloud.com --uids 130,131 [--target "INBOX/Trash"] [--dry-run]

Notes:
- Credentials are read from env vars EMAIL_USER and EMAIL_PASS if not passed as args.
- Folder names are taken exactly from the server LIST response (handles INBOX/ prefix).
- If target mailbox is not found, script will try to create `INBOX/Trash`.
"""

import argparse
import getpass
import logging
import re
import sys
import time
import os

import imaplib

# Optional .env loader (python-dotenv)
try:
    from dotenv import load_dotenv  # type: ignore
    DOTENV_AVAILABLE = True
except Exception:
    load_dotenv = None
    DOTENV_AVAILABLE = False

logger = logging.getLogger("imap_trash_mover")
logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

# Quick runtime check: prefer running with Python 3
import sys
if sys.version_info[0] < 3:
    sys.stderr.write("ERROR: This script requires Python 3. Run with 'python3 ./imap_trash_mover.py'\n")
    sys.exit(1)

DEFAULT_HOST = "imap.mail.me.com"

# Heuristics for detecting trash folder name (case-insensitive substrings)
TRASH_KEYWORDS = ("trash", "deleted", "papierkorb", "gelöscht", "eliminados")


def connect(host, user, password, port=993):
    """Connect to IMAP server and return an IMAP4_SSL instance."""
    logger.info("Connecting to %s as %s", host, user)
    M = imaplib.IMAP4_SSL(host, port)
    M.login(user, password)
    logger.info("Logged in")
    return M


def parse_list_line(line_bytes):
    """Return (flags, mailbox_name) for a single LIST response line.

    The response often looks like:
      b'(\\HasNoChildren) "/" "INBOX/Trash"'
    or
      b'("\\\\HasNoChildren" "/" "INBOX/Trash")'
    """
    try:
        line = line_bytes.decode()
    except Exception:
        line = str(line_bytes)
    # Try to capture flags and the quoted mailbox name at end
    m = re.search(r"\((?P<flags>[^)]*)\).*\"(?P<name>.+)\"\s*$", line)
    if m:
        flags = m.group("flags").strip()
        name = m.group("name").strip()
        return flags, name
    # Fallback: take last quoted token
    mm = re.search(r'"(?P<name>[^\"]+)"\s*$', line)
    if mm:
        return None, mm.group("name")
    return None, None


def list_mailboxes(M):
    typ, data = M.list()
    if typ != "OK":
        raise RuntimeError("LIST failed: %s" % (typ,))
    boxes = []
    for line in data:
        if not line:
            continue
        flags, name = parse_list_line(line)
        if name:
            boxes.append((flags or "", name))
    return boxes


def find_trash_folder(M):
    """Find a likely Trash folder via SPECIAL-USE or name heuristics.

    Returns the exact mailbox name returned by LIST, or None if not found.
    """
    logger.info("Looking for trash folder via LIST (checking for \\Trash or keywords)")
    boxes = list_mailboxes(M)
    # Primary check: look for special-use flags (\Trash or \Deleted)
    for flags, name in boxes:
        if "\\Trash" in flags or "\\Deleted" in flags:
            logger.info("Found special-use trash: %s (flags=%s)", name, flags)
            return name
    # Secondary: name contains one of our keywords
    for flags, name in boxes:
        l = name.lower()
        if any(k in l for k in TRASH_KEYWORDS):
            logger.info("Found probable trash by name: %s (flags=%s)", name, flags)
            return name
    logger.info("No trash folder found via heuristics")
    return None


def ensure_mailbox(M, target):
    """Ensure mailbox exists; try to create if missing. Returns True if present/created."""
    _, boxes = M.list()
    for line in boxes or []:
        _, name = parse_list_line(line)
        if name == target:
            logger.info("Target mailbox exists: %s", target)
            return True
    logger.info("Target mailbox not found; attempting to create: %s", target)
    typ, data = M.create(target)
    if typ == "OK":
        logger.info("Mailbox created: %s", target)
        return True
    logger.error("Failed to create mailbox %s: %s", target, data)
    return False


def supports_move(M):
    caps = getattr(M, "capabilities", None)
    if not caps:
        try:
            caps = M.capability()
        except Exception:
            caps = None
    if not caps:
        return False
    # capability entries may be bytes or strings
    caps_strs = [c.decode() if isinstance(c, bytes) else str(c) for c in caps]
    return any(c.upper() == "MOVE" for c in caps_strs)


def move_uid(M, uid, target, dry_run=False):
    """Move a single UID to target mailbox. Returns True on success.

    Uses UID MOVE if server supports it, otherwise COPY + store + expunge.
    """
    logger.info("Moving UID %s -> %s", uid, target)
    if dry_run:
        logger.info("DRY RUN: would move uid %s to %s", uid, target)
        return True

    if supports_move(M):
        typ, data = M.uid("MOVE", uid, target)
        if typ == "OK":
            logger.info("UID %s moved via MOVE", uid)
            return True
        logger.warning("MOVE failed for %s: %s", uid, data)

    # Fallback: COPY, mark \Deleted, EXPUNGE
    logger.info("Falling back to COPY + \\Deleted + EXPUNGE for %s", uid)
    typ, data = M.uid("COPY", uid, target)
    if typ != "OK":
        logger.error("COPY failed for %s: %s", uid, data)
        return False
    typ, data = M.uid("STORE", uid, "+FLAGS", r"(\Deleted)")
    if typ != "OK":
        logger.error("STORE +FLAGS failed for %s: %s", uid, data)
        return False
    # Expunge the mailbox to remove deleted messages
    typ, data = M.expunge()
    if typ != "OK":
        logger.error("EXPUNGE failed: %s", data)
        return False
    logger.info("UID %s moved via fallback", uid)
    return True


def run(args):
    # Load .env if requested (default: .env). If python-dotenv isn't installed, warn and continue.
    if getattr(args, "env_file", None):
        if DOTENV_AVAILABLE and load_dotenv:
            if os.path.exists(args.env_file):
                load_dotenv(args.env_file)
                logger.info("Loaded env file: %s", args.env_file)
            else:
                logger.info("Env file %s not found; skipping", args.env_file)
        else:
            logger.warning("python-dotenv not installed; can't load %s. Install with: pip install python-dotenv", args.env_file)

    user = args.user or os_environ_get("EMAIL_USER")
    password = args.password or os_environ_get("EMAIL_PASS")
    if not user:
        user = input("iCloud username: ")
    if not password:
        password = getpass.getpass("Password (app-specific password recommended): ")

    M = connect(args.host, user, password)

    # Select the source mailbox (required for UID operations)
    logger.info("Selecting source mailbox: %s", args.source)
    typ, data = M.select(args.source)
    if typ != "OK":
        logger.error("Failed to select mailbox %s: %s", args.source, data)
        M.logout()
        return 1

    target = args.target
    if not target:
        found = find_trash_folder(M)
        if found:
            target = found
        else:
            # try standard fallback
            fallback = "INBOX/Trash"
            if ensure_mailbox(M, fallback):
                target = fallback
            else:
                logger.error("Could not determine or create a trash mailbox. Exiting.")
                M.logout()
                return 1

    uids = [u.strip() for u in args.uids.split(",") if u.strip()]
    if not uids:
        logger.error("No UIDs provided; nothing to do.")
        M.logout()
        return 1

    success = True
    for uid in uids:
        try:
            ok = move_uid(M, uid, target, dry_run=args.dry_run)
            success = success and ok
            # small pause to avoid rate-limiting
            time.sleep(0.2)
        except Exception as e:
            logger.exception("Error moving UID %s: %s", uid, e)
            success = False

    M.logout()
    return 0 if success else 2


def os_environ_get(key):
    import os

    return os.environ.get(key)


def parse_args():
    p = argparse.ArgumentParser(description="Move UIDs to iCloud Trash (MOVE fallback).")
    p.add_argument("--user", help="iCloud username (or set EMAIL_USER env)")
    p.add_argument("--password", help="Password (or set EMAIL_PASS env)")
    p.add_argument("--host", default=DEFAULT_HOST, help="IMAP host (default: imap.mail.me.com)")
    p.add_argument("--source", default="INBOX", help="Source mailbox to move from (default: INBOX)")
    p.add_argument("--target", help="Target mailbox (if omitted, auto-detect Trash)")
    p.add_argument("--env-file", default=".env", help="Path to .env file to load (default: .env). Set to empty string to disable loading")
    p.add_argument("--uids", help="Comma-separated UID list to move", required=True)
    p.add_argument("--dry-run", action="store_true", help="Don't perform changes; just log actions")
    return p.parse_args()


if __name__ == "__main__":
    args = parse_args()
    sys.exit(run(args))
