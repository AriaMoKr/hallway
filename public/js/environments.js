// The hallway's doors, in order: the first is nearest the entrance, on the left, and the next ones
// alternate sides down the hall. Doors past the end of this list are drawn closed.
//
//   id        short, unique, URL-safe; an environment links back with ?from=<id> (README, "Linking back")
//   title     the name on the door's signs
//   subtitle  one line under the title on the plaque beside the door
//   url       where the door leads (absolute, https)
//   preview   optional: a picture seen through the doorway, 2:1 suits best; it must be readable
//             cross-origin (GitHub Pages allows that). Without one the doorway shows the title.
//   color     the doorway's glow, as #rrggbb
export const ENVIRONMENTS = [
  {
    id: 'vrlbry',
    title: 'vrlbry',
    subtitle: 'A candle-lit virtual library: Project Gutenberg, Wikipedia and Wikisource on its shelves',
    url: 'https://ariamokr.github.io/vrlbry/',
    preview: 'https://ariamokr.github.io/vrlbry/social.jpg',
    color: '#d9b26a',
  },
];
