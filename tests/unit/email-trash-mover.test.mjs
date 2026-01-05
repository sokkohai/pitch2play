/**
 * Unit tests for email trash-mover service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  findTrashFolder,
  ensureMailbox,
  moveUidsToTrash,
} from '../../src/services/email/trash-mover.mjs';

describe('email-trash-mover', () => {
  let mockImap;

  beforeEach(() => {
    mockImap = {
      list: vi.fn(),
      openBox: vi.fn(),
      move: vi.fn(),
      copy: vi.fn(),
      addFlags: vi.fn(),
      expunge: vi.fn(),
      end: vi.fn(),
      createBox: vi.fn(),
    };
  });

  describe('findTrashFolder', () => {
    it('should find trash folder by special-use flag', async () => {
      mockImap.list.mockImplementation((cb) => {
        cb(null, [
          Buffer.from('(\\HasNoChildren) "/" "INBOX"'),
          Buffer.from('(\\Trash) "/" "Deleted Messages"'),
        ]);
      });

      const result = await findTrashFolder(mockImap);
      expect(result).toBe('Deleted Messages');
    });

    it('should find trash folder by name keyword', async () => {
      mockImap.list.mockImplementation((cb) => {
        cb(null, [
          Buffer.from('(\\HasNoChildren) "/" "INBOX"'),
          Buffer.from('(\\HasNoChildren) "/" "INBOX/Trash"'),
        ]);
      });

      const result = await findTrashFolder(mockImap);
      expect(result).toBe('INBOX/Trash');
    });

    it('should return null if no trash folder found', async () => {
      mockImap.list.mockImplementation((cb) => {
        cb(null, [Buffer.from('(\\HasNoChildren) "/" "INBOX"')]);
      });

      const result = await findTrashFolder(mockImap);
      expect(result).toBeNull();
    });
  });

  describe('ensureMailbox', () => {
    it('should return true if mailbox exists', async () => {
      mockImap.list = vi.fn().mockImplementation((cb) => {
        cb(null, [
          Buffer.from('(\\HasNoChildren) "/" "INBOX/Trash"'),
        ]);
      });

      // Mock the promise-based list call
      mockImap.createBox = vi.fn();

      const result = await ensureMailbox(mockImap, 'INBOX/Trash');
      expect(result).toBe(true);
    });

    it('should create mailbox if it does not exist', async () => {
      mockImap.list = vi.fn().mockImplementation((cb) => {
        cb(null, [Buffer.from('(\\HasNoChildren) "/" "INBOX"')]);
      });

      mockImap.createBox.mockImplementation((name, flags, cb) => {
        cb(null);
      });

      const result = await ensureMailbox(mockImap, 'INBOX/Trash');
      expect(result).toBe(true);
      expect(mockImap.createBox).toHaveBeenCalledWith('INBOX/Trash', false, expect.any(Function));
    });
  });

  describe('moveUidsToTrash', () => {
    it('should move UIDs to trash folder', async () => {
      mockImap.list = vi.fn().mockImplementation((cb) => {
        cb(null, [Buffer.from('(\\Trash) "/" "Deleted Messages"')]);
      });

      mockImap.openBox.mockImplementation((name, readonly, cb) => {
        cb(null);
      });

      mockImap.move = vi.fn().mockImplementation((uid, target, cb) => {
        cb(null);
      });

      const result = await moveUidsToTrash(mockImap, 'INBOX', ['123', '124']);
      expect(result).toBe(2);
    });

    it('should throw error if no UIDs provided', async () => {
      await expect(moveUidsToTrash(mockImap, 'INBOX', [])).rejects.toThrow('No UIDs provided');
    });
  });
});
