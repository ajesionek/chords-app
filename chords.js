// Teoria akordów: parsowanie, transpozycja, chwyty gitarowe i dźwięki na pianino.

const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const LETTER = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11, H: 11 };

// Interwały (półtony od prymy) dla rozpoznawanych rodzajów akordów.
export const QUALITIES = {
  '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11], sus2: [0, 2, 7], sus4: [0, 5, 7], sus: [0, 5, 7],
  dim: [0, 3, 6], dim7: [0, 3, 6, 9], m7b5: [0, 3, 6, 10], aug: [0, 4, 8],
  '6': [0, 4, 7, 9], m6: [0, 3, 7, 9], '9': [0, 4, 7, 10, 14], add9: [0, 4, 7, 14],
  m9: [0, 3, 7, 10, 14], '5': [0, 7], '7sus4': [0, 5, 7, 10], mmaj7: [0, 3, 7, 11],
};

const QUALITY_ALIASES = {
  min: 'm', mi: 'm', '-': 'm', M7: 'maj7', Maj7: 'maj7', 'Δ': 'maj7', 'Δ7': 'maj7',
  '+': 'aug', o: 'dim', '°': 'dim', 'ø': 'm7b5', 'm7-5': 'm7b5', '0': 'dim',
  '-7': 'm7', min7: 'm7', mi7: 'm7', '2': 'add9', add2: 'add9', '4': 'sus4',
};

function parseRoot(s) {
  const m = /^([A-Ha-h])(#|b)?/.exec(s);
  if (!m) return null;
  const letter = m[1];
  const upper = letter.toUpperCase();
  let acc = m[2] || '';
  let len = m[0].length;
  // Polskie nazwy: fis, cis, es, as, b (= Bb), h (= B). Tylko w piosenkach w notacji polskiej.
  if (!acc && polishInput) {
    const pm = /^(is|es|s)(?!us)/.exec(s.slice(1));
    if (pm && (pm[1] !== 's' || upper === 'A' || upper === 'E') && !(pm[1] === 'es' && (upper === 'A' || upper === 'E'))) {
      acc = pm[1]; len += pm[1].length;
    }
  }
  let pc = LETTER[upper];
  const polishB = upper === 'B' && acc === '' && polishInput;
  if (polishB) pc = 10;
  if (acc === '#' || acc === 'is') pc += 1;
  if (acc === 'b' || acc === 'es' || acc === 's') pc -= 1;
  return {
    pc: (pc + 12) % 12,
    minor: letter !== upper, // mała litera = moll (notacja polska)
    len,
    flat: polishB || acc === 'b' || acc === 'es' || acc === 's',
  };
}

let polishInput = false;
export function setPolishInput(v) { polishInput = v; }

export function parseChord(name) {
  if (!name) return null;
  const raw = name.trim();
  if (!raw || /^(N\.?C\.?|x|-|\|)$/i.test(raw)) return null;
  const [main, bassStr] = raw.split('/');
  const root = parseRoot(main);
  if (!root) return null;
  let q = main.slice(root.len);
  if (QUALITY_ALIASES[q] !== undefined) q = QUALITY_ALIASES[q];
  if (root.minor && !q.startsWith('m')) q = 'm' + q;
  if (root.minor && q.startsWith('maj')) q = 'm' + q;
  // Nieznane rozszerzenia: dopasuj najdłuższy znany prefiks.
  let base = q;
  while (base && QUALITIES[base] === undefined && QUALITIES[QUALITY_ALIASES[base]] === undefined) base = base.slice(0, -1);
  if (QUALITY_ALIASES[base] !== undefined) base = QUALITY_ALIASES[base];
  const bass = bassStr ? parseRoot(bassStr) : null;
  return { root: root.pc, quality: q, base: base || '', bass: bass ? bass.pc : null, flat: root.flat };
}

export function noteName(pc, { flats = false, polish = false } = {}) {
  let n = (flats ? FLAT : SHARP)[((pc % 12) + 12) % 12];
  if (polish) {
    if (n === 'B') n = 'H';
    else if (n === 'Bb') n = 'B';
    else if (n === 'A#') n = 'B';
  }
  return n;
}

export function chordName(c, opts = {}) {
  if (!c) return '';
  const polish = opts.polish;
  let root = noteName(c.root, opts);
  let q = c.quality;
  if (polish && q.startsWith('m') && !q.startsWith('maj')) {
    root = root.toLowerCase();
    q = q.slice(1);
  }
  const bass = c.bass !== null ? '/' + noteName(c.bass, opts) : '';
  return root + q + bass;
}

export function transposeChord(name, steps, opts = {}) {
  const c = parseChord(name);
  if (!c) return name;
  const t = { ...c, root: (c.root + steps + 120) % 12, bass: c.bass === null ? null : (c.bass + steps + 120) % 12 };
  return chordName(t, { flats: opts.flats ?? c.flat, polish: opts.polish });
}

export function chordNotes(c) {
  const iv = QUALITIES[c.base] || QUALITIES[''];
  return iv.map((i) => c.root + i);
}

// ---------- Gitara ----------
// Chwyty otwarte (struny od E6 do E1, -1 = nie grać).
const OPEN = {
  C: [-1, 3, 2, 0, 1, 0], D: [-1, -1, 0, 2, 3, 2], E: [0, 2, 2, 1, 0, 0], F: [1, 3, 3, 2, 1, 1],
  G: [3, 2, 0, 0, 0, 3], A: [-1, 0, 2, 2, 2, 0], Am: [-1, 0, 2, 2, 1, 0], Em: [0, 2, 2, 0, 0, 0],
  Dm: [-1, -1, 0, 2, 3, 1], E7: [0, 2, 0, 1, 0, 0], A7: [-1, 0, 2, 0, 2, 0], D7: [-1, -1, 0, 2, 1, 2],
  G7: [3, 2, 0, 0, 0, 1], C7: [-1, 3, 2, 3, 1, 0], B7: [-1, 2, 1, 2, 0, 2], Am7: [-1, 0, 2, 0, 1, 0],
  Em7: [0, 2, 0, 0, 0, 0], Dm7: [-1, -1, 0, 2, 1, 1], Cmaj7: [-1, 3, 2, 0, 0, 0], Fmaj7: [-1, -1, 3, 2, 1, 0],
  Amaj7: [-1, 0, 2, 1, 2, 0], Dmaj7: [-1, -1, 0, 2, 2, 2], Gmaj7: [3, 2, 0, 0, 0, 2], Emaj7: [0, 2, 1, 1, 0, 0],
  Asus2: [-1, 0, 2, 2, 0, 0], Asus4: [-1, 0, 2, 2, 3, 0], Dsus2: [-1, -1, 0, 2, 3, 0], Dsus4: [-1, -1, 0, 2, 3, 3],
  Esus4: [0, 2, 2, 2, 0, 0], Cadd9: [-1, 3, 2, 0, 3, 0], E5: [0, 2, 2, -1, -1, -1], A5: [-1, 0, 2, 2, -1, -1],
  Bm: [-1, 2, 4, 4, 3, 2], C6: [-1, 3, 2, 2, 1, 0], A6: [-1, 0, 2, 2, 2, 2], E6: [0, 2, 2, 1, 2, 0],
};
// Kształty barré: E (pryma na strunie 6) i A (pryma na strunie 5), względem progu barré.
const E_SHAPE = {
  '': [0, 2, 2, 1, 0, 0], m: [0, 2, 2, 0, 0, 0], '7': [0, 2, 0, 1, 0, 0], m7: [0, 2, 0, 0, 0, 0],
  maj7: [0, -1, 1, 1, 0, -1], sus4: [0, 2, 2, 2, 0, 0], '5': [0, 2, 2, -1, -1, -1], '6': [0, 2, 2, 1, 2, 0],
  m6: [0, 2, 2, 0, 2, 0], '7sus4': [0, 2, 0, 2, 0, 0], '9': [0, 2, 0, 1, 0, 2],
};
const A_SHAPE = {
  '': [-1, 0, 2, 2, 2, 0], m: [-1, 0, 2, 2, 1, 0], '7': [-1, 0, 2, 0, 2, 0], m7: [-1, 0, 2, 0, 1, 0],
  maj7: [-1, 0, 2, 1, 2, 0], sus2: [-1, 0, 2, 2, 0, 0], sus4: [-1, 0, 2, 2, 3, 0], dim: [-1, 0, 1, 2, 1, -1],
  dim7: [-1, 0, 1, 2, 1, 2], m7b5: [-1, 0, 1, 0, 1, -1], aug: [-1, 0, 3, 2, 2, 1], '6': [-1, 0, 2, 2, 2, 2],
  m6: [-1, 0, 2, 2, 1, 2], add9: [-1, 0, 2, 4, 2, 0], '5': [-1, 0, 2, 2, -1, -1], '9': [-1, 0, -1, 0, 0, 0],
  m9: [-1, 0, -2, 0, 0, 0], mmaj7: [-1, 0, 2, 1, 1, 0], '7sus4': [-1, 0, 2, 0, 3, 0],
};

export function guitarShape(c) {
  const q = c.base === 'sus' ? 'sus4' : c.base;
  const key = SHARP[c.root] + q;
  const keyFlat = FLAT[c.root] + q;
  if (OPEN[key]) return OPEN[key];
  if (OPEN[keyFlat]) return OPEN[keyFlat];
  const cands = [];
  if (E_SHAPE[q]) {
    let f = (c.root - 4 + 12) % 12; if (f === 0) f = 12;
    cands.push(E_SHAPE[q].map((x) => (x < 0 ? -1 : x + f)));
  }
  if (A_SHAPE[q]) {
    let f = (c.root - 9 + 12) % 12; if (f === 0) f = 12;
    cands.push(A_SHAPE[q].map((x) => (x === -1 ? -1 : x + f)));
  }
  if (!cands.length) return null;
  const maxFret = (s) => Math.max(...s.filter((x) => x >= 0));
  cands.sort((a, b) => maxFret(a) - maxFret(b));
  return cands[0];
}

export function guitarSVG(c, label) {
  const shape = guitarShape(c);
  const W = 96, H = 118, x0 = 18, y0 = 30, sx = 13, sy = 16, frets = 5;
  let svg = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Chwyt ${label}" class="diagram">`;
  svg += `<text x="${W / 2}" y="13" class="dg-label" text-anchor="middle">${label}</text>`;
  if (!shape) return svg + `<text x="${W / 2}" y="70" text-anchor="middle" class="dg-small">brak chwytu</text></svg>`;
  const played = shape.filter((f) => f > 0);
  const hi = played.length ? Math.max(...played) : 0;
  const lo = played.length ? Math.min(...played) : 0;
  const base = hi <= 5 ? 1 : lo;
  for (let i = 0; i < 6; i++) svg += `<line x1="${x0 + i * sx}" y1="${y0}" x2="${x0 + i * sx}" y2="${y0 + frets * sy}" class="dg-line"/>`;
  for (let j = 0; j <= frets; j++) svg += `<line x1="${x0}" y1="${y0 + j * sy}" x2="${x0 + 5 * sx}" y2="${y0 + j * sy}" class="dg-line${j === 0 && base === 1 ? ' dg-nut' : ''}"/>`;
  if (base > 1) svg += `<text x="${x0 - 5}" y="${y0 + sy * 0.7}" text-anchor="end" class="dg-small">${base}</text>`;
  // Barré: ten sam najniższy próg na kilku strunach od strony basowej.
  const minF = lo;
  const barreStrings = shape.map((f, i) => (f === minF ? i : -1)).filter((i) => i >= 0);
  const isBarre = minF > 0 && barreStrings.length >= 3 && shape.every((f, i) => i < barreStrings[0] || f === -1 || f >= minF);
  if (isBarre) {
    const y = y0 + (minF - base + 0.5) * sy;
    const first = barreStrings[0], last = barreStrings[barreStrings.length - 1];
    svg += `<rect x="${x0 + first * sx - 5}" y="${y - 5}" width="${(last - first) * sx + 10}" height="10" rx="5" class="dg-dot"/>`;
  }
  shape.forEach((f, i) => {
    const x = x0 + i * sx;
    if (f === -1) svg += `<text x="${x}" y="${y0 - 6}" text-anchor="middle" class="dg-small">×</text>`;
    else if (f === 0) svg += `<circle cx="${x}" cy="${y0 - 9}" r="3.5" class="dg-open"/>`;
    else if (!(isBarre && f === minF)) svg += `<circle cx="${x}" cy="${y0 + (f - base + 0.5) * sy}" r="5" class="dg-dot"/>`;
  });
  return svg + '</svg>';
}

// ---------- Pianino ----------
export function pianoSVG(c, label) {
  const notes = chordNotes(c);
  // Pozycje klawiszy od C (dwie oktawy: 0..23). Bas z akordu łamanego w pierwszej oktawie.
  const set = new Set(notes.map((n) => (n > 23 ? n - 12 : n)));
  if (c.bass !== null) set.add(c.bass);
  const whites = [0, 2, 4, 5, 7, 9, 11];
  const blacks = [1, 3, 6, 8, 10];
  const octaves = 2, ww = 12, wh = 52, bw = 8, bh = 32, x0 = 4, y0 = 22;
  const W = x0 * 2 + ww * 7 * octaves;
  let svg = `<svg viewBox="0 0 ${W} ${y0 + wh + 4}" width="${W}" height="${y0 + wh + 4}" role="img" aria-label="Akord ${label} na pianinie" class="diagram">`;
  svg += `<text x="${W / 2}" y="13" class="dg-label" text-anchor="middle">${label}</text>`;
  const on = (abs) => set.has(abs);
  for (let o = 0; o < octaves; o++) {
    whites.forEach((pc, i) => {
      const abs = o * 12 + pc;
      svg += `<rect x="${x0 + (o * 7 + i) * ww}" y="${y0}" width="${ww}" height="${wh}" class="pk-white${on(abs) ? ' pk-on' : ''}"/>`;
    });
  }
  for (let o = 0; o < octaves; o++) {
    blacks.forEach((pc) => {
      const abs = o * 12 + pc;
      const wi = whites.filter((w) => w < pc).length;
      svg += `<rect x="${x0 + (o * 7 + wi) * ww - bw / 2}" y="${y0}" width="${bw}" height="${bh}" class="pk-black${on(abs) ? ' pk-on' : ''}"/>`;
    });
  }
  return svg + '</svg>';
}
