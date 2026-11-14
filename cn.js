// Akordy z bazy Chordonomicon (CC BY-NC 4.0): https://huggingface.co/datasets/ailsntua/Chordonomicon
// Baza zawiera same akordy (bez tekstów) i identyfikatory Spotify. Tytuły pobieramy na bieżąco
// z publicznego oEmbed Spotify, a artystę dopasowujemy przez powiązania w MusicBrainz.

const shardCache = new Map();
const TITLES_KEY = 'akordy.sptitles';
let titleCache = {};
try { titleCache = JSON.parse(localStorage.getItem(TITLES_KEY) || '{}'); } catch { titleCache = {}; }
const saveTitles = () => { try { localStorage.setItem(TITLES_KEY, JSON.stringify(titleCache)); } catch { /* brak miejsca */ } };

export async function spotifyArtistId(mbArtistId, mb) {
  const d = await mb(`artist/${mbArtistId}?inc=url-rels`);
  for (const r of d.relations || []) {
    const m = /open\.spotify\.com\/artist\/([A-Za-z0-9]+)/.exec(r.url?.resource || '');
    if (m) return m[1];
  }
  return null;
}

export async function artistSongs(spotifyArtist) {
  if (!spotifyArtist) return [];
  const key = [...spotifyArtist.slice(0, 2)].map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
  if (!shardCache.has(key)) {
    shardCache.set(key, fetch(`data/cn/${key}.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({})));
  }
  const shard = await shardCache.get(key);
  return (shard[spotifyArtist] || []).map(([sid, chords, year]) => ({ sid, chords, year }));
}

export async function songTitle(sid) {
  if (titleCache[sid] !== undefined) return titleCache[sid];
  try {
    const r = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent('https://open.spotify.com/track/' + sid)}`);
    const t = r.ok ? (await r.json()).title || '' : '';
    titleCache[sid] = t;
    saveTitles();
    return t;
  } catch { return ''; }
}

// Pobiera tytuły po kilka naraz. onEach(song) wywoływane po każdym tytule; zwróć true, by przerwać.
export async function resolveTitles(songs, onEach, parallel = 6) {
  let i = 0, stop = false;
  const worker = async () => {
    while (!stop && i < songs.length) {
      const s = songs[i++];
      s.title = await songTitle(s.sid);
      if (onEach(s)) stop = true;
    }
  };
  await Promise.all(Array.from({ length: parallel }, worker));
}

// "Dziwny jest ten świat - Remastered 2005" -> "dziwny jest ten swiat"
export const baseTitle = (t, norm) => norm((t || '').replace(/\s+[-–]\s+.*$/, '').replace(/\s*[([].*?[)\]]\s*/g, ' '));

const LABELS = {
  intro: 'Intro', verse: 'Zwrotka', chorus: 'Refren', bridge: 'Przejście', prechorus: 'Przed refrenem',
  'pre-chorus': 'Przed refrenem', solo: 'Solo', outro: 'Zakończenie', instrumental: 'Instrumental', interlude: 'Łącznik',
};
const label = (tag) => {
  const m = /^([a-z-]+)_?(\d*)$/.exec(tag);
  if (!m) return tag;
  return ((LABELS[m[1]] || m[1]) + (m[2] ? ' ' + m[2] : '')).trim();
};
// "Csmin7/Gs" -> "C#m7/G#"
const chordName = (tok) => {
  const m = /^([A-G])(s|b)?(.*?)(?:\/([A-G])(s|b)?)?$/.exec(tok);
  if (!m) return tok;
  const q = m[3].replace(/^min/, 'm');
  return m[1] + (m[2] === 's' ? '#' : m[2] || '') + q + (m[4] ? '/' + m[4] + (m[5] === 's' ? '#' : m[5] || '') : '');
};

export function toChordPro(compact, { title, artist, year } = {}) {
  const bodies = {};
  const lines = [`{title: ${title || 'Bez tytułu'}}`, `{artist: ${artist || ''}}`,
    '{comment: Akordy z bazy Chordonomicon (CC BY-NC 4.0), bez tekstu. Skopiuj do „Moich”, żeby dopisać tekst.}'];
  if (year) lines.push(`{comment: Rok: ${year}}`);
  const re = /<([^>]+)>(=?)\s*([^<]*)/g;
  let m, any = false;
  while ((m = re.exec(compact))) {
    any = true;
    const [, tag, isRef, rest] = m;
    const body = isRef ? bodies[rest.trim()] || '' : rest.trim();
    bodies[tag] = body;
    const type = tag.startsWith('chorus') ? 'chorus' : 'verse';
    lines.push('', `{start_of_${type}: ${label(tag)}${isRef ? ` (jak ${label(rest.trim())})` : ''}}`);
    const chords = body.split(/\s+/).filter(Boolean).map(chordName);
    for (let i = 0; i < chords.length; i += 4) lines.push(chords.slice(i, i + 4).map((c) => `[${c}]   `).join(' '));
    lines.push(`{end_of_${type}}`);
  }
  if (!any) {
    const chords = compact.split(/\s+/).filter(Boolean).map(chordName);
    for (let i = 0; i < chords.length; i += 4) lines.push(chords.slice(i, i + 4).map((c) => `[${c}]   `).join(' '));
  }
  return lines.join('\n');
}
