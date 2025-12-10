# Pitchfork Newsletter to Spotify Playlist

Automatically creates Spotify playlists from Pitchfork's "10 Best Reviewed Albums of the Week" newsletter emails.

## 🎵 Features

- **Automated Email Processing**: Connects to your email (iCloud IMAP) to fetch Pitchfork newsletters
- **Smart Album Detection**: Parses newsletter content to extract album and artist information
- **Spotify Integration**: Automatically creates and updates Spotify playlists with discovered albums
- **Flexible Search**: Uses multiple search strategies to find albums on Spotify
- **Duplicate Prevention**: Avoids adding the same album multiple times
- **Error Handling**: Comprehensive logging and error recovery

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ 
- Spotify Developer Account
- Email account with IMAP access (tested with iCloud)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/pitchfork-newsletter-2-spotify-playlist.git
   cd pitchfork-newsletter-2-spotify-playlist
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` with your credentials:
   ```env
   # Email Configuration (iCloud IMAP)
   EMAIL_USER=your-email@icloud.com
   EMAIL_PASS=your-app-specific-password
   TRASH_MAILBOX=Trash
   IMAP_MAILBOX=INBOX

   # Spotify OAuth2
   SPOTIFY_CLIENT_ID=your-spotify-client-id
   SPOTIFY_CLIENT_SECRET=your-spotify-client-secret
   SPOTIFY_REDIRECT_URI=http://localhost:3000/callback
   ```

4. **Set up Spotify OAuth**
   ```bash
   npm run auth
   ```
   
   This will open a browser window for Spotify authorization. After completing the flow, your refresh token will be automatically added to `.env`.

### Usage

**Run the playlist creator:**
```bash
npm start
```

**Manual authorization (if needed):**
```bash
npm run auth
```

## 📧 Email Setup

### iCloud Mail Setup

1. Enable 2-Factor Authentication on your Apple ID
2. Generate an App-Specific Password:
   - Go to [appleid.apple.com](https://appleid.apple.com)
   - Sign in → App-Specific Passwords → Generate Password
   - Use this password in `EMAIL_PASS`

### Other Email Providers

The script uses IMAP, so it should work with most email providers. Update the IMAP settings in the code if needed.

## 🎵 Spotify Setup

1. **Create a Spotify App:**
   - Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Create a new app
   - Note your Client ID and Client Secret

2. **Set Redirect URI:**
   - In your Spotify app settings, add `http://localhost:3000/callback`
   - This matches the `SPOTIFY_REDIRECT_URI` in your `.env`

## 🔧 Configuration

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `EMAIL_USER` | Your email address | `user@icloud.com` |
| `EMAIL_PASS` | App-specific password | `abcd-efgh-ijkl-mnop` |
| `TRASH_MAILBOX` | Trash folder name | `Trash` |
| `IMAP_MAILBOX` | Inbox folder name | `INBOX` |
| `SPOTIFY_CLIENT_ID` | Spotify app client ID | `1234567890abcdef...` |
| `SPOTIFY_CLIENT_SECRET` | Spotify app secret | `abcdef1234567890...` |
| `SPOTIFY_REDIRECT_URI` | OAuth redirect URI | `http://localhost:3000/callback` |
| `SPOTIFY_REFRESH_TOKEN` | Auto-generated during auth | `AQC...` |

### Playlist Naming

Playlists are automatically named using the format:
```
Pitchfork Best Albums - YYYY-MM-DD
```

## 🛠️ How It Works

1. **Email Fetching**: Connects to your email via IMAP and searches for Pitchfork newsletters
2. **Content Parsing**: Extracts album and artist information from HTML email content
3. **Spotify Search**: Uses multiple search strategies to find albums on Spotify
4. **Playlist Creation**: Creates a new playlist or updates an existing one
5. **Album Addition**: Adds found albums to the playlist, avoiding duplicates

## 📝 Logging

The script provides detailed logging:
- Email connection status
- Albums found and processed
- Spotify search results
- Playlist creation/update status
- Error messages and warnings

## 🚨 Troubleshooting

### Common Issues

**"No albums found in email"**
- Check if the email subject matches exactly: "10 Best Reviewed Albums of the Week"
- Verify the email is from `newsletter@pitchfork.com`

**"Spotify authentication failed"**
- Run `npm run auth` to re-authenticate
- Check your Spotify app credentials

**"Email connection failed"**
- Verify your email credentials
- For iCloud, ensure you're using an app-specific password
- Check if IMAP is enabled for your email account

**"No albums found on Spotify"**
- Some albums might not be available on Spotify
- The script will log which albums couldn't be found

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Commit your changes: `git commit -m 'Add some feature'`
5. Push to the branch: `git push origin feature-name`
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

This tool is for personal use only. Please respect Spotify's Terms of Service and Pitchfork's content policies. The authors are not responsible for any misuse of this software.

## 🙏 Acknowledgments

- Pitchfork for their excellent music journalism
- Spotify for their comprehensive API
- The open-source community for the amazing tools that made this possible
