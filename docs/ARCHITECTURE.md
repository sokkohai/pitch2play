# Architecture & System Design

## Overview

pitch2play is a three-stage data pipeline:

```
Email Fetcher → Parser → Spotify Playlist Creator
```

### Stage 1: Email Fetching
- Connect to iCloud IMAP
- Search for Pitchfork newsletters
- Batch-fetch email content

### Stage 2: Album Extraction
- Parse HTML email content
- Extract album and artist names
- Normalize and deduplicate data

### Stage 3: Spotify Sync
- Search Spotify for albums
- Create/update monthly playlists
- Handle duplicates and failures

---

## Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         CLI Layer                            │
│  (pitchfork_spotify_playlist.mjs - entry point)             │
└──────────────────┬──────────────────────────────────────────┘
                   │
       ┌───────────┴───────────┐
       │                       │
┌──────▼──────┐          ┌─────▼────────┐
│   Service   │          │    OAuth     │
│   Layer     │          │   Handler    │
└──────┬──────┘          └─────┬────────┘
       │                       │
    ┌──┴───────────────────────┴──┐
    │                             │
┌───▼──────┐  ┌──────────┐  ┌────▼────┐
│  Email   │  │ Spotify  │  │ Sync    │
│ Service  │  │ Service  │  │ Engine  │
└───┬──────┘  └──────────┘  └────┬────┘
    │                            │
    └──────┬──────────┬──────────┘
           │          │
    ┌──────▼──┐  ┌───▼──────┐
    │ Utils   │  │ Config   │
    │ Layer   │  │ & Logger │
    └─────────┘  └──────────┘
```

### Layers

#### CLI Layer (`src/index.mjs`, `src/cli.mjs`)
- Parses command-line arguments (`--auth`, `--sync`, etc.)
- Orchestrates the entire flow
- Handles user interaction (prompts, confirmations)
- Exit codes and error reporting

#### Service Layer (`src/services/`)
Three independent services that can be used independently:

**Email Service** (`services/email/*`)
- IMAP connection management
- Email searching and fetching
- Content parsing and HTML stripping
- Album/artist extraction
- Email orchestration

**Spotify Service** (`services/spotify/*`)
- OAuth2 token management
- Spotify API requests
- Album search with multiple strategies
- Playlist CRUD operations
- Track management

**Sync Engine** (`services/sync/*`)
- Coordinates email fetching and Spotify syncing
- Deduplication logic
- Monthly playlist organization
- Error recovery

#### Utilities (`src/utils/`)
Pure functions for:
- Text processing (HTML stripping, encoding)
- Date formatting and manipulation
- Collection operations (dedup, grouping)
- Retry logic with backoff

#### Config & Logger (`src/config.mjs`, `src/logger.mjs`)
- Environment variable loading and validation
- Structured logging across services

---

## Data Flow

### Full Sync Flow

```
main()
  ├─ validateConfig()
  ├─ getAccessToken(refreshToken)
  │   └─ Spotify OAuth2 flow
  ├─ fetchAllMatchingEmails()
  │   ├─ IMAP connection
  │   ├─ Search for Pitchfork newsletters
  │   └─ Batch fetch + parse headers/body
  │
  ├─ For each email:
  │   ├─ extractAlbumArtistPairs()
  │   │   └─ Parse HTML, find album/artist patterns
  │   └─ uniqueBy() → deduplicate
  │
  ├─ Group emails by month:
  │   └─ monthToPairs = Map<"YYYY-MM", Array<{album, artist}>>
  │
  ├─ For each month:
  │   ├─ findOrCreatePlaylist(accessToken, playlistName)
  │   ├─ For each album/artist:
  │   │   ├─ searchAlbum(album, artist)
  │   │   │   ├─ Try direct search
  │   │   │   ├─ If too long, shorten and retry
  │   │   │   └─ Return best match or null
  │   │   ├─ getAlbumFirstTrackUri(albumId)
  │   │   └─ Add to toAdd[] if not duplicate
  │   │
  │   └─ addTracksToPlaylist(toAdd) [chunked at 100]
  │       └─ reorderPlaylistByDateAdded()
  │
  └─ Move processed emails to trash
```

### OAuth2 Authentication Flow

```
user runs: npm run auth

─────────────────────────────────────────────
  ┌─ Start local HTTP server (localhost:3000)
  │
  ├─ Open browser → Spotify authorization page
  │
  ├─ User logs in, authorizes scopes
  │   (playlist-read-private, playlist-modify-private, playlist-modify-public)
  │
  ├─ Spotify redirects to localhost:3000/callback?code=...&state=...
  │
  ├─ Exchange auth code for tokens:
  │   POST https://accounts.spotify.com/api/token
  │   ├─ code (from redirect)
  │   ├─ client_id
  │   ├─ client_secret
  │   └─ redirect_uri
  │
  ├─ Receive: access_token + refresh_token
  │
  └─ Save refresh_token to .env (SPOTIFY_REFRESH_TOKEN)
```

### Album Search Strategy

When searching for an album on Spotify, we use multiple strategies to handle edge cases:

```
searchAlbum("The Dark Side of the Moon", "Pink Floyd")

1️⃣ Direct Search (if query ≤ 250 chars)
   GET /v1/search?q=album:"The Dark Side of the Moon" artist:"Pink Floyd"&type=album
   ✅ If found exact match → return
   ❌ If not found → continue to step 2

2️⃣ Shorten Artist (if query too long)
   GET /v1/search?q=album:"The Dark Side of the Moon" artist:"Pink"
   ✅ If found → return
   ❌ If not found → continue to step 3

3️⃣ Shorten Album (if query still too long)
   GET /v1/search?q=album:"The Dark" artist:"Pink Floyd"
   ✅ If found → return
   ❌ Return null

✅ Multiple matches:
   - Prefer exact album name + artist match
   - Fall back to first result
```

---

## Key Design Decisions

### 1. **Modular Services**
Each service (Email, Spotify, Sync) is independent and testable. They can be used individually without the others.

**Rationale**: Easier to test, reuse, and extend. Single responsibility principle.

### 2. **Monthly Playlist Organization**
Emails are grouped by month, creating separate playlists for each month's "10 Best Albums."

**Rationale**: 
- Pitchfork publishes weekly; month grouping is a natural aggregation
- Users can review albums from specific months
- Easier to manage and organize in Spotify

### 3. **Track-based Deduplication**
We add the *first track* of each album, not the entire album. Duplicates are checked by track URI.

**Rationale**:
- Spotify allows partial albums in playlists
- Adding only the first track saves space and is more discoverable
- Deduplication is efficient (single API call per album)

### 4. **Exponential Backoff Retries**
Transient failures (rate limits, timeouts) are retried with exponential backoff (1s, 2s, 4s).

**Rationale**: Respects rate limits, recovers gracefully from temporary failures, doesn't overwhelm API.

### 5. **Batch Processing**
Operations are batched where API limits allow:
- Email fetching: 20 emails per batch
- Track addition: 100 tracks per batch
- Playlist operations: serialized with 200ms delays

**Rationale**: Balances performance with API rate limits.

### 6. **Configuration via Environment**
All credentials and settings are in `.env`, never hardcoded.

**Rationale**: Security (prevents accidental credential leaks), flexibility (different configs for dev/prod), simplicity (single source of truth).

---

## Error Handling Strategy

### Error Types

```javascript
// ConfigError - Invalid configuration
throw new ConfigError('EMAIL_USER is required');

// SpotifyError - Spotify API failures
throw new SpotifyError('Rate limit exceeded', 429);

// EmailError - Email fetching failures
throw new EmailError('IMAP connection failed', uid);

// SyncError - Sync orchestration failures
throw new SyncError('Failed to sync playlist');
```

### Error Recovery

**Retryable Errors**:
- Network timeouts → retry with backoff
- Spotify 429 (rate limit) → retry with backoff
- Transient IMAP failures → retry

**Non-Retryable Errors**:
- Missing credentials → fail immediately
- Invalid OAuth token → require re-authentication
- Malformed input → skip and continue

### Logging Strategy

```javascript
// All errors are logged before throwing
logger.error('Operation failed', {
  operation: 'searchAlbum',
  album: 'Abbey Road',
  error: err.message,
  statusCode: err.statusCode,
  retry: attempt < maxRetries
});

throw new SpotifyError(`Failed: ${err.message}`, err.statusCode);
```

---

## Performance Considerations

### Time Complexity

| Operation | Complexity | Notes |
|-----------|-----------|-------|
| Fetch N emails | O(N) | IMAP batching minimizes round-trips |
| Extract albums | O(N) | Single HTML parse per email |
| Search N albums | O(N log N) | Batched 200ms delays |
| Add N tracks to playlist | O(N/100) | Chunked at 100 per request |
| Dedup tracks | O(N) | Set-based lookup |

### Memory Usage

- Email bodies are streamed, not buffered entirely
- Playlist operations are chunked to avoid large arrays
- Set-based deduplication is efficient O(N) with fast lookups

### API Rate Limits

**Spotify**:
- Search API: No documented limit, but ~60 req/sec observed
- Playlist API: ~10 req/sec observed
- We add 200ms delays between track operations

**IMAP**:
- No rate limit, but connection is limited to one concurrent operation
- We batch operations to minimize round-trips

---

## Testing Strategy

### Unit Tests
Test individual functions in isolation:
- Text utilities (HTML stripping, encoding)
- Date utilities (formatting, calculations)
- Collection utilities (dedup, grouping)
- Album search logic (with mocked API)

### Integration Tests
Test service interactions:
- Email fetching and parsing
- Spotify OAuth flow
- Album search with real API (mocked responses)
- Playlist creation and updates

### End-to-End Tests
Full flow with sandbox/test accounts:
- Fetch actual emails
- Create test playlists
- Verify correct albums are added

### Fixtures
Pre-recorded test data:
- Sample emails (HTML)
- Spotify API responses
- Album extraction test cases

---

## Deployment & Operations

### Running the Application

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your credentials

# OAuth authentication (one-time)
npm run auth

# Run the sync
npm start

# With custom log level
LOG_LEVEL=debug npm start
```

### Monitoring & Logging

```
[INFO] Searching for all matching Pitchfork emails in INBOX...
[INFO] Found 5 matching emails
[INFO] Extracted 47 album-artist pairs
[INFO] Playlist created: Pitchfork Best Albums 2025-01
[INFO] Added: 12 track(s) to "Pitchfork Best Albums 2025-01"
[INFO] Email (UID 1234) moved to "Trash"
```

### Troubleshooting

See `docs/TROUBLESHOOTING.md` for common issues and solutions.

---

## Future Enhancements

- [ ] Scheduled runs (cron, GitHub Actions)
- [ ] Duplicate track removal (entire album, not just first track)
- [ ] Album artwork caching
- [ ] Playlist description updates with week numbers
- [ ] Support for other email providers (Gmail, Outlook)
- [ ] Discord/Slack notifications on sync
- [ ] Web dashboard for playlist management
