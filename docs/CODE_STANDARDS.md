# Code Standards & Requirements

Quick reference for all code standards and requirements.

## Directory Structure

```
src/                    ← All source code
├── services/           ← Business logic (email, spotify, sync)
├── utils/              ← Pure utility functions
├── config.mjs          ← Configuration management
└── logger.mjs          ← Logging utilities

tests/                  ← All tests (mirrors src)
├── unit/               ← Unit tests
├── integration/        ← Integration tests
└── fixtures/           ← Test data

docs/                   ← Documentation
├── CODE_STANDARDS.md   ← This file
├── ARCHITECTURE.md     ← System design
├── TESTING.md          ← Testing guidelines
└── TROUBLESHOOTING.md  ← Common issues
```

**RULE**: Tests in `tests/`, docs in `docs/`, source in `src/`.

---

## Naming Conventions

### JavaScript

| Item | Convention | Example |
|------|-----------|---------|
| **Files** | kebab-case | `email-parser.mjs`, `album-search.mjs` |
| **Variables** | camelCase | `accessToken`, `albumName` |
| **Constants** | UPPER_SNAKE_CASE | `MAX_RETRIES`, `DEFAULT_TIMEOUT` |
| **Functions** | camelCase, descriptive | `searchAlbum()`, `getAccessToken()` |
| **Classes** | PascalCase | `SpotifyClient`, `EmailProcessor` |
| **Booleans** | `is*` or `has*` prefix | `isPublic`, `hasError` |
| **Private** | prefix `_` | `_internalHelper()` |

### Python

| Item | Convention | Example |
|------|-----------|---------|
| **Files** | snake_case | `email_parser.py`, `album_search.py` |
| **Variables** | snake_case | `access_token`, `album_name` |
| **Constants** | UPPER_SNAKE_CASE | `MAX_RETRIES`, `DEFAULT_TIMEOUT` |
| **Functions** | snake_case | `search_album()`, `get_access_token()` |
| **Classes** | PascalCase | `SpotifyClient`, `EmailProcessor` |
| **Private** | prefix `_` | `_internal_helper()` |

---

## Code Structure

### JavaScript Module Template

```javascript
/**
 * Module docstring: Explain what this module does.
 */

// 1. Imports (grouped: built-ins, third-party, local)
import fs from 'fs';
import fetch from 'node-fetch';
import logger from '../logger.mjs';

// 2. Constants (UPPER_SNAKE_CASE)
const DEFAULT_TIMEOUT = 5000;
const MAX_RETRIES = 3;

// 3. Type definitions (JSDoc)
/**
 * Searches for albums on Spotify.
 * @param {string} album - Album name
 * @param {string} artist - Artist name
 * @param {string} token - Access token
 * @returns {Promise<Object|null>} Album object or null
 * @throws {Error} If API fails
 */

// 4. Private helpers (prefix with _)
function _normalize(value) {
  return value.toLowerCase().trim();
}

// 5. Exported functions (at bottom)
export async function searchAlbum(album, artist, token) {
  // Implementation
}
```

### Python Module Template

```python
#!/usr/bin/env python3
"""Module docstring explaining what this module does."""

import sys
from typing import Optional, List

# Constants
DEFAULT_TIMEOUT = 5
MAX_RETRIES = 3

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
    return _internal_helper(param)

def _internal_helper(param: str) -> dict:
    """Internal helper function."""
    return {}

if __name__ == "__main__":
    main()
```

---

## Error Handling

### Pattern 1: Log then throw

```javascript
try {
  const result = await operation();
  return result;
} catch (error) {
  logger.error('Operation failed', { error: error.message });
  throw new OperationError(`Failed: ${error.message}`);
}
```

### Pattern 2: Custom error classes

```javascript
export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigError';
  }
}

export class SpotifyError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = 'SpotifyError';
    this.statusCode = statusCode;
  }
}
```

### Never do this:

```javascript
// ❌ BAD: Silent failure
try {
  return await operation();
} catch {
  return null;
}

// ❌ BAD: No logging
throw new Error('Something failed');
```

---

## Logging

### Good logging:

```javascript
// Structured, contextual
logger.info('Album found', { album: 'Abbey Road', artist: 'Beatles' });
logger.error('Search failed', { query: q, status: err.status });
logger.warn('No results returned', { album, artist });
```

### Never use console:

```javascript
// ❌ BAD
console.log('Album found');
console.error('Error!');
console.warn('Warning');

// ✅ GOOD
logger.info('Album found');
logger.error('Operation failed', { error: err.message });
logger.warn('No results', { album });
```

---

## Configuration & Secrets

### Environment Variables

Never hardcode credentials. Use `.env`:

```env
EMAIL_USER=your-email@icloud.com
EMAIL_PASS=your-app-specific-password
SPOTIFY_CLIENT_ID=your-client-id
SPOTIFY_CLIENT_SECRET=your-client-secret
SPOTIFY_REDIRECT_URI=http://localhost:3000/callback
LOG_LEVEL=info
```

### Validation

```javascript
// config.mjs: Validate early
export function validateConfig() {
  const required = ['EMAIL_USER', 'SPOTIFY_CLIENT_ID', ...];
  const missing = required.filter(k => !process.env[k]);
  
  if (missing.length > 0) {
    throw new Error(`Missing: ${missing.join(', ')}`);
  }
}
```

---

## Code Quality Checklist

Before committing:

- [ ] **Naming**: kebab-case files, camelCase vars, UPPER_SNAKE_CASE constants
- [ ] **Structure**: Imports → Constants → Types → Helpers → Exports
- [ ] **Comments**: JSDoc for all public functions
- [ ] **Errors**: All errors logged, then thrown
- [ ] **Logging**: Using logger, not console.log()
- [ ] **Tests**: All features tested
- [ ] **Docs**: Code comments clear
- [ ] **Secrets**: No hardcoded credentials
- [ ] **Format**: Code is formatted properly

---

## Git & Commits

### Branch Naming

```
feature/album-dedup
feature/spotify-oauth-refresh
fix/email-parsing-unicode
refactor/spotify-client
test/add-email-parser-tests
docs/update-troubleshooting
```

### Commit Messages

```
<type>: <subject>

<body (optional)>

<footer (optional)>
```

**Types**: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`

**Examples**:

```
feat: add album deduplication logic

Previously, duplicate albums from multiple emails were added
multiple times. Now we skip already-added albums.

Fixes #47
```

```
fix: handle iCloud trash folder detection

Updated heuristics to detect both \\Trash flags and INBOX/Trash
naming convention used by iCloud.

Fixes #62
```

---

## Performance & Reliability

### Retry with Backoff

```javascript
await callWithRetry(
  () => spotifyRequest(...),
  3,        // max retries
  1000      // base delay (1s, 2s, 4s exponential)
);
```

### Batch Processing

```javascript
const batchSize = 100;  // Spotify limit
for (let i = 0; i < items.length; i += batchSize) {
  const batch = items.slice(i, i + batchSize);
  await processBatch(batch);
}
```

### Rate Limiting

```javascript
// Add delays between requests
await sleep(200);  // 200ms between Spotify calls
```

---

## Security

### DO:
- ✅ Use environment variables for all credentials
- ✅ Validate configuration at startup
- ✅ Use `.env.example` as template (no secrets)
- ✅ Add `.env` to `.gitignore`
- ✅ Log errors with context (not passwords)

### DON'T:
- ❌ Hardcode API keys, tokens, passwords
- ❌ Log sensitive data
- ❌ Commit `.env` file
- ❌ Use weak validation

---

## Quick Reference Card

```
FILES:           kebab-case.mjs (JS), snake_case.py (Python)
VARIABLES:       camelCase (JS), snake_case (Python)
CONSTANTS:       UPPER_SNAKE_CASE
FUNCTIONS:       camelCase (JS), snake_case (Python)
CLASSES:         PascalCase
BOOLEANS:        is*, has* prefix

STRUCTURE:       Imports → Constants → Types → Helpers → Exports
ERRORS:          Log first, then throw
LOGGING:         Use logger, not console
SECRETS:         Environment variables only
TESTS:           tests/ folder (mirrors src)
DOCS:            docs/ folder

GIT BRANCHES:    feature/*, fix/*, refactor/*, test/*, docs/*
GIT COMMITS:     <type>: <subject> (clear, descriptive)

DATABASE RULES:  Batch at 100+ items, add 200ms delays
ERRORS:          All must be logged with context
VALIDATION:      Check at startup, not in every function
```
