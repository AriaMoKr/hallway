// The hallway's doors, in order: the first is nearest the entrance, on the left, and the next ones
// alternate sides down the hall. Doors past the end of this list are drawn closed.
//
//   id        short, unique, URL-safe; an environment links back with ?from=<id> (README, "Linking back")
//   title     its name, on the plaque beside the door and in the list of doors
//   subtitle  one line under the title on the plaque
//   sign      optional: what kind of place it is, on the sign hanging over the door ("Library");
//             without one the sign shows the title
//   url       where the door leads (absolute, https)
//   preview   optional: a picture seen through the doorway, 2:1 suits best; it must be readable
//             cross-origin (GitHub Pages allows that). Without one the doorway shows the title.
//   color     the doorway's glow, as #rrggbb
export const ENVIRONMENTS = [
  {
    id: 'vrlbry',
    title: 'vrlbry',
    subtitle: 'A candle-lit virtual library: Project Gutenberg, Wikipedia and Wikisource on its shelves',
    sign: 'Library',
    // Opens vrlbry at its place for Kiwix's ZIM of all English Project Gutenberg books (2025-11).
    url: 'https://ariamokr.github.io/vrlbry/?place=%7Egutenberg_en_all_2025-11',
    preview: 'https://ariamokr.github.io/vrlbry/social.jpg',
    color: '#d9b26a',
  },
  {
    id: 'breadboard',
    title: 'Breadboard 8-bit',
    subtitle: "Ben Eater's 8-bit breadboard computer on a table, run live by its simulator",
    sign: 'Workshop',
    // Its VR view; the site's front page (…/breadboard/) is the simulator on a screen.
    url: 'https://ariamokr.github.io/breadboard/vr.html',
    // Rendered by breadboard's `npm run preview-image` for this doorway (hall.js's PICTURE).
    preview: 'https://ariamokr.github.io/breadboard/hallway-preview.jpg',
    // The red of its LEDs, softened.
    color: '#d8543f',
  },
  {
    id: 'music',
    title: 'vrlbry · music',
    subtitle: "vrlbry with Project Gutenberg's Music class on its shelves: scores, writing about music, lessons",
    sign: 'Music Room',
    url: 'https://ariamokr.github.io/music/',
    // No preview yet: its social.jpg is still vrlbry's, so the doorway shows the title.
    color: '#9b86d6',
  },
  {
    // The same as HALLWAY_DOOR in AriaMoKr/outside's public/js/way.js.
    id: 'outside',
    title: 'Outside',
    subtitle: 'A small garden: a lawn, a stream and a pond, a foot bridge, and a bench to read on',
    sign: 'Garden',
    url: 'https://ariamokr.github.io/outside/',
    preview: 'https://ariamokr.github.io/outside/hallway-preview.jpg',
    color: '#9fd07a',
  },
];
