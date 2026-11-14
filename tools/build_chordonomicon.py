"""Buduje indeks akordów z bazy Chordonomicon (CC BY-NC 4.0) dla aplikacji.

Wynik: data/cn/<hex dwóch pierwszych znaków ID artysty Spotify>.json
  { "<spotify_artist_id>": [["<spotify_song_id>", "<akordy>", <rok|null>], ...], ... }
Akordy są skrócone: powtórzona sekcja to "<tag>=<tag_wzorca>".
"""
import json, os, re, sys
import pandas as pd

src = sys.argv[1] if len(sys.argv) > 1 else 'chordonomicon.csv'
out_dir = 'data/cn'
df = pd.read_csv(src, low_memory=False, usecols=['chords', 'release_date', 'spotify_song_id', 'spotify_artist_id'])
df = df.dropna(subset=['chords', 'spotify_song_id', 'spotify_artist_id'])

def compact(ch):
    out, seen = [], {}
    for tag, body in re.findall(r'<([^>]+)>\s*([^<]*)', ch):
        body = ' '.join(body.split())
        if body in seen:
            out.append(f'<{tag}>={seen[body]}')
        else:
            seen[body] = tag
            out.append(f'<{tag}>{body}')
    return ' '.join(out) if out else ' '.join(ch.split())

shards = {}
for aid, sid, ch, rd in zip(df.spotify_artist_id, df.spotify_song_id, df.chords, df.release_date):
    key = ''.join(f'{ord(c):02x}' for c in aid[:2])
    year = int(str(rd)[:4]) if isinstance(rd, str) and rd[:4].isdigit() else None
    shards.setdefault(key, {}).setdefault(aid, []).append([sid, compact(ch), year])

os.makedirs(out_dir, exist_ok=True)
for f in os.listdir(out_dir):
    os.remove(os.path.join(out_dir, f))
for key, data in shards.items():
    with open(os.path.join(out_dir, key + '.json'), 'w') as fh:
        json.dump(data, fh, separators=(',', ':'), ensure_ascii=False)
print('songs', len(df), 'artists', df.spotify_artist_id.nunique(), 'shards', len(shards))
