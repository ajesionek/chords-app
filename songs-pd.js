// Piosenki z domeny publicznej (utwory ludowe i tradycyjne).
// Teksty są tradycyjne, akordy to proste opracowanie przygotowane dla tej aplikacji.
const NOTE = '{comment: Utwór tradycyjny (domena publiczna). Akordy: proste opracowanie aplikacji.}';

export const PD_SONGS = [
  {
    id: 'pd-sto-lat',
    title: 'Sto lat',
    artist: 'Tradycyjna',
    content: `{title: Sto lat}
{artist: Tradycyjna}
{key: C}
${NOTE}

[C]Sto lat, sto lat, niech [G]żyje, żyje [C]nam,
[C]sto lat, sto lat, niech [G]żyje, żyje [C]nam.
Jeszcze [F]raz, jeszcze [C]raz, niech [G]żyje, żyje [C]nam,
niech [G]żyje [C]nam!`,
  },
  {
    id: 'pd-wlazl-kotek',
    title: 'Wlazł kotek na płotek',
    artist: 'Tradycyjna',
    content: `{title: Wlazł kotek na płotek}
{artist: Tradycyjna}
{key: C}
${NOTE}

[C]Wlazł kotek na [G]płotek i [C]mruga,
ładna to pio[G]senka nie[C]długa.
[F]Nie długa, nie [C]krótka, lecz [G]w sam [C]raz,
[F]zaśpiewaj, ko[C]teczku, [G]jeszcze [C]raz.`,
  },
  {
    id: 'pd-panie-janie',
    title: 'Panie Janie',
    artist: 'Tradycyjna',
    content: `{title: Panie Janie}
{artist: Tradycyjna (kanon)}
{key: G}
${NOTE}
{comment: Można śpiewać kanonem: kolejne głosy wchodzą co linijkę.}

[G]Panie Janie, panie Janie,
[G]rano wstań, rano wstań!
[G]Wszystkie dzwony [D]biją, [G]wszystkie dzwony [D]biją,
[G]bim, [D]bam, [G]bom, [G]bim, [D]bam, [G]bom.`,
  },
  {
    id: 'pd-szla-dzieweczka',
    title: 'Szła dzieweczka do laseczka',
    artist: 'Ludowa',
    content: `{title: Szła dzieweczka do laseczka}
{artist: Ludowa}
{key: G}
${NOTE}

[G]Szła dzieweczka [D]do laseczka,
[D]do zielonego, [G]do zielonego, [D]do zielone[G]go.

{start_of_chorus}
[G]Gdzie jest ta ulica, [D]gdzie jest ten dom,
[D]gdzie jest ta dziewczyna, [G]co kocham ją?
[G]Znalazłem ulicę, [D]znalazłem dom,
[D]znalazłem dziewczynę, [G]co kocham ją.
{end_of_chorus}

[G]Napotkała [D]myśliweczka
[D]bardzo szwarnego, [G]bardzo szwarnego, [D]bardzo szwarne[G]go.`,
  },
];

// Legalne źródła nut i akordów z domeny publicznej lub na otwartych licencjach.
export const PD_SOURCES = [
  { name: 'OpenScore', url: 'https://openscore.cc/', desc: 'Edytowalne partytury, licencja CC0 (bez ograniczeń).' },
  { name: 'Mutopia Project', url: 'https://www.mutopiaproject.org/', desc: 'Ok. 2 tys. utworów, ponad 1/3 na pianino. PDF i MIDI, CC BY-SA lub domena publiczna.' },
  { name: 'IMSLP', url: 'https://imslp.org/', desc: 'Największa biblioteka nut z domeny publicznej. Licencję sprawdzaj przy każdym pliku.' },
  { name: 'CPDL', url: 'https://www.cpdl.org/', desc: 'Nuty chóralne z domeny publicznej.' },
  { name: 'Polona', url: 'https://polona.pl/', desc: 'Biblioteka Narodowa: skany starych polskich nut i śpiewników.' },
  { name: 'Wikiźródła', url: 'https://pl.wikisource.org/', desc: 'Teksty polskich pieśni z domeny publicznej (bez akordów).' },
];
