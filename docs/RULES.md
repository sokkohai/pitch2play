# Repository Rules & Standards

Master reference for code standards. For detailed guidelines, see:
- **docs/CODE_STANDARDS.md** - Code structure, naming, error handling
- **docs/TESTING.md** - Testing requirements and patterns
- **docs/ARCHITECTURE.md** - System design
- **docs/TROUBLESHOOTING.md** - Common issues

Last updated: 2025-01-05

## 1. Directory Structure

```
pitch2play/
├── README.md                          # What it does, features, setup
├── QUICKSTART.md                      # 5-minute setup guide
├── DEVELOPMENT.md                     # Developer guidelines (detailed)
├── RULES.md                           # This file - quick reference
├── CHANGELOG.md                       # Version history
├── LICENSE                            # MIT License
├── package.json                       # Dependencies, scripts
├── .env.example                       # Environment variables template
├── .gitignore                         # Git exclusions
│
├── src/                               # ✅ All source code goes here
│   ├── index.mjs                      # Entry point
│   ├── cli.mjs                        # CLI argument parsing
│   ├── config.mjs                     # Configuration & env validation
│   ├── logger.mjs                     # Logging utilities
│   ├── services/                      # Business logic
│   │   ├── email/                     # Email fetching & parsing
│   │   ├── spotify/                   # Spotify API operations
│   │   └── sync/                      # Sync orchestration
│   └── utils/                         # Pure utility functions
│       ├── text.mjs                   # HTML, encoding, text
│       ├── date.mjs                   # Date formatting
│       ├── collection.mjs             # Array/Set operations
│       └── retry.mjs                  # Backoff & retry logic
│
├── tests/                             # ✅ All tests go here
│   ├── unit/                          # Unit tests
│   │   ├── utils/
│   │   └── services/
│   ├── integration/                   # Integration tests
│   └── fixtures/                      # Test data & mocks
│
├── scripts/                           # Standalone utility scripts
│   ├── sync-album-tracks.mjs
│   └── imap-trash-mover.mjs
│
└── docs/                              # ✅ Documentation (except README & QUICKSTART)
    ├── ARCHITECTURE.md                # System design
    ├── CONTRIBUTING.md                # How to contribute
    ├── TROUBLESHOOTING.md             # Common issues & solutions
    ├── SETUP-SPOTIFY.md               # Spotify OAuth guide
    └── SETUP-EMAIL.md                 # Email provider guides
```

**RULE**: Tests in `tests/` folder, docs in `docs/` (except README.md and QUICKSTART.md).

---

## 2. Code Standards

### JavaScript/Node.js

#### Naming Conventions
```javascript
// Files: kebab-case
// ✅ email-parser.mjs, album-search.mjs
// ❌ EmailParser.mjs, albumSearch.mjs

// Variables: camelCase
// ✅ const accessToken = '...';
// ❌ const access_token = '...';

// Constants: UPPER_SNAKE_CASE
// ✅ const MAX_RETRIES = 3;
// ❌ const maxRetries = 3;

// Functions: camelCase, descriptive
// ✅ async function searchAlbum(name, artist, token) { }
// ❌ async function search(n, a, t) { }

// Booleans: is*, has* prefix
// ✅ const isPublic = true;
// ✅ const hasError = false;
// ❌ const public = true;
// ❌ const error = false;

// Private functions: prefix with _
// ✅ function _internalHelper() { }
// ✅ const _config = loadConfig();
// ❌ function internalHelper() { }
```

#### Structure
```javascript
/**
 * Module docstring: Explain what this module does.
 */

// 1. Imports (built-ins, third-party, local)
import fs from 'fs';
import fetch from 'node-fetch';
import logger from '../logger.mjs';

// 2. Constants
const DEFAULT_TIMEOUT = 5000;
const MAX_RETRIES = 3;

// 3. Type definitions (JSDoc)
/**
 * Does something important.
 * @param {string} param - Parameter description
 * @returns {Promise<Object>} Result description
 * @throws {Error} When something goes wrong
 */

// 4. Private helpers (prefix with _)
function _normalize(value) { }

// 5. Exported functions (at bottom)
export async function publicFunction(param) { }
```

#### Error Handling
```javascript
// ✅ GOOD: Log, then throw
async function operation() {
  try {
    return await doSomething();
  } catch (error) {
    logger.error('Operation failed', { error: error.message });
    throw new OperationError(`Failed: ${error.message}`);
  }
}

// ❌ BAD: Silent failure
try {
  return await doSomething();
} catch {
  return null;
}
```

#### Logging
```javascript
// ✅ GOOD: Structured, contextual
logger.info('Album found', { album: name, artist, spotifyId: id });
logger.error('Search failed', { error: err.message, query });

// ❌ BAD: Unstructured
console.log('Album found');
logger.warn(`Got ${count} results`);
```

### Python

#### Naming Conventions
```python
# Files: snake_case
# ✅ email_parser.py, album_search.py
# ❌ EmailParser.py, albumSearch.py

# Variables: snake_case
# ✅ access_token = '...'
# ❌ accessToken = '...'

# Functions: snake_case
# ✅ def search_album(name, artist, token):
# ❌ def searchAlbum(name, artist, token):

# Classes: PascalCase
# ✅ class SpotifyClient:
# ❌ class spotify_client:

# Constants: UPPER_SNAKE_CASE
# ✅ MAX_RETRIES = 3
# ❌ maxRetries = 3

# Private: prefix with _
# ✅ def _internal_helper():
# ❌ def internal_helper():
```

#### Structure
```python
#!/usr/bin/env python3
"""Module docstring explaining purpose."""

import sys
from typing import Optional, List

from .utils import helper_function

# Constants
DEFAULT_TIMEOUT = 5
MAX_RETRIES = 3

# Private functions
def _internal_process(data: List[str]) -> Optional[dict]:
    """Internal helper."""
    return None

# Public functions
def public_function(param: str) -> Optional[dict]:
    """Function docstring.
    
    Args:
        param: Parameter description
        
    Returns:
        Result or None
        
    Raises:
        ValueError: When invalid
    """
    if not param:
        raise ValueError("param is required")
    return _internal_process(param)

if __name__ == "__main__":
    main()
```

---

## 3. Testing Rules

### Where Tests Go
- ✅ `tests/unit/` - Unit tests for isolated functions
- ✅ `tests/integration/` - Integration tests for components
- ✅ `tests/fixtures/` - Test data and mocks
- ❌ Never in `src/` directory

### Test File Naming
```
src/utils/text.mjs          → tests/unit/utils/text.test.mjs
src/services/email/         → tests/unit/services/email-*.test.mjs
```

### Test Structure
```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import { functionUnderTest } from '../../../src/path/to/module.mjs';

describe('FunctionName', () => {
  let setup;
  
  beforeEach(() => {
    setup = initializeTestData();
  });
  
  describe('specific behavior', () => {
    it('should do X when given Y', () => {
      // Arrange
      const input = 'test';
      
      // Act
      const result = functionUnderTest(input);
      
      // Assert
      expect(result).toBe('expected');
    });
  });
});
```

### Running Tests
```bash
npm test                      # Run all tests
npm run test:watch          # Watch mode
npm run test:coverage       # With coverage
npm test -- services/       # Specific path
```

### Coverage Expectations
- ✅ 80%+ coverage for core functionality
- ✅ 100% for critical paths (auth, sync)
- ✅ At least 1 test per public function

---

## 4. Documentation Rules

### Where Docs Go

| Document | Location | Purpose |
|----------|----------|---------|
| Getting Started | README.md | First-time users |
| 5-Min Setup | QUICKSTART.md | New developers |
| Dev Guidelines | DEVELOPMENT.md | Code standards, patterns |
| System Design | docs/ARCHITECTURE.md | How components interact |
| Troubleshooting | docs/TROUBLESHOOTING.md | Common issues |
| Contribution | docs/CONTRIBUTING.md | How to contribute |
| Changelog | CHANGELOG.md | Version history |

### Code Comments

```javascript
// ✅ GOOD: Explains WHY and complex logic
// We fetch emails in batches to avoid overwhelming the IMAP server
// and to handle large mailboxes more robustly.
const batchSize = 20;

// ✅ GOOD: JSDoc for all public functions
/**
 * Searches Spotify for an album with multiple fallback strategies.
 * If the combined query is too long, we shorten the artist name,
 * then the album name, to stay within Spotify's 250-char limit.
 * @param {string} album - Album name
 * @param {string} artist - Artist name
 * @param {string} token - Spotify access token
 * @returns {Promise<Object|null>} Album object or null
 */
export async function searchAlbum(album, artist, token) { }

// ❌ BAD: Obvious from code
// Normalize the string
const normalized = text.toLowerCase().trim();

// ❌ BAD: No JSDoc
function searchAlbum(album, artist, token) { }
```

### README Standards

The README.md should include:
- What the project does
- Key features
- Prerequisites
- Quick installation steps
- Basic usage
- Troubleshooting links
- Contributing guidelines
- License

See README.md in this repo for the format.

---

## 5. Git & Commits

### Branch Naming
```
feature/album-dedup
feature/spotify-oauth-refresh
fix/email-parsing-unicode
refactor/spotify-client-module
test/add-email-parser-tests
docs/setup-guide
```

### Commit Messages
```
<type>: <subject>

<body (optional)>

<footer (optional)>
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`

Examples:
```
feat: add album deduplication logic

Previously, albums from multiple emails were added multiple times.
Now we track album IDs and skip already-added albums.

Fixes #47

---

fix: handle iCloud trash folder detection

Updated heuristics to detect both \\Trash flags and INBOX/Trash
naming convention used by iCloud.

Fixes #62

---

docs: update installation instructions
```

### PR Requirements

Before submitting a PR:
- [ ] Code follows DEVELOPMENT.md standards
- [ ] New features have tests
- [ ] All tests pass: `npm test`
- [ ] No linting errors: `npm run lint`
- [ ] Code is formatted: `npm run format`
- [ ] Documentation is updated
- [ ] No hardcoded secrets
- [ ] Commit messages are clear

---

## 6. Configuration Management

### Environment Variables
Never hardcode credentials. Use `.env`:

```env
# Email Configuration
EMAIL_USER=your-email@icloud.com
EMAIL_PASS=your-app-specific-password
IMAP_MAILBOX=INBOX
TRASH_MAILBOX=Trash

# Spotify OAuth2
SPOTIFY_CLIENT_ID=your-client-id
SPOTIFY_CLIENT_SECRET=your-client-secret
SPOTIFY_REDIRECT_URI=http://localhost:3000/callback
SPOTIFY_REFRESH_TOKEN=auto-generated

# Logging (optional)
LOG_LEVEL=info
```

### Validation
```javascript
// In config.mjs, validate all required vars
const required = ['EMAIL_USER', 'SPOTIFY_CLIENT_ID', ...];
const missing = required.filter(k => !process.env[k]);

if (missing.length > 0) {
  throw new Error(`Missing: ${missing.join(', ')}`);
}
```

---

## 7. Performance & Reliability

### Retry Logic
```javascript
// ✅ GOOD: Exponential backoff
await callWithRetry(
  () => spotifyRequest(...),
  3,        // max retries
  1000      // base delay (1s, 2s, 4s)
);

// For rate-limited APIs:
await sleep(200); // between requests
```

### Batch Processing
```javascript
// ✅ GOOD: Process in controlled chunks
const batchSize = 100;  // Spotify limit
for (let i = 0; i < items.length; i += batchSize) {
  const batch = items.slice(i, i + batchSize);
  await processBatch(batch);
}
```

### Logging Verbosity
```
LOG_LEVEL=error     # Only errors
LOG_LEVEL=warn      # Errors + warnings
LOG_LEVEL=info      # Standard logging
LOG_LEVEL=debug     # Detailed debugging
```

---

## 8. Security

### Secrets
- ❌ Never hardcode API keys, tokens, passwords
- ✅ Always use environment variables
- ✅ Use `.env.example` as template (no secrets)
- ✅ Add `.env` to `.gitignore`

### Dependencies
- ✅ Keep dependencies up to date
- ✅ Use `npm audit` regularly
- ❌ Don't add unnecessary dependencies

---

## 9. Code Quality Checklist

Before committing:

- [ ] **Naming**: Files kebab-case, vars/funcs camelCase, constants UPPER_SNAKE_CASE
- [ ] **Structure**: Imports → Constants → Types → Helpers → Exports
- [ ] **Comments**: JSDoc for all public functions, explain WHY not WHAT
- [ ] **Errors**: All errors logged, then thrown
- [ ] **Logging**: Use logger, not console.log
- [ ] **Tests**: All features tested, >80% coverage
- [ ] **Docs**: README updated, code comments clear
- [ ] **Git**: Commits follow convention, branch named correctly
- [ ] **Env vars**: No hardcoded secrets
- [ ] **Format**: Run `npm run format` before commit

---

## 10. Common Patterns

### Service Module Pattern
```javascript
// src/services/email/email-service.mjs
import logger from '../../logger.mjs';

/**
 * Fetches emails from IMAP.
 * @returns {Promise<Array>} List of emails
 * @throws {EmailError} If fetch fails
 */
export async function fetchEmails() {
  try {
    // Implementation
  } catch (error) {
    logger.error('Email fetch failed', { error: error.message });
    throw new EmailError(`Failed to fetch: ${error.message}`);
  }
}
```

### Utility Function Pattern
```javascript
// src/utils/text.mjs
/**
 * Strips HTML tags from a string.
 * @param {string} input - HTML string
 * @returns {string} Plain text
 */
export function stripHtml(input) {
  if (!input) return '';
  // Pure function, no side effects
  return input.replace(/<[^>]+>/g, ' ').trim();
}
```

### Test Pattern
```javascript
// tests/unit/utils/text.test.mjs
describe('stripHtml()', () => {
  it('should remove HTML tags', () => {
    const result = stripHtml('<p>hello</p>');
    expect(result).toBe('hello');
  });
});
```

---

## 11. Quick Reference

### Run Commands
```bash
npm start                     # Run the application
npm run auth                  # Setup Spotify OAuth
npm test                      # Run all tests
npm run test:watch           # Watch mode
npm run lint                  # Check code style
npm run format               # Format code
```

### Directory Decisions
- Source code → `src/`
- Tests → `tests/`
- Docs (except README) → `docs/`
- Utility scripts → `scripts/`

### File Naming
- **JS Files**: `kebab-case.mjs` (e.g., `email-parser.mjs`)
- **Python Files**: `snake_case.py` (e.g., `email_parser.py`)
- **Test Files**: `module.test.mjs` or `test_module.py`

### When in Doubt
1. Check `DEVELOPMENT.md` for detailed guidelines
2. Look at existing code for patterns
3. Ask in a GitHub issue
4. Follow "Single Responsibility" principle

---

## Resources

- [Full Development Guide](DEVELOPMENT.md)
- [Architecture & System Design](docs/ARCHITECTURE.md)
- [Contributing Guide](docs/CONTRIBUTING.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Quick Start](QUICKSTART.md)

---

**Last Updated**: 2025-01-05  
**Enforced By**: Code Review Process
