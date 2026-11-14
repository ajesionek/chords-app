# Akordy i nuty (PWA)

Mobilna aplikacja webowa: wyszukiwanie piosenek po tytule, artyście i albumie (MusicBrainz),
linki do legalnych źródeł akordów i nut, własna biblioteka akordów (ChordPro) z transpozycją,
automatycznym przewijaniem i diagramami chwytów na gitarę i pianino, piosenki z domeny publicznej.

Bez kroku budowania: wystarczy serwować ten folder przez HTTPS (np. GitHub Pages).
Lokalnie: `python3 -m http.server 8000` i otwórz http://localhost:8000

Pliki:
- `index.html`, `style.css` – wygląd
- `app.js` – widoki, wyszukiwarka, biblioteka
- `chords.js` – akordy: parsowanie (też notacja polska H/b/fis), transpozycja, chwyty, klawiatura
- `chordpro.js` – parser ChordPro i konwersja „akordy nad tekstem”
- `songs-pd.js` – piosenki tradycyjne i źródła z domeny publicznej
- `sw.js`, `manifest.webmanifest`, ikony – instalacja na telefonie i tryb offline
