# Troubleshooting Guide

Common issues and their solutions.

---

## Email Setup Issues

### "Email connection failed"

**Symptoms**: Script exits immediately with IMAP connection error.

**Solutions**:
1. **Verify credentials**
   - Email address is correct in `.env`
   - Password is the app-specific password (not your main Apple ID password)
   - For iCloud: Generate a new app-specific password at [appleid.apple.com](https://appleid.apple.com)

2. **Check IMAP is enabled**
   - Log into your iCloud Mail
   - Settings → Forwarding and POP/IMAP
   - Ensure "IMAP access" is enabled

3. **Verify email format**
   ```bash
   # Test the credentials manually (if you know openssl)
   openssl s_client -connect imap.mail.me.com:993
   # Type: a LOGIN your-email@icloud.com your-password
   ```

4. **Check firewall/network**
   - Ensure port 993 is not blocked
   - Try from a different network if possible
   - Check if your ISP blocks IMAP

---

### "No albums found in email"

**Symptoms**: Script finds emails but extracts 0 albums.

**Solutions**:

1. **Verify email subject and sender**
   ```
   Expected From: newsletter@pitchfork.com
   Expected Subject: 10 Best Reviewed Albums of the Week
   ```
   
   Check if Pitchfork changed the format. Look at your actual emails to confirm.

2. **Email might be in a different folder**
   - Check `IMAP_MAILBOX` in `.env`
   - Default is `INBOX`
   - Pitchfork emails might be in a label/folder
   - Try: `IMAP_MAILBOX=All Mail` or `IMAP_MAILBOX=[Gmail]/All Mail`

3. **HTML parsing might be failing**
   - Run with debug logging:
     ```bash
     LOG_LEVEL=debug npm start
     ```
   - Check if album patterns match the HTML structure
   - Pitchfork might have changed their email format

4. **Email encoding issues**
   - Some emails might have unusual encoding
   - Check the raw email source for album data
   - Contact maintainers if the format changed

---

### "Email (UID XXX) has no valid album-artist pairs"

**Symptoms**: One email is skipped during processing.

**Solutions**:

1. **This is expected for some emails**
   - Some Pitchfork emails might have unusual formatting
   - The script logs this as a warning and continues
   - Usually not a problem

2. **If most emails are skipped**
   - Pitchfork might have changed their email format
   - Check a raw email to see the structure
   - Open an issue with the email content (anonymized)

---

## Spotify Setup Issues

### "Spotify authentication failed"

**Symptoms**: OAuth process fails or returns an error.

**Solutions**:

1. **Re-run authentication**
   ```bash
   npm run auth
   ```

2. **Verify Spotify app credentials**
   - Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Check that Client ID and Secret are correct
   - Ensure they're in `.env`

3. **Check redirect URI**
   - In your Spotify app settings, ensure `http://localhost:3000/callback` is listed
   - This must exactly match `SPOTIFY_REDIRECT_URI` in `.env`
   - Restart npm process after changing

4. **Port 3000 is in use**
   - If you have another app on port 3000, the redirect will fail
   - Kill the process:
     ```bash
     lsof -ti:3000 | xargs kill
     ```
   - Or change the port and update Spotify app settings

5. **Browser doesn't open automatically**
   - If the authorization page doesn't open, manually visit:
     ```
     https://accounts.spotify.com/authorize?client_id=YOUR_CLIENT_ID&response_type=code&redirect_uri=http://localhost:3000/callback&scope=playlist-read-private,playlist-modify-private,playlist-modify-public
     ```
   - Replace `YOUR_CLIENT_ID` with your actual client ID

---

### "No SPOTIFY_REFRESH_TOKEN found"

**Symptoms**: Script exits with "Run `npm run auth` once" message.

**Solutions**:

1. **Run authentication**
   ```bash
   npm run auth
   ```
   This will open a browser and add the token to `.env`

2. **Verify token was saved**
   - Check `.env` file
   - Should have `SPOTIFY_REFRESH_TOKEN=AQC...` line
   - Token should be 100+ characters long

3. **Token might be expired**
   - Spotify refresh tokens last for a long time but can expire
   - Delete the `SPOTIFY_REFRESH_TOKEN` line from `.env`
   - Run `npm run auth` again

---

### "Spotify rate limit exceeded"

**Symptoms**: Script fails with 429 error from Spotify.

**Solutions**:

1. **Wait before retrying**
   - The script retries automatically with backoff
   - If it still fails, wait 5-10 minutes and try again

2. **Reduce concurrent requests**
   - Script already spaces out requests with 200ms delays
   - This is working as designed

3. **Check if other apps are using Spotify API**
   - Other devices or scripts might hit rate limits
   - Wait before retrying

---

### "No albums found on Spotify"

**Symptoms**: Albums are extracted from emails but not found on Spotify.

**Solutions**:

1. **Albums might not be on Spotify**
   - Some albums, especially by obscure artists, aren't available
   - Check manually on Spotify.com
   - The script logs which albums couldn't be found

2. **Album name variations**
   - Pitchfork might use different spelling than Spotify
   - Example: "The White Stripes" vs "The White Stripes"
   - The search uses multiple strategies; some close matches might not be caught

3. **Artist name variations**
   - Similar issue as album names
   - Script tries to find "close enough" matches
   - Some might still be missed

4. **Search API limits**
   - Spotify search query is limited to 250 characters
   - Script automatically shortens album/artist names if needed
   - If both are very long, the search might fail

---

## Playlist Issues

### "Playlist created but no tracks added"

**Symptoms**: Empty playlist is created but remains empty.

**Solutions**:

1. **Check if albums exist on Spotify**
   - Look at the debug logs for "No album found for: Artist – Album"
   - Verify albums manually on Spotify.com

2. **Check for duplicates**
   - If all albums were already in the playlist, none are added
   - The script logs "No new tracks to add for..."

3. **Spotify API issues**
   - Try running again later
   - Check for Spotify API status at [status.spotify.com](https://status.spotify.com)

---

### "Playlist created with wrong name"

**Symptoms**: Playlist format is `Pitchfork Best Albums YYYY-MM` but expected something different.

**Solutions**:

1. **This is the intended format**
   - Script groups emails by month
   - Format: `Pitchfork Best Albums 2025-01`
   - You can rename playlists manually in Spotify

2. **If you want a different format**
   - Edit `src/services/spotify/playlist.mjs`
   - Change the playlist naming logic
   - See `DEVELOPMENT.md` for contributing

---

### "Playlists not showing in Spotify profile"

**Symptoms**: Playlists exist but don't appear in your profile.

**Solutions**:

1. **Playlists might be private**
   - The script creates private playlists by default
   - To make them public:
     ```bash
     npm run make-public
     ```

2. **Refresh Spotify**
   - Log out and back into Spotify
   - Try restarting the Spotify app

3. **Playlists are there, just not visible**
   - Private playlists don't appear in your profile
   - They're still accessible in "Your Liked Songs" or library

---

## Track Addition Issues

### "Only added 2 tracks but expected 10"

**Symptoms**: Fewer tracks added than expected.

**Solutions**:

1. **Albums might not have all tracks on Spotify**
   - Script adds only the first track of each album
   - If album is not on Spotify, no tracks are added

2. **Some albums are duplicates**
   - Script deduplicates by track URI
   - Duplicates from previous runs aren't re-added

3. **Album search failed silently**
   - Check logs for "No album found for: Artist – Album"
   - Try searching manually on Spotify

---

### "Getting duplicate tracks in playlist"

**Symptoms**: Same album appears multiple times in the playlist.

**Solutions**:

1. **This shouldn't happen**
   - The script deduplicates by album ID
   - Contact maintainers if you see this

2. **Workaround: Remove duplicates**
   - Run the deduplication script:
     ```bash
     npm run deduplicate
     ```
   - This removes duplicate tracks from all Pitchfork playlists

---

## Performance Issues

### "Script takes too long to run"

**Symptoms**: Script runs for several minutes.

**Solutions**:

1. **This is normal**
   - Email fetching can take time if you have many emails
   - Spotify API requests are rate-limited with delays
   - Typical run: 2-5 minutes for a month of emails

2. **Optimize IMAP search**
   - Ensure `IMAP_MAILBOX=INBOX` (not "All Mail")
   - Pitchfork emails might be in a label; move to INBOX

3. **Check your internet connection**
   - Slow connection = slower API calls
   - Try from a different network

---

### "Running out of memory"

**Symptoms**: Script crashes with "out of memory" error.

**Solutions**:

1. **Increase Node.js memory limit**
   ```bash
   NODE_OPTIONS="--max-old-space-size=4096" npm start
   ```

2. **Process emails in smaller batches**
   - Currently processes all emails in one run
   - Contact maintainers for batch processing feature

---

## Permission Issues

### "Access denied to playlist"

**Symptoms**: Script fails when trying to add tracks to a playlist.

**Solutions**:

1. **Verify Spotify scopes**
   - Run `npm run auth` again
   - Ensure you granted all permissions:
     - Read playlists
     - Modify playlists (private)
     - Modify playlists (public)

2. **Playlist not owned by your account**
   - The script can only modify playlists you own
   - Don't use shared playlists

3. **Token expired**
   - The refresh token might be invalid
   - Run `npm run auth` again

---

## Other Issues

### "IMAP folder not found: Trash"

**Symptoms**: Script fails to move emails to trash.

**Solutions**:

1. **Folder name might be different**
   - iCloud might use different names: "Trash", "Deleted", "[Gmail]/Trash", etc.
   - Check `TRASH_MAILBOX` in `.env`
   - Update to the correct folder name from your email

2. **Create the folder**
   - In your email client, create a folder named "Trash"
   - Or update `TRASH_MAILBOX` to an existing folder

3. **Skip the move**
   - You can ignore this warning
   - Emails will be processed but not moved to trash

---

### "Script failed unexpectedly"

**Symptoms**: Vague error message, unclear what went wrong.

**Solutions**:

1. **Run with debug logging**
   ```bash
   LOG_LEVEL=debug npm start
   ```

2. **Check the full error message**
   - Scroll up in the terminal
   - Copy the error and search GitHub issues

3. **Report the issue**
   - Create a GitHub issue with:
     - Full error message and stack trace
     - Steps to reproduce
     - Your OS and Node.js version
     - Relevant log output

---

## Getting Help

1. **Check this guide** for your specific error
2. **Search existing issues**: https://github.com/sokkohai/pitch2play/issues
3. **Check documentation**: `DEVELOPMENT.md`, `docs/ARCHITECTURE.md`
4. **Create a new issue** with detailed information

When creating an issue, include:
- Error message and stack trace
- Steps to reproduce
- Your OS and Node.js version
- Relevant output from `LOG_LEVEL=debug npm start`
- What you've already tried

---

**Last Updated**: 2025-01-05
