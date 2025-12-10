# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-12-19

### Added
- Initial release
- IMAP email fetching support (tested with iCloud)
- HTML email parsing with Cheerio
- Spotify OAuth2 authentication
- Album search with multiple fallback strategies
- Monthly playlist creation and management
- Duplicate prevention
- Email archiving to trash folder
- Comprehensive error handling and logging
- English language support (translated from German)

### Features
- Automatically processes Pitchfork "10 Best Reviewed Albums of the Week" newsletters
- Creates Spotify playlists organized by month
- Handles various album search scenarios
- Robust error recovery and user feedback
- Easy setup with environment variables

### Technical Details
- Node.js ES modules
- IMAP email access
- Spotify Web API integration
- HTML parsing and text extraction
- OAuth2 authentication flow
