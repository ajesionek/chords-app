// Prosty parser formatu ChordPro (https://www.chordpro.org).
// Obsługuje: {title}, {artist}, {album}, {key}, {capo}, {comment}/{c},
// {start_of_chorus}/{soc}, {end_of_chorus}/{eoc}, {start_of_verse}/{sov}, {eov},
// {start_of_tab}/{sot}, {eot}, oraz akordy w nawiasach kwadratowych: [Am]tekst.

const ALIASES = {
  t: 'title', st: 'subtitle', c: 'comment', ci: 'comment', soc: 'start_of_chorus', eoc: 'end_of_chorus',
  sov: 'start_of_verse', eov: 'end_of_verse', sot: 'start_of_tab', eot: 'end_of_tab',
  sob: 'start_of_bridge', eob: 'end_of_bridge', comment_italic: 'comment',
};

export function parseChordPro(text) {
  const meta = {};
  const sections = [];
  let cur = { type: 'verse', label: '', lines: [] };
  const push = () => { if (cur.lines.length) sections.push(cur); };
  for (const rawLine of (text || '').replace(/\r/g, '').split('\n')) {
    const line = rawLine.replace(/\s+$/, '');
    const dir = /^\s*\{([^}:]+)(?::\s*([^}]*))?\}\s*$/.exec(line);
    if (dir) {
      let name = dir[1].trim().toLowerCase();
      name = ALIASES[name] || name;
      const val = (dir[2] || '').trim();
      const start = /^start_of_(\w+)$/.exec(name);
      const end = /^end_of_(\w+)$/.exec(name);
      if (start) {
        push();
        cur = { type: start[1], label: val, lines: [] };
      } else if (end) {
        push();
        cur = { type: 'verse', label: '', lines: [] };
      } else if (name === 'comment') {
        cur.lines.push({ comment: val });
      } else {
        meta[name] = val;
      }
      continue;
    }
    if (/^\s*#/.test(line)) continue;
    if (cur.type === 'tab') { cur.lines.push({ tab: line }); continue; }
    if (line.trim() === '') {
      if (cur.lines.length) { push(); cur = { type: cur.type, label: '', lines: [] }; }
      continue;
    }
    cur.lines.push({ parts: splitChords(line) });
  }
  push();
  return { meta, sections };
}

// "[C]Sto lat, [G]sto lat" -> [{chord:'C', text:'Sto lat, '}, {chord:'G', text:'sto lat'}]
export function splitChords(line) {
  const parts = [];
  const re = /\[([^\]]*)\]/g;
  let last = 0, m, chord = null;
  while ((m = re.exec(line))) {
    const text = line.slice(last, m.index);
    if (text || chord !== null) parts.push({ chord, text });
    chord = m[1];
    last = re.lastIndex;
  }
  const tail = line.slice(last);
  if (tail || chord !== null) parts.push({ chord, text: tail });
  return parts;
}

export function chordsIn(text) {
  const out = [];
  const seen = new Set();
  for (const m of (text || '').matchAll(/\[([^\]]+)\]/g)) {
    const c = m[1].trim();
    if (!seen.has(c)) { seen.add(c); out.push(c); }
  }
  return out;
}

// Zamienia "akordy nad tekstem" (popularny format w internecie) na ChordPro.
export function chordsOverLyricsToChordPro(text) {
  const lines = text.replace(/\r/g, '').split('\n');
  const isChordLine = (l) => {
    const toks = l.trim().split(/\s+/).filter(Boolean);
    if (!toks.length) return false;
    return toks.every((t) => /^\(?[A-Ha-h](#|b|is|es)?[a-zA-Z0-9+°ø#b()\-]*(\/[A-Ha-h](#|b)?)?\)?$/.test(t) || /^[|x\-]+$/.test(t));
  };
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (isChordLine(l) && i + 1 < lines.length && lines[i + 1].trim() && !isChordLine(lines[i + 1])) {
      const lyric = lines[i + 1];
      const positions = [];
      for (const m of l.matchAll(/\S+/g)) positions.push([m.index, m[0]]);
      let res = '', prev = 0;
      const padded = lyric.padEnd(Math.max(lyric.length, (positions.at(-1)?.[0] || 0)), ' ');
      for (const [pos, ch] of positions) {
        res += padded.slice(prev, pos) + `[${ch}]`;
        prev = pos;
      }
      res += padded.slice(prev);
      out.push(res.replace(/\s+$/, ''));
      i++;
    } else if (isChordLine(l)) {
      out.push(l.trim().split(/\s+/).map((c) => `[${c}]`).join(' '));
    } else {
      out.push(l);
    }
  }
  return out.join('\n');
}
