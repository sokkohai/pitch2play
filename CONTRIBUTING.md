# Contributing to Pitchfork Newsletter to Spotify Playlist

Thank you for your interest in contributing to this project! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites

- Node.js 16 or higher
- Git
- A GitHub account

### Development Setup

1. **Fork the repository**
   - Click the "Fork" button on GitHub
   - Clone your fork: `git clone https://github.com/yourusername/pitchfork-newsletter-2-spotify-playlist.git`

2. **Set up the development environment**
   ```bash
   cd pitchfork-newsletter-2-spotify-playlist
   npm install
   cp env.example .env
   # Edit .env with your test credentials
   ```

3. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

## 📝 Development Guidelines

### Code Style

- Use ES6+ features (the project uses ES modules)
- Follow existing code patterns and naming conventions
- Add comments for complex logic
- Keep functions focused and single-purpose

### Testing

- Test your changes with your own email and Spotify account
- Ensure the script handles edge cases gracefully
- Test both the main functionality and the auth flow

### Commit Messages

Use clear, descriptive commit messages:
- `feat: add support for Gmail IMAP`
- `fix: handle missing album artwork gracefully`
- `docs: update README with troubleshooting section`

## 🐛 Reporting Issues

When reporting issues, please include:

1. **Environment information**
   - Node.js version
   - Operating system
   - Email provider (iCloud, Gmail, etc.)

2. **Steps to reproduce**
   - Clear, numbered steps
   - Expected vs actual behavior

3. **Error messages**
   - Full error output
   - Console logs (remove sensitive information)

4. **Additional context**
   - Screenshots if relevant
   - Any workarounds you've found

## 🔧 Types of Contributions

### Bug Fixes
- Fix parsing issues with email content
- Improve error handling
- Fix Spotify API integration problems

### Features
- Support for additional email providers
- Enhanced album search strategies
- Playlist management improvements
- Better logging and monitoring

### Documentation
- Improve README clarity
- Add troubleshooting guides
- Create video tutorials
- Translate documentation

### Code Quality
- Refactor complex functions
- Add type definitions
- Improve test coverage
- Performance optimizations

## 🎯 Areas That Need Help

- **Email Provider Support**: Test with Gmail, Outlook, Yahoo, etc.
- **Album Search**: Improve search accuracy and fallback strategies
- **Error Handling**: Make the script more robust
- **Documentation**: Help users with setup and troubleshooting
- **Testing**: Add automated tests

## 📋 Pull Request Process

1. **Update your fork**
   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   ```

2. **Make your changes**
   - Write clean, well-commented code
   - Test thoroughly
   - Update documentation if needed

3. **Submit a pull request**
   - Provide a clear description of changes
   - Reference any related issues
   - Include screenshots if applicable

4. **Respond to feedback**
   - Address review comments promptly
   - Make requested changes
   - Ask questions if anything is unclear

## 🔒 Security Considerations

- Never commit sensitive information (tokens, passwords, etc.)
- Use environment variables for all credentials
- Be careful when handling user data
- Report security issues privately to the maintainer

## 📞 Getting Help

- **GitHub Issues**: For bug reports and feature requests
- **Discussions**: For questions and general discussion
- **Email**: Contact the maintainer directly for sensitive issues

## 🏆 Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes
- GitHub contributors page

Thank you for contributing to make this project better! 🎵
