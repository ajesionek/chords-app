"""Nazwy wykonawców dla bazy akordów, z otwartych danych MusicBrainz (CC0).

Czyta zrzut JSON artystów MusicBrainz (jeden artysta w linii) ze stdin, wybiera tych,
którzy mają link do Spotify obecny w data/cn, i zapisuje data/browse/artists-<litera>.json:
  [[spotify_id, nazwa, mbid, polski(0/1), liczba_piosenek], ...]
"""
import json, os, re, sys, unicodedata

counts = {}
for f in os.listdir('data/cn'):
    for aid, songs in json.load(open(os.path.join('data/cn', f))).items():
        counts[aid] = len(songs)

def letter(name):
    s = unicodedata.normalize('NFD', name).encode('ascii', 'ignore').decode().upper().lstrip("'\"([. ")
    s = re.sub(r'^THE\s+', '', s)
    return s[0] if s and 'A' <= s[0] <= 'Z' else '#'

out, seen = {}, set()
for line in sys.stdin:
    try:
        a = json.loads(line)
    except ValueError:
        continue
    for r in a.get('relations') or []:
        m = re.search(r'open\.spotify\.com/artist/([A-Za-z0-9]+)', (r.get('url') or {}).get('resource', ''))
        if not m or m.group(1) not in counts or m.group(1) in seen:
            continue
        sid = m.group(1)
        seen.add(sid)
        area = ((a.get('area') or {}).get('name') or '')
        polish = 1 if a.get('country') == 'PL' or area == 'Poland' else 0
        out.setdefault(letter(a['name']), []).append([sid, a['name'], a['id'], polish, counts[sid]])

os.makedirs('data/browse', exist_ok=True)
coll = lambda r: unicodedata.normalize('NFD', re.sub(r'^the\s+', '', r[1], flags=re.I)).lower()
for k, rows in out.items():
    rows.sort(key=coll)
    json.dump(rows, open(f'data/browse/artists-{k}.json', 'w'), ensure_ascii=False, separators=(',', ':'))
total = sum(len(v) for v in out.values())
print('artists matched', total, 'of', len(counts), 'polish', sum(r[3] for v in out.values() for r in v))
