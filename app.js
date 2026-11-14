import { parseChord, chordName, transposeChord, guitarSVG, pianoSVG, setPolishInput } from './chords.js';
import { parseChordPro, chordsIn, chordsOverLyricsToChordPro } from './chordpro.js';
import { PD_SONGS, PD_SOURCES } from './songs-pd.js';

const $ = (s, el = document) => el.querySelector(s);
const view = $('#view');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const enc = encodeURIComponent;

// ---------- Pamięć urządzenia ----------
const store = {
  get(key, def) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch { return def; } },
  set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* brak miejsca lub tryb prywatny */ } },
};
const settings = Object.assign({ notation: 'intl', instrument: 'guitar', fontSize: 18, scrollSpeed: 20 }, store.get('akordy.settings', {}));
const saveSettings = () => store.set('akordy.settings', settings);
const library = {
  all() { return store.get('akordy.library', []); },
  save(list) { store.set('akordy.library', list); },
  get(id) { return this.all().find((s) => s.id === id); },
  upsert(song) {
    const list = this.all();
    const i = list.findIndex((s) => s.id === song.id);
    song.updated = Date.now();
    if (i >= 0) list[i] = song; else list.unshift(song);
    this.save(list);
  },
  remove(id) { this.save(this.all().filter((s) => s.id !== id)); },
};
const favorites = {
  all() { return store.get('akordy.favorites', []); },
  has(key) { return this.all().some((f) => f.key === key); },
  toggle(item) {
    const list = this.all();
    const i = list.findIndex((f) => f.key === item.key);
    if (i >= 0) list.splice(i, 1); else list.unshift(item);
    store.set('akordy.favorites', list);
  },
};
const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, ' ').trim();

// ---------- MusicBrainz ----------
const MB = 'https://musicbrainz.org/ws/2/';
const mbCache = new Map();
let mbLast = 0;
async function mb(path) {
  if (mbCache.has(path)) return mbCache.get(path);
  const wait = Math.max(0, mbLast + 1100 - Date.now()); // limit: 1 zapytanie na sekundę
  mbLast = Date.now() + wait;
  if (wait) await new Promise((r) => setTimeout(r, wait));
  const res = await fetch(MB + path + (path.includes('?') ? '&' : '?') + 'fmt=json', { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(res.status === 503 ? 'Baza MusicBrainz jest chwilowo przeciążona. Spróbuj za chwilę.' : 'Błąd wyszukiwania (' + res.status + ').');
  const data = await res.json();
  mbCache.set(path, data);
  return data;
}
const lucene = (q) => q.replace(/([+\-&|!(){}\[\]^"~*?:\\\/])/g, '\\$1');
const credit = (ac) => (ac || []).map((a) => a.name + (a.joinphrase || '')).join('');

// ---------- Router ----------
const routes = [];
const route = (re, fn) => routes.push([re, fn]);
let cleanup = null;
async function render() {
  if (cleanup) { cleanup(); cleanup = null; }
  const hash = location.hash.slice(1) || '/';
  const [path, qs] = hash.split('?');
  const params = new URLSearchParams(qs || '');
  document.querySelectorAll('.tabbar a').forEach((a) => a.classList.toggle('active', path === a.dataset.path || (a.dataset.path !== '/' && path.startsWith(a.dataset.path))));
  for (const [re, fn] of routes) {
    const m = re.exec(path);
    if (m) { window.scrollTo(0, 0); await fn(params, ...m.slice(1).map(decodeURIComponent)); return; }
  }
  view.innerHTML = '<p class="muted">Nie znaleziono strony.</p>';
}
window.addEventListener('hashchange', render);

// ---------- Widoki ----------
function searchForm(q = '', type = 'all') {
  const types = [['all', 'Wszystko'], ['title', 'Tytuł'], ['artist', 'Artysta'], ['album', 'Album']];
  return `<form class="search" id="searchForm" role="search">
    <input type="search" name="q" value="${esc(q)}" placeholder="Tytuł, artysta lub album…" aria-label="Szukaj" autocomplete="off" enterkeyhint="search" required>
    <button class="btn primary" type="submit">Szukaj</button>
    <div class="chips" role="radiogroup" aria-label="Szukaj w">
      ${types.map(([v, l]) => `<label class="chip"><input type="radio" name="type" value="${v}" ${v === type ? 'checked' : ''}><span>${l}</span></label>`).join('')}
    </div>
  </form>`;
}
function bindSearch() {
  const f = $('#searchForm');
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = f.q.value.trim();
    if (q) location.hash = `/search?q=${enc(q)}&type=${f.type.value}`;
  });
  f.querySelectorAll('input[name=type]').forEach((r) => r.addEventListener('change', () => { if (f.q.value.trim()) f.requestSubmit(); }));
}

route(/^\/$/, () => {
  const lib = library.all().slice(0, 5);
  const favs = favorites.all().slice(0, 8);
  view.innerHTML = `
    <section class="hero">
      <h1>Akordy i nuty</h1>
      <p class="muted">Znajdź piosenkę po tytule, artyście albo albumie i graj na gitarze lub pianinie.</p>
      ${searchForm()}
    </section>
    ${favs.length ? `<section><h2>Ulubione</h2><ul class="list">${favs.map((f) => `<li><a href="#/song?t=${enc(f.title)}&a=${enc(f.artist)}&al=${enc(f.album || '')}"><strong>${esc(f.title)}</strong><span class="muted">${esc(f.artist)}</span></a></li>`).join('')}</ul></section>` : ''}
    <section><h2>Twoje akordy</h2>
      ${lib.length ? `<ul class="list">${lib.map(libItem).join('')}</ul><a class="more" href="#/lib">Cała biblioteka →</a>` : '<p class="muted">Nie masz jeszcze własnych akordów. Znajdź piosenkę i wybierz „Dodaj swoje akordy”, albo <a href="#/edit/new">dodaj od razu</a>.</p>'}
    </section>
    <section><h2>Na dobry początek</h2><ul class="list">${PD_SONGS.map((s) => `<li><a href="#/pd/${s.id}"><strong>${esc(s.title)}</strong><span class="muted">${esc(s.artist)} · domena publiczna</span></a></li>`).join('')}</ul></section>`;
  bindSearch();
  $('#searchForm input[name=q]').focus({ preventScroll: true });
});

const libItem = (s) => `<li><a href="#/lib/${s.id}"><strong>${esc(s.title || 'Bez tytułu')}</strong><span class="muted">${esc(s.artist || '')}</span></a></li>`;

route(/^\/search$/, async (p) => {
  const q = p.get('q') || '';
  const type = p.get('type') || 'all';
  view.innerHTML = `${searchForm(q, type)}<div id="results" aria-live="polite"><p class="muted loading">Szukam…</p></div>`;
  bindSearch();
  const out = $('#results');
  try {
    if (type === 'artist') {
      const d = await mb(`artist?query=${enc('artist:(' + lucene(q) + ')')}&limit=20`);
      const items = d.artists || [];
      out.innerHTML = items.length ? `<ul class="list">${items.map((a) => `<li><a href="#/artist/${a.id}?n=${enc(a.name)}"><strong>${esc(a.name)}</strong><span class="muted">${esc([a.disambiguation, a.country, a['life-span']?.begin?.slice(0, 4)].filter(Boolean).join(' · '))}</span></a></li>`).join('')}</ul>` : noResults(q);
    } else if (type === 'album') {
      const d = await mb(`release-group?query=${enc('releasegroup:(' + lucene(q) + ')')}&limit=20`);
      const items = d['release-groups'] || [];
      out.innerHTML = items.length ? `<ul class="list">${items.map((r) => `<li><a href="#/album/${r.id}"><strong>${esc(r.title)}</strong><span class="muted">${esc(credit(r['artist-credit']))}${r['first-release-date'] ? ' · ' + r['first-release-date'].slice(0, 4) : ''}${r['primary-type'] ? ' · ' + typePl(r['primary-type']) : ''}</span></a></li>`).join('')}</ul>` : noResults(q);
    } else {
      const query = type === 'title' ? 'recording:(' + lucene(q) + ')' : lucene(q);
      const d = await mb(`recording?query=${enc(query)}&limit=40`);
      out.innerHTML = recordingList(d.recordings || [], q);
    }
  } catch (e) {
    out.innerHTML = `<p class="error">${esc(navigator.onLine ? e.message : 'Brak internetu. Wyszukiwarka działa tylko online, ale Twoje akordy są dostępne offline.')}</p>`;
  }
});
const typePl = (t) => ({ Album: 'album', Single: 'singiel', EP: 'EP', Broadcast: 'audycja', Other: 'inne' }[t] || t);
const noResults = (q) => `<p class="muted">Nic nie znaleziono dla „${esc(q)}”. Spróbuj innej pisowni albo wyszukaj w innej kategorii.</p>`;

function recordingList(recs, q) {
  const seen = new Set();
  const items = [];
  for (const r of recs) {
    const artist = credit(r['artist-credit']);
    const key = norm(r.title) + '|' + norm(artist);
    if (seen.has(key)) continue;
    seen.add(key);
    const rel = (r.releases || []).find((x) => x['release-group']?.['primary-type'] === 'Album') || (r.releases || [])[0];
    items.push({ title: r.title, artist, album: rel?.title || '' });
  }
  if (!items.length) return noResults(q);
  return `<ul class="list">${items.map((s) => `<li><a href="#/song?t=${enc(s.title)}&a=${enc(s.artist)}&al=${enc(s.album)}"><strong>${esc(s.title)}</strong><span class="muted">${esc(s.artist)}${s.album ? ' · ' + esc(s.album) : ''}</span></a></li>`).join('')}</ul>`;
}

route(/^\/artist\/([\w-]+)$/, async (p, id) => {
  const name = p.get('n') || '';
  view.innerHTML = `<a class="back" href="javascript:history.back()">← Wróć</a><h1>${esc(name)}</h1>
    <h2>Albumy</h2><div id="albums"><p class="muted loading">Ładuję…</p></div>
    <h2>Piosenki</h2><div id="songs"><p class="muted loading">Ładuję…</p></div>`;
  try {
    const d = await mb(`release-group?artist=${id}&type=album|ep&limit=100`);
    const rgs = (d['release-groups'] || []).filter((r) => !(r['secondary-types'] || []).length)
      .sort((a, b) => (a['first-release-date'] || '9').localeCompare(b['first-release-date'] || '9'));
    $('#albums').innerHTML = rgs.length ? `<ul class="list">${rgs.map((r) => `<li><a href="#/album/${r.id}"><strong>${esc(r.title)}</strong><span class="muted">${esc((r['first-release-date'] || '').slice(0, 4))} · ${typePl(r['primary-type'])}</span></a></li>`).join('')}</ul>` : '<p class="muted">Brak albumów studyjnych w bazie.</p>';
  } catch (e) { $('#albums').innerHTML = `<p class="error">${esc(e.message)}</p>`; }
  try {
    const d = await mb(`recording?query=${enc('arid:' + id + ' AND video:false')}&limit=100`);
    const recs = (d.recordings || []).sort((a, b) => a.title.localeCompare(b.title, 'pl'));
    $('#songs').innerHTML = recordingList(recs, name);
  } catch (e) { $('#songs').innerHTML = `<p class="error">${esc(e.message)}</p>`; }
});

route(/^\/album\/([\w-]+)$/, async (p, id) => {
  view.innerHTML = '<a class="back" href="javascript:history.back()">← Wróć</a><div id="album"><p class="muted loading">Ładuję album…</p></div>';
  try {
    const d = await mb(`release?release-group=${id}&inc=recordings+artist-credits&limit=5`);
    const rel = (d.releases || []).find((r) => r.status === 'Official') || (d.releases || [])[0];
    if (!rel) { $('#album').innerHTML = '<p class="muted">Brak listy utworów w bazie.</p>'; return; }
    const artist = credit(rel['artist-credit']);
    const tracks = (rel.media || []).flatMap((m) => m.tracks || []);
    $('#album').innerHTML = `<h1>${esc(rel.title)}</h1><p class="muted">${esc(artist)}${rel.date ? ' · ' + esc(rel.date.slice(0, 4)) : ''}</p>
      <ol class="list tracks">${tracks.map((t) => {
        const a = credit(t['artist-credit']) || artist;
        return `<li><a href="#/song?t=${enc(t.title)}&a=${enc(a)}&al=${enc(rel.title)}"><strong>${esc(t.title)}</strong>${a !== artist ? `<span class="muted">${esc(a)}</span>` : ''}</a></li>`;
      }).join('')}</ol>`;
  } catch (e) { $('#album').innerHTML = `<p class="error">${esc(e.message)}</p>`; }
});

// Linki do zewnętrznych serwisów: aplikacja nie kopiuje ich treści, tylko prowadzi do wyszukiwania.
function externalLinks(title, artist) {
  const q = `${artist} ${title}`.trim();
  return {
    chords: [
      { name: 'Ultimate Guitar', desc: 'akordy i taby (licencje od wydawców)', url: `https://www.ultimate-guitar.com/search.php?search_type=title&value=${enc(q)}` },
      { name: 'Songsterr', desc: 'taby z odtwarzaczem', url: `https://www.songsterr.com/?pattern=${enc(q)}` },
      { name: 'Chordify', desc: 'akordy rozpoznane z nagrania', url: `https://chordify.net/search/${enc(q)}` },
      { name: 'SongBook Pro', desc: 'polski śpiewnik z licencją ZAiKS (płatny)', url: 'https://songbook.pro/' },
    ],
    sheets: [
      { name: 'Sheet Music Direct', desc: 'nuty cyfrowe do kupienia', url: `https://www.sheetmusicdirect.com/en-US/search?Ntt=${enc(q)}` },
      { name: 'Musicnotes', desc: 'nuty cyfrowe do kupienia', url: `https://www.musicnotes.com/search/go?w=${enc(q)}` },
      { name: 'IMSLP', desc: 'nuty z domeny publicznej', url: `https://imslp.org/index.php?title=Special:Search&search=${enc(q)}` },
      { name: 'Mutopia', desc: 'nuty z domeny publicznej', url: `https://www.mutopiaproject.org/cgibin/make-table.cgi?searchingfor=${enc(title)}` },
    ],
    listen: [
      { name: 'YouTube', desc: 'nagrania i lekcje', url: `https://www.youtube.com/results?search_query=${enc(q)}` },
      { name: 'YouTube: lekcja gitary', desc: 'samouczki', url: `https://www.youtube.com/results?search_query=${enc(q + ' jak zagrać gitara')}` },
      { name: 'YouTube: pianino', desc: 'samouczki', url: `https://www.youtube.com/results?search_query=${enc(q + ' piano tutorial')}` },
    ],
  };
}
const linkList = (items) => `<ul class="links">${items.map((l) => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer"><strong>${esc(l.name)}</strong><span class="muted">${esc(l.desc)}</span><span aria-hidden="true" class="ext">↗</span></a></li>`).join('')}</ul>`;

route(/^\/song$/, (p) => {
  const title = p.get('t') || '', artist = p.get('a') || '', album = p.get('al') || '';
  const nt = norm(title), na = norm(artist);
  const mine = library.all().filter((s) => norm(s.title) === nt && (!na || !s.artist || norm(s.artist) === na));
  const pd = PD_SONGS.filter((s) => norm(s.title) === nt);
  const favKey = nt + '|' + na;
  const L = externalLinks(title, artist);
  view.innerHTML = `
    <a class="back" href="javascript:history.back()">← Wróć</a>
    <div class="song-head"><div><h1>${esc(title)}</h1><p class="muted">${esc(artist)}${album ? ' · ' + esc(album) : ''}</p></div>
      <button class="btn icon" id="fav" aria-pressed="${favorites.has(favKey)}" title="Ulubione">${favorites.has(favKey) ? '★' : '☆'}</button></div>
    <section class="card"><h2>Twoje akordy</h2>
      ${mine.length || pd.length ? `<ul class="list">${mine.map(libItem).join('')}${pd.map((s) => `<li><a href="#/pd/${s.id}"><strong>${esc(s.title)}</strong><span class="muted">domena publiczna</span></a></li>`).join('')}</ul>` : '<p class="muted">Nie masz jeszcze akordów do tej piosenki. Możesz je wpisać albo wkleić: zostaną tylko na tym urządzeniu.</p>'}
      <a class="btn primary" href="#/edit/new?t=${enc(title)}&a=${enc(artist)}&al=${enc(album)}">＋ Dodaj swoje akordy</a>
    </section>
    <section><h2>Akordy i taby</h2>${linkList(L.chords)}</section>
    <section><h2>Nuty</h2>${linkList(L.sheets)}</section>
    <section><h2>Posłuchaj i naucz się</h2>${linkList(L.listen)}</section>
    <p class="fineprint">Linki prowadzą do zewnętrznych serwisów, które odpowiadają za licencje na swoje treści. Ta aplikacja nie kopiuje tekstów ani akordów chronionych prawem autorskim.</p>`;
  $('#fav').addEventListener('click', (e) => {
    favorites.toggle({ key: favKey, title, artist, album });
    const on = favorites.has(favKey);
    e.currentTarget.textContent = on ? '★' : '☆';
    e.currentTarget.setAttribute('aria-pressed', on);
  });
});

route(/^\/lib$/, () => {
  const all = library.all();
  view.innerHTML = `<h1>Moje akordy</h1>
    <p class="muted">Zapisane tylko na tym urządzeniu, działają bez internetu. Nikt inny ich nie widzi.</p>
    <div class="row"><a class="btn primary" href="#/edit/new">＋ Nowa piosenka</a>
      <button class="btn" id="exp" ${all.length ? '' : 'disabled'}>Kopia zapasowa</button>
      <label class="btn">Wczytaj plik<input type="file" id="imp" accept=".json,.cho,.chordpro,.crd,.pro,.txt" multiple hidden></label></div>
    ${importHelp()}
    ${all.length ? `<input type="search" id="filter" class="filter" placeholder="Filtruj…" aria-label="Filtruj bibliotekę"><ul class="list" id="libList">${all.map(libItem).join('')}</ul>` : '<p class="muted">Biblioteka jest pusta.</p>'}`;
  $('#filter')?.addEventListener('input', (e) => {
    const f = norm(e.target.value);
    $('#libList').innerHTML = all.filter((s) => norm(s.title + ' ' + s.artist + ' ' + (s.album || '')).includes(f)).map(libItem).join('');
  });
  bindImportHelp();
  $('#exp')?.addEventListener('click', () => download('moje-akordy.json', JSON.stringify(library.all(), null, 2), 'application/json'));
  $('#imp').addEventListener('change', async (e) => {
    let n = 0;
    for (const file of e.target.files) {
      const text = await file.text();
      if (file.name.endsWith('.json')) {
        try { for (const s of JSON.parse(text)) if (s && s.content) { library.upsert({ ...s, id: s.id || uid() }); n++; } } catch { alertMsg('Nie udało się odczytać pliku ' + file.name); }
      } else {
        const { meta } = parseChordPro(text);
        library.upsert({ id: uid(), title: meta.title || file.name.replace(/\.\w+$/, ''), artist: meta.artist || '', album: meta.album || '', content: text });
        n++;
      }
    }
    render();
    if (n) alertMsg(`Wczytano piosenki: ${n}.`);
  });
});

// ---------- Import akordów z innych stron (na użytek osobisty) ----------
const APP_URL = location.origin + location.pathname;
const BOOKMARKLET = "javascript:(function(){var s=String(getSelection()).trim();if(!s){var b='';document.querySelectorAll('pre').forEach(function(p){var t=p.innerText;if(t.length>b.length)b=t});s=b.trim()}if(!s){alert('Zaznacz tekst z akordami i kliknij zakładkę jeszcze raz.');return}location.href='"
  + APP_URL + "#/import?src='+encodeURIComponent(location.href)+'&t='+encodeURIComponent(document.title)+'&text='+encodeURIComponent(s.slice(0,30000))})();";

function importHelp() {
  return `<details class="help import-help"><summary>Jak dodać akordy z innej strony?</summary>
    <p>Akordy zapisane w aplikacji są tylko dla Ciebie: zostają na tym urządzeniu i nikt inny ich nie widzi.</p>
    <ol>
      <li><strong>Kopiuj i wklej.</strong> Zaznacz akordy z tekstem na dowolnej stronie, skopiuj, potem tu „Nowa piosenka” i „Wklej ze schowka”. Akordy zapisane nad tekstem zamienią się same.</li>
      <li><strong>Udostępnij (Android).</strong> Po zainstalowaniu apki zaznacz tekst na stronie, wybierz „Udostępnij” i „Akordy”.</li>
      <li><strong>Zakładka „Do Akordów” (komputer, Android, iPhone).</strong> Na stronie z akordami kliknij zakładkę, a piosenka otworzy się tu gotowa do zapisu. Bierze zaznaczony tekst albo główny blok z akordami.
        <div class="row"><a class="btn" id="bm" href="#">⤓ Do Akordów</a><button class="btn" id="bmCopy" type="button">Kopiuj kod zakładki</button></div>
        <p class="muted small">Na komputerze przeciągnij przycisk na pasek zakładek. Na telefonie dodaj dowolną stronę do zakładek, edytuj ją i w miejsce adresu wklej skopiowany kod. Potem na stronie z akordami wpisz w pasku adresu „Do Akordów” (Android) albo wybierz zakładkę (iPhone).</p>
        <textarea id="bmCode" class="bm-code" rows="3" readonly hidden></textarea>
      </li>
    </ol></details>`;
}
function bindImportHelp() {
  const bm = $('#bm');
  if (!bm) return;
  bm.setAttribute('href', BOOKMARKLET);
  bm.addEventListener('click', (e) => { e.preventDefault(); alertMsg('Przeciągnij ten przycisk na pasek zakładek albo skopiuj kod.'); });
  $('#bmCopy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(BOOKMARKLET); alertMsg('Skopiowano kod zakładki.'); }
    catch { const t = $('#bmCode'); t.hidden = false; t.value = BOOKMARKLET; t.select(); }
  });
}

// "Dziwny jest ten świat chords by Czesław Niemen @ Ultimate-Guitar.Com" -> tytuł i wykonawca
function guessMeta(pageTitle) {
  const t = (pageTitle || '').replace(/\s*[@|·–—]\s*[^@|·–—]*$/, '').replace(/\b(chords?|tabs?|ukulele|akordy|chwyty|tekst piosenki|tekst|tab)\b/gi, '').replace(/\s{2,}/g, ' ').trim();
  let m = /^(.*)\s+by\s+(.*)$/i.exec(t);
  if (m) return { title: titleCase(m[1]), artist: m[2].trim() };
  m = /^(.*?)\s+[-–]\s+(.*)$/.exec(t);
  if (m) return { artist: m[1].trim(), title: m[2].trim() };
  return { title: t, artist: '' };
}
const titleCase = (s) => (s === s.toUpperCase() ? s.toLowerCase().replace(/^\p{L}/u, (c) => c.toUpperCase()) : s).trim();
const looksLikeChordPro = (t) => /\[[A-Ha-h][^\]\s]{0,8}\][^\n]/.test(t) || /^\s*\{\w+/m.test(t);

route(/^\/import$/, (p) => {
  const text = (p.get('text') || '').trim();
  const src = p.get('src') || p.get('url') || '';
  const meta = guessMeta(p.get('t') || p.get('title') || '');
  if (!text) {
    view.innerHTML = `<h1>Import akordów</h1><p>Nie dostałem tekstu z akordami. Zaznacz na stronie akordy z tekstem i spróbuj jeszcze raz.</p>${src ? `<p class="muted small">Strona: ${esc(src)}</p>` : ''}<a class="btn" href="#/lib">Moje akordy</a>`;
    return;
  }
  const content = looksLikeChordPro(text) ? text : chordsOverLyricsToChordPro(text);
  location.replace(`#/edit/new?t=${enc(meta.title)}&a=${enc(meta.artist)}&src=${enc(src)}&c=${enc(content)}`);
});

route(/^\/pd$/, () => {
  view.innerHTML = `<h1>Domena publiczna</h1>
    <p class="muted">Utwory, z których można korzystać bez ograniczeń, oraz legalne biblioteki nut.</p>
    <section><h2>Śpiewnik w aplikacji</h2><ul class="list">${PD_SONGS.map((s) => `<li><a href="#/pd/${s.id}"><strong>${esc(s.title)}</strong><span class="muted">${esc(s.artist)}</span></a></li>`).join('')}</ul></section>
    <section><h2>Biblioteki nut</h2>${linkList(PD_SOURCES.map((s) => ({ name: s.name, desc: s.desc, url: s.url })))}</section>`;
});

route(/^\/pd\/([\w-]+)$/, (p, id) => {
  const s = PD_SONGS.find((x) => x.id === id);
  if (!s) { view.innerHTML = '<p>Nie ma takiej piosenki.</p>'; return; }
  songViewer(s, { readOnly: true });
});

route(/^\/lib\/([\w-]+)$/, (p, id) => {
  const s = library.get(id);
  if (!s) { view.innerHTML = '<p>Nie ma takiej piosenki. <a href="#/lib">Wróć do biblioteki</a></p>'; return; }
  songViewer(s, { readOnly: false });
});

route(/^\/edit\/([\w-]+)$/, (p, id) => {
  const s = id === 'new'
    ? { id: uid(), title: p.get('t') || '', artist: p.get('a') || '', album: p.get('al') || '', content: p.get('c') || '', src: p.get('src') || '' }
    : (library.get(id) || copyPd(id));
  if (!s) { view.innerHTML = '<p>Nie ma takiej piosenki.</p>'; return; }
  const isNew = !library.get(s.id);
  view.innerHTML = `<a class="back" href="javascript:history.back()">← Anuluj</a>
    <h1>${isNew ? 'Nowe akordy' : 'Edytuj akordy'}</h1>
    <form id="ed" class="editor">
      <label>Tytuł<input name="title" value="${esc(s.title)}" required></label>
      <label>Wykonawca<input name="artist" value="${esc(s.artist)}"></label>
      <label>Album<input name="album" value="${esc(s.album || '')}"></label>
      <label>Akordy i tekst
        <textarea name="content" rows="14" spellcheck="false" placeholder="[C]Sto lat, sto lat, niech [G]żyje, żyje [C]nam">${esc(s.content)}</textarea></label>
      <details class="help"><summary>Jak wpisywać akordy?</summary>
        <p>Wstaw akord w nawiasach kwadratowych przed sylabą: <code>[Am]Idzie [F]rak</code>. Sekcje: <code>{soc}</code> … <code>{eoc}</code> dla refrenu, <code>{c: Zwrotka 2}</code> dla komentarza, <code>{capo: 2}</code> dla kapodastra.</p>
        <p>Możesz też wkleić akordy zapisane nad tekstem (jak w większości śpiewników) i kliknąć „Zamień akordy nad tekstem”. Działa notacja polska (H, a-moll jako „a”).</p></details>
      <div class="row">
        <button type="button" class="btn" id="paste">Wklej ze schowka</button>
        <button type="button" class="btn" id="conv">Zamień akordy nad tekstem</button>
        <button type="submit" class="btn primary">Zapisz</button>
        ${isNew ? '' : '<button type="button" class="btn danger" id="del">Usuń</button>'}
      </div>
    </form>`;
  const f = $('#ed');
  $('#conv').addEventListener('click', () => { f.content.value = chordsOverLyricsToChordPro(f.content.value); });
  $('#paste').addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) return alertMsg('Schowek jest pusty. Skopiuj najpierw akordy ze strony.');
      f.content.value = looksLikeChordPro(text) ? text : chordsOverLyricsToChordPro(text);
    } catch { alertMsg('Przeglądarka nie dała dostępu do schowka. Przytrzymaj pole tekstu i wybierz „Wklej”.'); }
  });
  // Wklejenie do pustego pola: od razu zamień „akordy nad tekstem” na format aplikacji.
  f.content.addEventListener('paste', (e) => {
    const text = e.clipboardData?.getData('text') || '';
    if (f.content.value.trim() || !text || looksLikeChordPro(text)) return;
    e.preventDefault();
    f.content.value = chordsOverLyricsToChordPro(text);
  });
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    library.upsert({ id: s.id, title: f.title.value.trim(), artist: f.artist.value.trim(), album: f.album.value.trim(), content: f.content.value, src: s.src || '' });
    location.replace('#/lib/' + s.id);
  });
  $('#del')?.addEventListener('click', () => {
    if (confirm('Usunąć tę piosenkę z biblioteki?')) { library.remove(s.id); location.replace('#/lib'); }
  });
});

route(/^\/about$/, () => {
  view.innerHTML = `<h1>O aplikacji</h1>
    <p>Wyszukiwarka korzysta z otwartej bazy <a href="https://musicbrainz.org" target="_blank" rel="noopener">MusicBrainz</a> (tytuły, wykonawcy, albumy).</p>
    <p>Teksty i akordy większości popularnych piosenek są chronione prawem autorskim, dlatego aplikacja ich nie kopiuje. Prowadzi do serwisów, które mają licencje, a własne akordy możesz zapisać na swoim urządzeniu na użytek osobisty.</p>
    <p>Piosenki w zakładce „Domena publiczna” to utwory tradycyjne. Diagramy chwytów generuje sama aplikacja.</p>
    <h2>Ustawienia</h2>
    <div class="settings">
      <label>Notacja akordów <select id="notation"><option value="intl">Międzynarodowa (B, Am)</option><option value="pl">Polska (H, a)</option></select></label>
      <label>Diagramy <select id="instr"><option value="guitar">Gitara</option><option value="piano">Pianino</option><option value="both">Gitara i pianino</option><option value="none">Bez diagramów</option></select></label>
    </div>`;
  $('#notation').value = settings.notation;
  $('#instr').value = settings.instrument;
  $('#notation').addEventListener('change', (e) => { settings.notation = e.target.value; saveSettings(); });
  $('#instr').addEventListener('change', (e) => { settings.instrument = e.target.value; saveSettings(); });
});

// ---------- Widok piosenki ----------
function songViewer(song, { readOnly }) {
  const transKey = 'akordy.t.' + song.id;
  let steps = store.get(transKey, 0);
  let flats = false;
  let scrolling = false, raf = 0, lastT = 0, acc = 0;
  // Notacja polska wykrywana z treści: akord H albo mała litera (a, e, d…).
  const detectedPolish = chordsIn(song.content).some((c) => /^(H|[a-h])/.test(c));

  const draw = () => {
    setPolishInput(detectedPolish);
    const polish = settings.notation === 'pl';
    const { meta, sections } = parseChordPro(song.content);
    const tr = (c) => transposeChord(c, steps, { flats: flats || undefined, polish });
    const used = chordsIn(song.content);
    const keyName = meta.key ? tr(meta.key) : '';
    const body = sections.map((sec) => {
      const label = sec.label || { chorus: 'Refren', bridge: 'Przejście', tab: 'Tabulatura' }[sec.type] || '';
      const lines = sec.lines.map((ln) => {
        if (ln.comment !== undefined) return `<div class="cmt">${esc(ln.comment)}</div>`;
        if (ln.tab !== undefined) return `<pre class="tab">${esc(ln.tab)}</pre>`;
        const hasChord = ln.parts.some((p) => p.chord);
        return `<div class="ln${hasChord ? '' : ' nochord'}">${ln.parts.map((p) => `<span class="seg">${hasChord ? `<span class="ch">${p.chord ? esc(tr(p.chord)) : '&nbsp;'}</span>` : ''}<span class="ly">${esc(p.text) || '&nbsp;'}</span></span>`).join('')}</div>`;
      }).join('');
      return `<div class="sec sec-${esc(sec.type)}">${label ? `<div class="sec-label">${esc(label)}</div>` : ''}${lines}</div>`;
    }).join('');
    const diags = settings.instrument === 'none' ? '' : used.map((name) => {
      const c = parseChord(name);
      if (!c) return '';
      const shift = (pc) => (pc === null ? null : (pc + steps + 120) % 12);
      const t = { ...c, root: shift(c.root), bass: shift(c.bass) };
      const label = esc(tr(name));
      return `<div class="dg">${settings.instrument !== 'piano' ? guitarSVG(t, label) : ''}${settings.instrument !== 'guitar' ? pianoSVG(t, label) : ''}</div>`;
    }).join('');
    setPolishInput(false);
    $('#songBody').innerHTML = body;
    $('#songBody').style.fontSize = settings.fontSize + 'px';
    $('#diagrams').innerHTML = diags;
    $('#tval').textContent = (steps > 0 ? '+' : '') + steps;
    $('#keyInfo').textContent = [keyName && 'Tonacja: ' + keyName, meta.capo && 'Kapodaster: ' + meta.capo + ' próg'].filter(Boolean).join(' · ');
    document.querySelectorAll('#instrSeg button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === settings.instrument));
  };

  const { meta } = parseChordPro(song.content);
  view.innerHTML = `
    <a class="back" href="javascript:history.back()">← Wróć</a>
    <div class="song-head"><div><h1>${esc(meta.title || song.title)}</h1><p class="muted">${esc(meta.artist || song.artist || '')}</p><p class="muted small" id="keyInfo"></p>${song.src ? `<p class="small"><a href="${esc(song.src)}" target="_blank" rel="noopener noreferrer">Źródło ↗</a></p>` : ''}</div>
      ${readOnly ? `<a class="btn" href="#/edit/${song.id}" title="Zapisz kopię do edycji">Kopiuj</a>` : `<a class="btn" href="#/edit/${song.id}">Edytuj</a>`}</div>
    <div class="toolbar" role="toolbar" aria-label="Sterowanie">
      <div class="grp" aria-label="Transpozycja"><button class="btn" id="tdown" aria-label="Transponuj w dół">−</button><span class="tval" id="tval">0</span><button class="btn" id="tup" aria-label="Transponuj w górę">+</button><button class="btn" id="tb" aria-pressed="false" title="Krzyżyki/bemole">♯/♭</button></div>
      <div class="grp segm" id="instrSeg" aria-label="Diagramy"><button class="btn" data-v="guitar">Gitara</button><button class="btn" data-v="piano">Pianino</button><button class="btn" data-v="none">Ukryj</button></div>
      <div class="grp" aria-label="Rozmiar tekstu"><button class="btn" id="fdown" aria-label="Mniejszy tekst">A−</button><button class="btn" id="fup" aria-label="Większy tekst">A+</button></div>
      <div class="grp" aria-label="Przewijanie"><label class="speed">Tempo <input type="range" id="speed" min="5" max="80" value="${settings.scrollSpeed}" aria-label="Szybkość przewijania"></label></div>
    </div>
    <div class="diagrams" id="diagrams"></div>
    <article class="song" id="songBody"></article>
    <button class="btn primary fab" id="play" aria-pressed="false" aria-label="Automatyczne przewijanie">▶</button>`;
  draw();

  $('#tup').onclick = () => { steps = (steps + 1) % 12; store.set(transKey, steps); draw(); };
  $('#tdown').onclick = () => { steps = (steps - 1) % 12; store.set(transKey, steps); draw(); };
  $('#tb').onclick = (e) => { flats = !flats; e.currentTarget.setAttribute('aria-pressed', flats); draw(); };
  $('#fup').onclick = () => { settings.fontSize = Math.min(32, settings.fontSize + 2); saveSettings(); draw(); };
  $('#fdown').onclick = () => { settings.fontSize = Math.max(12, settings.fontSize - 2); saveSettings(); draw(); };
  document.querySelectorAll('#instrSeg button').forEach((b) => b.onclick = () => { settings.instrument = b.dataset.v; saveSettings(); draw(); });
  $('#speed').oninput = (e) => { settings.scrollSpeed = +e.target.value; saveSettings(); };
  const step = (t) => {
    if (!scrolling) return;
    if (lastT) {
      acc += ((t - lastT) / 1000) * settings.scrollSpeed;
      const px = Math.floor(acc);
      if (px) { window.scrollBy(0, px); acc -= px; }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) stop();
    }
    lastT = t;
    raf = requestAnimationFrame(step);
  };
  let wakeLock = null;
  const stop = () => { scrolling = false; cancelAnimationFrame(raf); lastT = 0; const b = $('#play'); if (b) { b.textContent = '▶'; b.setAttribute('aria-pressed', 'false'); } wakeLock?.release?.(); wakeLock = null; };
  $('#play').onclick = async (e) => {
    if (scrolling) return stop();
    scrolling = true; e.currentTarget.textContent = '⏸'; e.currentTarget.setAttribute('aria-pressed', 'true');
    try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* ekran może zgasnąć */ }
    raf = requestAnimationFrame(step);
  };
  cleanup = stop;
}

// ---------- Pomocnicze ----------
function copyPd(id) {
  const pd = PD_SONGS.find((x) => x.id === id);
  return pd ? { ...pd, id: uid() } : null;
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function alertMsg(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
// Udostępnianie do aplikacji (Android): ?title=…&text=…&url=…
{
  const q = new URLSearchParams(location.search);
  if (q.has('text') || q.has('url')) {
    let text = q.get('text') || '';
    let src = q.get('url') || '';
    const m = /https?:\/\/\S+\s*$/.exec(text); // Chrome dokleja adres na końcu tekstu
    if (m && !src) { src = m[0].trim(); text = text.slice(0, m.index); }
    history.replaceState(null, '', location.pathname + `#/import?t=${enc(q.get('title') || '')}&src=${enc(src)}&text=${enc(text)}`);
  }
}
render();
