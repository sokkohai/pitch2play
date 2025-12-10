import re
import spotipy
from spotipy.oauth2 import SpotifyOAuth
from typing import List, Dict, Set
from config import Config
from logger import setup_logger

logger = setup_logger("pitchfork_pruner")

# Validierung der zentralen Konfiguration
try:
    Config.validate()
except Exception as e:
    logger.error(f"Konfigurationsfehler: {e}")
    raise SystemExit(1)

spotify_config = Config.get_spotify_config()
sp = spotipy.Spotify(auth_manager=SpotifyOAuth(**spotify_config))

PLAYLIST_PREFIX = "pitchfork best albums"  # Lowercase für Vergleich
DATE_PATTERN = r"\d{4}-\d{2}$"  # yyyy-mm

def matches_pitchfork_playlist(name: str) -> bool:
    # Robust: Case-Insensitive, trim, toleranter Regex
    name_s = name.strip().lower()
    if not name_s.startswith(PLAYLIST_PREFIX):
        return False
    # Trenne nach Prefix ab und überprüfe, ob am Ende ein gültiges Datum steht
    parts = name_s[len(PLAYLIST_PREFIX):].strip()
    # Erlaube evtl. führendes Sonderzeichen (Doppelpunkt, Bindestrich, Leerzeichen)
    parts = re.sub(r'^[:\-\–\|]*', '', parts).strip()
    return re.match(DATE_PATTERN, parts) is not None

def get_user_playlists(user_id: str) -> List[Dict]:
    results = sp.user_playlists(user_id, limit=50)
    playlists = results['items']
    while results['next']:
        results = sp.next(results)
        playlists.extend(results['items'])
    return playlists

SPOTIFY_USER_ID = None
try:
    SPOTIFY_USER_ID = sp.me()['id']
    logger.info(f"Angemeldet als: {SPOTIFY_USER_ID}")
except Exception as e:
    logger.error(f"Spotify-Authentifizierung fehlgeschlagen: {e}")
    raise SystemExit(1)

def process_playlist(playlist_id: str):
    logger.info(f"Processing playlist: {playlist_id}")
    tracks = []
    results = sp.playlist_tracks(playlist_id, fields=None, limit=100)
    tracks.extend(results['items'])
    while results['next']:
        results = sp.next(results)
        tracks.extend(results['items'])

    album_first_track: Dict[str, Dict] = {}
    tracks_to_delete: List[Dict] = []
    seen_albums: Set[str] = set()

    for idx, item in enumerate(tracks):
        track = item['track']
        if not track:
            continue
        album_id = track['album']['id']
        track_uri = track['uri']
        if album_id not in album_first_track:
            album_first_track[album_id] = {'idx': idx, 'uri': track_uri}
            seen_albums.add(album_id)
        else:
            tracks_to_delete.append({'uri': track_uri, 'positions': [idx]})
    
    logger.info(f"Tracks to delete: {len(tracks_to_delete)}")
    if tracks_to_delete:
        for i in range(0, len(tracks_to_delete), 100):
            del_chunk = tracks_to_delete[i:i+100]
            sp.playlist_remove_specific_occurrences_of_items(playlist_id, del_chunk)
            logger.info(f"Deleted {len(del_chunk)} tracks from playlist {playlist_id}")
    else:
        logger.info("No duplicate album tracks to delete!")

def add_all_playlists_to_profile():
    """Setze alle Playlists dieses Accounts auf öffentlich (= erscheinen im Profil)"""
    playlists = get_user_playlists(SPOTIFY_USER_ID)
    logger.info(f"Setze {len(playlists)} Playlists auf öffentlich...")
    changed = 0
    for pl in playlists:
        pid = pl['id']
        pname = pl['name']
        current_is_public = pl.get('public', False)
        try:
            # Nur ändern, falls noch nicht öffentlich
            if not current_is_public:
                sp.user_playlist_change_details(SPOTIFY_USER_ID, pid, public=True)
                logger.info(f"→ Öffentlich gemacht: {pname} ({pid})")
                changed += 1
            else:
                logger.info(f"Bereits öffentlich: {pname}")
        except Exception as e:
            logger.error(f"Fehler bei '{pname}': {e}")
    logger.info(f"FERTIG: {changed} Playlists wurden auf öffentlich gestellt.")

def main():
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "make_public":
        add_all_playlists_to_profile()
        return
    playlists = get_user_playlists(SPOTIFY_USER_ID)
    logger.info(f"Alle Playlists gefunden: {len(playlists)}")
    for pl in playlists:
        logger.info(f"Name: '{pl['name']}' | ID: {pl['id']} | Owner: {pl['owner']['id']}")
    pf_playlists = [p for p in playlists if matches_pitchfork_playlist(p['name'])]
    logger.info(f"Pitchfork Playlists gefunden: {len(pf_playlists)}")
    for pl in pf_playlists:
        logger.info(f"Playlist (Match): {pl['name']} ({pl['id']})")
        process_playlist(pl['id'])

if __name__ == "__main__":
    main()
