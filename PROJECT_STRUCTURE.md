# Project Structure

Complete overview of the refactored pitch2play codebase.

## Directory Layout

```
pitch2play/
├── src/                              # All source code
│   ├── index.mjs                     # Main CLI entry point
│   ├── cli.mjs                       # CLI argument parsing & handlers
│   ├── config.mjs                    # Configuration & env validation
│   ├── logger.mjs                    # Logging utilities
│   │
│   ├── services/                     # Business logic layer
│   │   ├── email/                    # Email operations
│   │   │   ├── fetch.mjs             # Fetch emails via IMAP
│   │   │   ├── parser.mjs            # Parse HTML email content
│   │   │   └── trash-mover.mjs       # Move emails to trash
│   │   │
│   │   ├── spotify/                  # Spotify API operations
│   │   │   ├── playlist.mjs          # Playlist CRUD & management
│   │   │   └── oauth.mjs             # OAuth authentication
│   │   │
│   │   └── sync/                     # Orchestration layer
│   │       └── playlists.mjs         # Main workflow (email → playlist)
│   │
│   └── utils/                        # Pure utility functions
│       ├── index.mjs                 # Central export
│       ├── text.mjs                  # HTML/encoding utilities
│       ├── date.mjs                  # Date formatting
│       ├── collection.mjs            # Array/set operations
│       └── retry.mjs                 # Retry & backoff utilities
│
├── tests/                            # All tests (mirrors src)
│   ├── unit/                         # Unit tests
│   │   ├── email-trash-mover.test.mjs
│   │   └── spotify-playlist-creator.test.mjs
│   ├── integration/                  # Integration tests
│   │   └── cli.test.mjs
│   └── fixtures/                     # Test data & mocks
│
├── docs/                             # Documentation
│   ├── RULES.md                      # Quick reference (KEY FILE)
│   ├── CODE_STANDARDS.md             # Code standards
│   ├── ARCHITECTURE.md               # System design
│   ├── TESTING.md                    # Testing guidelines
│   ├── TROUBLESHOOTING.md            # Common issues
│   └── README.md                     # Quick overview
│
├── scripts/                          # Utility scripts (reserved)
│   └── (currently empty)
│
├── .env                              # Environment variables (secret)
├── .env.example                      # Template (no secrets)
├── .gitignore                        # Git exclusions
├── package.json                      # Dependencies & scripts
├── vitest.config.mjs                 # Test configuration
├── README.md                         # Project overview
├── LICENSE                           # MIT License
└── PROJECT_STRUCTURE.md              # This file
```

## Service Architecture

### Email Services (`src/services/email/`)

**trash-mover.mjs**
- IMAP connection management
- Mailbox discovery
- Message movement (MOVE or COPY+DELETE fallback)
- Functions: `connect()`, `findTrashFolder()`, `moveUidsToTrash()`

**fetch.mjs**
- Email retrieval via IMAP
- Batch processing (20 emails per batch)
- Functions: `fetchAllMatchingEmails()`, `moveEmailToTrash()`

**parser.mjs**
- HTML email parsing
- Album/artist extraction
- Multi-strategy parsing (card-based, generic, metadata)
- Functions: `extractAlbumArtistPairs()`

### Spotify Services (`src/services/spotify/`)

**playlist.mjs**
- Spotify API operations
- Playlist creation/updates
- Track management
- Album search with multiple strategies
- Functions: `searchAlbum()`, `createPlaylist()`, `addTracksToPlaylist()`

**oauth.mjs**
- OAuth token management
- Token refresh
- Interactive auth flow
- Functions: `getAccessTokenFromRefresh()`, `runInteractiveAuth()`

### Sync Service (`src/services/sync/`)

**playlists.mjs**
- Main workflow orchestration
- Coordinates email fetching, parsing, and playlist creation
- Functions: `syncPlaylistsFromEmails()`, `setupOAuth()`

## CLI Commands

All commands routed through `src/index.mjs`:

```bash
npm start              # Default: sync Pitchfork emails → Spotify playlists
npm run auth           # Setup Spotify OAuth
npm run trash-move ... # Move emails to trash
```

CLI argument parsing: `src/cli.mjs`

## Data Flow

```
1. Email Fetching
   └─ fetch.mjs: Connect to IMAP, search for Pitchfork emails

2. Content Parsing
   └─ parser.mjs: Extract album/artist pairs from HTML

3. Deduplication
   └─ utils/collection.mjs: uniqueBy()

4. Spotify Operations
   ├─ oauth.mjs: Get/refresh access token
   └─ playlist.mjs: Search albums, create playlists, add tracks

5. Cleanup
   └─ fetch.mjs: Move processed emails to trash

6. Logging
   └─ logger.mjs: Log all operations with context
```

## Utility Functions (`src/utils/`)

| Module | Functions | Purpose |
|--------|-----------|---------|
| **text.mjs** | `stripHtml()`, `decodeMimeEncodedWords()` | HTML/encoding |
| **date.mjs** | `formatYYYYMM()`, `formatYYYYMMDD()` | Date formatting |
| **collection.mjs** | `uniqueBy()`, `groupBy()`, `chunk()` | Array operations |
| **retry.mjs** | `callWithRetry()`, `sleep()` | Retry logic |

## Configuration

**Environment Variables** (from `.env`):
- `EMAIL_USER` - Email address
- `EMAIL_PASS` - App-specific password
- `SPOTIFY_CLIENT_ID` - Spotify API ID
- `SPOTIFY_CLIENT_SECRET` - Spotify API secret
- `SPOTIFY_REDIRECT_URI` - OAuth redirect URI
- `SPOTIFY_REFRESH_TOKEN` - OAuth token (auto-saved)
- `LOG_LEVEL` - Logging level (default: info)
- `IMAP_MAILBOX` - Email inbox (default: INBOX)
- `TRASH_MAILBOX` - Trash folder (default: Deleted Messages)

**Loaded by** `src/config.mjs`

## Code Standards

Follows `docs/RULES.md`:

- **Files**: kebab-case (`email-parser.mjs`)
- **Variables**: camelCase (`accessToken`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRIES`)
- **Functions**: camelCase, descriptive (`searchAlbum()`)
- **Classes**: PascalCase (`SpotifyClient`)
- **Booleans**: `is*` / `has*` prefix (`isPublic`, `hasError`)
- **Private**: underscore prefix (`_helper()`)

**Structure**:
1. Imports (built-ins, third-party, local)
2. Constants
3. Type definitions (JSDoc)
4. Private helpers
5. Exported functions

**Error Handling**: Always log then throw, never silent failures.

**Logging**: Use `logger` module, never `console.log()`.

## Testing Strategy

**Unit Tests** (`tests/unit/`):
- Test services in isolation
- Mock external dependencies (IMAP, Spotify API)
- Cover success and error paths

**Integration Tests** (`tests/integration/`):
- Test CLI routing
- Verify service availability
- Check module imports

**Run Tests**:
```bash
npm test                 # Run all tests
npm run test:coverage   # Coverage report
npm run test:watch      # Watch mode
```

## Key Files

| File | Purpose |
|------|---------|
| **docs/RULES.md** | Master reference for standards |
| **src/index.mjs** | CLI entry point |
| **src/cli.mjs** | Argument parsing |
| **src/services/** | Business logic |
| **src/utils/index.mjs** | Utility exports |
| **package.json** | Dependencies & scripts |
| **vitest.config.mjs** | Test configuration |

## Dependencies

**Runtime**:
- `imap` - Email/IMAP client
- `node-fetch` - HTTP client
- `cheerio` - HTML parser
- `simple-oauth2` - OAuth 2.0
- `dotenv` - Environment loading

**Development**:
- `vitest` - Test runner
- `eslint` - Linter
- `prettier` - Formatter

## Scripts

```json
{
  "start": "node src/index.mjs",
  "auth": "node src/index.mjs --auth",
  "trash-move": "node src/index.mjs trash-move",
  "test": "vitest",
  "test:coverage": "vitest --coverage",
  "test:watch": "vitest --watch",
  "lint": "eslint src tests scripts",
  "lint:fix": "eslint src tests scripts --fix",
  "format": "prettier --write \"src/**/*.{mjs,js}\" \"tests/**/*.{mjs,js}\""
}
```

## Removed Files

Following the refactoring:
- ❌ `imap_trash_mover.py` (moved to `src/services/email/trash-mover.mjs`)
- ❌ `pitchfork_spotify_playlist.mjs` (moved to `src/services/`)
- ❌ `sync_pitchfork_album_tracks.py` (moved to `src/services/spotify/`)
- ❌ Deprecated docs (CLI_USAGE.md, DEVELOPER_GUIDE.md, etc.)

All functionality preserved and modernized!

## Next Steps

1. **Run tests**: `npm test`
2. **Check linting**: `npm run lint`
3. **Format code**: `npm run format`
4. **Try commands**: `npm start`, `npm run auth`, `npm run trash-move -- --help`

---

**Status**: ✅ Complete  
**Last Updated**: January 5, 2026  
**Version**: 1.0
