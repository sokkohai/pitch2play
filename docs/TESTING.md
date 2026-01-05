# Testing Guidelines

Testing requirements and standards for pitch2play.

## Directory Structure

```
tests/
├── unit/                  ← Unit tests for isolated functions
│   ├── utils/
│   │   ├── text.test.mjs
│   │   ├── date.test.mjs
│   │   └── collection.test.mjs
│   └── services/
│       └── *-*.test.mjs
├── integration/           ← Integration tests for services
│   ├── email-*.test.mjs
│   ├── spotify-*.test.mjs
│   └── end-to-end.test.mjs
└── fixtures/             ← Test data, mocks, samples
    ├── sample-email.html
    ├── spotify-responses.json
    └── test-data.mjs
```

**RULE**: Tests mirror `src/` directory structure.

---

## Test File Naming

```
src/utils/text.mjs              → tests/unit/utils/text.test.mjs
src/services/email/             → tests/unit/services/email-*.test.mjs
src/services/spotify/           → tests/unit/services/spotify-*.test.mjs
Integration tests               → tests/integration/*.test.mjs
```

---

## Unit Test Template

```javascript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { stripHtml, truncate } from '../../../src/utils/text.mjs';

describe('Text utilities', () => {
  describe('stripHtml()', () => {
    it('should remove HTML tags', () => {
      // Arrange
      const input = '<p>hello</p>';
      
      // Act
      const result = stripHtml(input);
      
      // Assert
      expect(result).toBe('hello');
    });

    it('should decode HTML entities', () => {
      // Arrange
      const input = 'Tom &amp; Jerry';
      
      // Act
      const result = stripHtml(input);
      
      // Assert
      expect(result).toBe('Tom & Jerry');
    });

    it('should handle empty input', () => {
      // Arrange & Act & Assert
      expect(stripHtml('')).toBe('');
      expect(stripHtml(null)).toBe('');
    });
  });

  describe('truncate()', () => {
    it('should truncate long strings', () => {
      // Arrange
      const input = 'The quick brown fox jumps over the lazy dog';
      
      // Act
      const result = truncate(input, 15);
      
      // Assert
      expect(result.length).toBeLessThanOrEqual(15);
    });

    it('should not truncate short strings', () => {
      // Arrange
      const input = 'Hello';
      
      // Act
      const result = truncate(input, 20);
      
      // Assert
      expect(result).toBe('Hello');
    });
  });
});
```

---

## Integration Test Template

```javascript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { extractAlbumArtistPairs } from '../../../src/services/email/email-parser.mjs';
import { readFileSync } from 'fs';

describe('Email Parser Integration', () => {
  let sampleEmail;

  beforeEach(() => {
    // Load fixture
    sampleEmail = readFileSync('./tests/fixtures/sample-email.html', 'utf-8');
  });

  afterEach(() => {
    // Cleanup if needed
  });

  describe('extractAlbumArtistPairs()', () => {
    it('should extract album-artist pairs from email', () => {
      // Arrange & Act
      const pairs = extractAlbumArtistPairs(sampleEmail);
      
      // Assert
      expect(pairs.length).toBeGreaterThan(0);
      expect(pairs[0]).toHaveProperty('album');
      expect(pairs[0]).toHaveProperty('artist');
    });

    it('should handle malformed HTML gracefully', () => {
      // Arrange
      const invalidHtml = '<invalid>html';
      
      // Act
      const pairs = extractAlbumArtistPairs(invalidHtml);
      
      // Assert
      expect(Array.isArray(pairs)).toBe(true);
    });
  });
});
```

---

## Python Test Template

```python
import pytest
from unittest.mock import patch, MagicMock
from services.spotify_client import search_album

class TestSpotifyClient:
    @pytest.fixture
    def mock_token(self):
        return 'mock-token-123'
    
    def test_find_exact_album_match(self, mock_token):
        """Test finding exact album match."""
        # Arrange
        album_name = 'Abbey Road'
        artist_name = 'The Beatles'
        
        # Act
        with patch('services.spotify_client.spotify_api') as mock_api:
            mock_api.search.return_value = {'name': 'Abbey Road'}
            result = search_album(album_name, artist_name, mock_token)
        
        # Assert
        assert result is not None
        assert result['name'] == 'Abbey Road'
    
    def test_return_none_if_not_found(self, mock_token):
        """Test returning None when album not found."""
        # Arrange
        with patch('services.spotify_client.spotify_api') as mock_api:
            mock_api.search.return_value = None
            
            # Act
            result = search_album('Nonexistent', 'Unknown', mock_token)
        
        # Assert
        assert result is None
```

---

## Running Tests

### JavaScript

```bash
npm test                      # Run all tests
npm run test:watch          # Watch mode
npm run test:coverage       # With coverage report
npm test -- services/       # Specific path
npm test -- --reporter=verbose
```

### Python

```bash
pytest                        # Run all tests
pytest -v                     # Verbose
pytest --cov=src tests/      # With coverage
pytest tests/unit/           # Specific directory
pytest -k "test_name"        # Run specific test
pytest --pdb                 # Debug mode
```

---

## Coverage Expectations

- **Minimum**: 80% overall coverage
- **Target**: 100% for critical paths (auth, sync)
- **All public functions**: Must have at least 1 test

---

## Test Categories

### Unit Tests
- Test isolated functions
- Mock external dependencies
- Fast execution (<100ms per test)
- No I/O operations

**Examples:**
- Text utilities (HTML stripping, encoding)
- Date utilities (formatting)
- Collection operations (dedup, grouping)
- Error classes

### Integration Tests
- Test service interactions
- Real configurations, mocked APIs
- Medium execution (100ms-1s per test)
- Can test database/API interactions

**Examples:**
- Email fetching and parsing
- Spotify API calls
- Playlist creation
- Album search

### End-to-End Tests
- Full workflow tests
- Can use test accounts
- Slow execution (1s+ per test)
- Test entire feature flows

**Examples:**
- Complete sync flow
- OAuth flow
- Email → Playlist creation

---

## Fixtures

### Sample Email (tests/fixtures/sample-email.html)

```html
<!DOCTYPE html>
<html>
<head><title>10 Best Reviewed Albums of the Week</title></head>
<body>
  <h1>This Week's 10 Best Albums</h1>
  <ul>
    <li>Abbey Road - The Beatles</li>
    <li>Rumours - Fleetwood Mac</li>
  </ul>
</body>
</html>
```

### Test Data (tests/fixtures/test-data.mjs)

```javascript
export const SAMPLE_EMAILS = [
  { uid: 1, from: 'newsletter@pitchfork.com', subject: '10 Best Reviewed Albums of the Week', body: '...' },
  { uid: 2, from: 'newsletter@pitchfork.com', subject: '10 Best Reviewed Albums of the Week', body: '...' },
];

export const SAMPLE_ALBUMS = [
  { name: 'Abbey Road', artist: 'The Beatles', id: 'abc123' },
  { name: 'Rumours', artist: 'Fleetwood Mac', id: 'def456' },
];

export const SPOTIFY_RESPONSES = {
  searchSuccess: { albums: { items: [{ name: 'Abbey Road', id: 'abc123' }] } },
  searchEmpty: { albums: { items: [] } },
};
```

### Mocking Pattern

```javascript
import { vi } from 'vitest';

describe('Search', () => {
  it('should handle API errors', async () => {
    // Mock spotifyApi to throw error
    vi.mock('../../../src/services/spotify/api-client.mjs', () => ({
      spotifyRequest: vi.fn().mockRejectedValueOnce(new Error('API Error'))
    }));
    
    // Test error handling
    expect(() => spotifyRequest(...)).rejects.toThrow('API Error');
  });
});
```

---

## Best Practices

### DO:
- ✅ Write tests as you code
- ✅ Test edge cases (empty, null, invalid)
- ✅ Use descriptive test names
- ✅ Arrange-Act-Assert pattern
- ✅ Test error cases
- ✅ Mock external dependencies
- ✅ Use fixtures for test data
- ✅ Keep tests DRY (don't repeat)

### DON'T:
- ❌ Test implementation details
- ❌ Make tests dependent on each other
- ❌ Test external libraries
- ❌ Use real API calls in tests
- ❌ Ignore test failures
- ❌ Skip tests
- ❌ Make tests flaky (non-deterministic)

---

## Test Naming Conventions

```javascript
// ✅ GOOD: Describes behavior clearly
it('should return null when album not found', () => {});
it('should throw ConfigError when EMAIL_USER is missing', () => {});
it('should strip HTML tags and decode entities', () => {});
it('should handle malformed email gracefully', () => {});

// ❌ BAD: Vague or unclear
it('should work', () => {});
it('test search function', () => {});
it('validation', () => {});
```

---

## Test Isolation

Each test should be independent:

```javascript
// ✅ GOOD: Isolated tests
describe('Email Parser', () => {
  it('should parse valid email', () => {
    const result = parseEmail(VALID_EMAIL);
    expect(result).toBeDefined();
  });

  it('should handle invalid email', () => {
    const result = parseEmail(INVALID_EMAIL);
    expect(result).toBeNull();
  });
});

// ❌ BAD: Dependent tests
describe('Email Parser', () => {
  let email;
  
  it('should load email', () => {
    email = loadEmail();
    expect(email).toBeDefined();
  });
  
  it('should parse email', () => {
    // Depends on previous test!
    const result = parseEmail(email);
    expect(result).toBeDefined();
  });
});
```

---

## Code Coverage Report

View coverage after running tests:

```bash
npm run test:coverage
```

Look for:
- Lines covered
- Branches covered
- Functions covered
- Uncovered lines

Target: >80% overall, 100% for critical paths

---

## Quick Checklist

Before pushing code:

- [ ] All tests pass: `npm test`
- [ ] Coverage >80%: `npm run test:coverage`
- [ ] No console.log in tests
- [ ] No hardcoded test data (use fixtures)
- [ ] Tests are isolated and independent
- [ ] No network calls (mock APIs)
- [ ] Test names are descriptive
- [ ] Edge cases tested
- [ ] Error cases tested
