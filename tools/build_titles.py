"""Tytuły piosenek z MusicBrainz (CC0) dla wybranych wykonawców (domyślnie polskich).

Dla każdej piosenki z bazy sprawdza w API MusicBrainz, czy link Spotify do utworu
jest powiązany z nagraniem, i zapisuje tytuł. Wyniki są dopisywane do
data/browse/titles.json ({spotify_song_id: [tytuł, wykonawca, mbid, spotify_artist_id]}), więc kolejne
uruchomienia kontynuują pracę. Limit API: 1 zapytanie na sekundę.
"""
import json, os, sys, time, urllib.parse, urllib.request

UA = 'AkordyApp/0.1 ( https://github.com/ajesionek/chords-app )'
deadline = time.time() + float(sys.argv[1] if len(sys.argv) > 1 else 5 * 3600)
path = 'data/browse/titles.json'
titles = json.load(open(path)) if os.path.exists(path) else {}
missing_path = 'data/browse/titles-missing.json'
missing = set(json.load(open(missing_path))) if os.path.exists(missing_path) else set()

artists = []
for f in sorted(os.listdir('data/browse')):
    if f.startswith('artists-'):
        artists += [r for r in json.load(open(os.path.join('data/browse', f))) if r[3] == 1]
shards = {}
def songs_of(aid):
    key = ''.join(f'{ord(c):02x}' for c in aid[:2])
    if key not in shards:
        shards[key] = json.load(open(f'data/cn/{key}.json'))
    return shards[key].get(aid, [])

def lookup(sid):
    url = 'https://musicbrainz.org/ws/2/url?' + urllib.parse.urlencode({'resource': f'https://open.spotify.com/track/{sid}', 'inc': 'recording-rels', 'fmt': 'json'})
    for _ in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=30) as r:
                d = json.load(r)
            for rel in d.get('relations') or []:
                if rel.get('recording'):
                    return rel['recording']['title']
            return None
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            time.sleep(5)
        except Exception:
            time.sleep(5)
    return None

done = 0
for sid_artist, name, mbid, pl, n in artists:
    for sid, _, _ in songs_of(sid_artist):
        if time.time() > deadline:
            break
        if sid in titles or sid in missing:
            continue
        t = lookup(sid)
        if t:
            titles[sid] = [t, name, mbid, sid_artist]
        else:
            missing.add(sid)
        done += 1
        time.sleep(1.05)
json.dump(titles, open(path, 'w'), ensure_ascii=False, separators=(',', ':'))
json.dump(sorted(missing), open(missing_path, 'w'), separators=(',', ':'))
print('checked', done, 'titles', len(titles), 'missing', len(missing))
