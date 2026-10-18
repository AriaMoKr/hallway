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
];
