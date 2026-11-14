import pandas as pd, re, json, sys, urllib.request
df = pd.read_csv('chordonomicon.csv', low_memory=False)
print('rows', len(df))
print('with spotify song id', df.spotify_song_id.notna().sum(), 'with artist id', df.spotify_artist_id.notna().sum())
g = df.genres.fillna('')
pl = g.str.contains('polish', case=False)
print('polish rows', pl.sum(), 'polish artists', df[pl].spotify_artist_id.nunique())
print(df[pl].genres.str.findall(r"'([^']*polish[^']*)'").explode().value_counts().head(25).to_dict())
def dedupe(ch):
    parts = re.split(r'(<[^>]+>)', ch)
    seen = {}; out = []
    tag = None
    for p in parts:
        p = p.strip()
        if not p: continue
        if p.startswith('<'): tag = p; continue
        key = p
        base = tag.split('_')[0] if tag else ''
        out.append((tag, p))
    return out
avg = df.chords.str.len().mean(); print('avg chord len', avg, 'total MB', df.chords.str.len().sum()/1e6)
# section dedupe estimate: identical section body repeated -> reference
def compact(ch):
    secs = re.findall(r'<([^>]+)>\s*([^<]*)', ch)
    bodies = {}; out=[]
    for t, b in secs:
        b = b.strip()
        if b in bodies: out.append(f'<{t}>={bodies[b]}')
        else: bodies[b]=t; out.append(f'<{t}>{b}')
    return ' '.join(out)
s = df.chords.head(50000).map(compact).str.len().sum()/df.chords.head(50000).str.len().sum()
print('compact ratio', s)
req = urllib.request.Request('https://open.spotify.com/oembed?url=https://open.spotify.com/track/2ffJZ2r8HxI5DHcmf3BO6c', headers={'Origin':'https://ajesionek.github.io','User-Agent':'Mozilla/5.0'})
r = urllib.request.urlopen(req); print('oembed', r.status, r.headers.get('access-control-allow-origin'), r.read()[:300])
