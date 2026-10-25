// The hallway's doors, in order: the first is nearest the entrance, on the left, and the next ones
// alternate sides down the hall. Doors past the end of this list are drawn closed.
//
//   id        short, unique, URL-safe; an environment links back with ?from=<id> (AriaMoKr/common's
//             README, "Linking back")
//   title     its repository's name, on the plaque beside the door and in the list of doors
//   subtitle  its page's description (<meta name="description">) word for word, under the title
//             on the plaque (which shrinks the text until all of it fits)
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
    subtitle: 'A virtual library: browse and read the books in your ZIM files on bookshelves, in VR or in the browser.',
    sign: 'Library',
    // Opens vrlbry at its place for Kiwix's ZIM of all English Project Gutenberg books (2025-11).
    url: 'https://ariamokr.github.io/vrlbry/?place=%7Egutenberg_en_all_2025-11',
    preview: 'https://ariamokr.github.io/vrlbry/social.jpg',
    color: '#d9b26a',
  },
  {
    id: 'breadboard',
    title: 'breadboard',
    // vr.html's description.
    subtitle: "Ben Eater's 8-bit breadboard computer in VR: the boards on a table, run live by the simulator, and your own breadboard circuits from the sandbox.",
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
    title: 'music',
    subtitle: "A virtual music room: read Project Gutenberg's books on music and hear their scores play, on a gramophone or page by page, in VR or in the browser.",
    sign: 'Music Room',
    url: 'https://ariamokr.github.io/music/',
    preview: 'https://ariamokr.github.io/music/social.jpg',
    color: '#9b86d6',
  },
  {
    // HALLWAY_DOOR in AriaMoKr/outside's public/js/way.js was the same, before the title and
    // subtitle became the repository's name and the page's description.
    id: 'outside',
    title: 'outside',
    subtitle: "A small garden outside one of the hallway's doors: a lawn, a stream and a pond, a foot bridge, and a bench to sit and read on. Walk it in VR on a Meta Quest, on a desktop or on a phone.",
    sign: 'Garden',
    url: 'https://ariamokr.github.io/outside/',
    preview: 'https://ariamokr.github.io/outside/hallway-preview.jpg',
    color: '#9fd07a',
  },
  {
    // Made from AriaMoKr/RoomTemplateEmpty: its public/js/config.js's hallwayDoor() is this entry.
    id: 'art',
    title: 'art',
    subtitle: "An empty room behind the Hallway's door, soon a gallery of art.",
    sign: 'Art Room',
    url: 'https://ariamokr.github.io/art/',
    preview: 'https://ariamokr.github.io/art/hallway-preview.jpg',
    color: '#e08fb0',
  },
  {
    // As art's: from RoomTemplateEmpty, its config.js's hallwayDoor().
    id: 'video',
    title: 'video',
    subtitle: "An empty room behind the Hallway's door, soon a room to watch videos in. Walk it in VR on a Meta Quest, on a desktop or on a phone.",
    sign: 'Screening Room',
    url: 'https://ariamokr.github.io/video/',
    preview: 'https://ariamokr.github.io/video/hallway-preview.jpg',
    color: '#6cb8e0',
  },
];
