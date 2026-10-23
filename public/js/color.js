// Colour for text: a door's glow as the doors list writes its name, lightened only as far as it
// needs to be readable (WCAG's 4.5:1 for text). Pure, for the tests.

/**
 * The doors list's backgrounds behind a door's name, as style.css paints them over the page: the
 * card (`--panel`, rgba(20, 28, 25, 0.84)) over the page's own (`--bg`, #0b0907), then the link's
 * white wash, 4 % and 10 % when hovered or pointed at in 3D. Tested against style.css.
 */
export const LIST_BACKGROUNDS = ['#1c221f', '#2a302d'];

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (c) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/** Relative luminance (WCAG 2) of '#rrggbb'. */
export function luminance(hex) {
  const [r, g, b] = rgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The contrast ratio of two '#rrggbb' colours, 1 to 21. */
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * `color`, or a tint of it toward white, the least that reads at `ratio` on every one of
 * `backgrounds`.
 */
export function readable(color, backgrounds = LIST_BACKGROUNDS, ratio = 4.5) {
  const c = rgb(color.toLowerCase());
  for (let t = 0; t <= 1; t += 0.02) {
    const tint = toHex(c.map((v) => v + (255 - v) * t));
    if (backgrounds.every((bg) => contrast(tint, bg) >= ratio)) return tint;
  }
  return '#ffffff';
}
