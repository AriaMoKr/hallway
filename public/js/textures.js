// Canvas textures painted at start-up: the hall's surfaces, the signs and the view out of the
// window. Painted once each, small enough to take a few milliseconds.
import * as THREE from 'three';
import { SUN_DIR, skyColor } from 'common/sky.js';

export const SERIF = '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Noto Serif", serif';
export const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", sans-serif';
export const GOLD = '#e0bb72';
const ENAMEL = '#14231f';

let anisotropy = 1;
export function setAnisotropy(n) {
  anisotropy = n;
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** A seeded random number generator (mulberry32), so the hall looks the same on every visit. */
export function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function texture(c, { wrapS = false, wrapT = false } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (wrapS) t.wrapS = THREE.RepeatWrapping;
  if (wrapT) t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = anisotropy;
  return t;
}

/** Soft blotches, for stone and plaster. */
function clouds(g, r, x0, y0, w, h, count, rgb, alpha, size) {
  for (let k = 0; k < count; k++) {
    const cx = x0 + r() * w, cy = y0 + r() * h, rad = size * (0.3 + r());
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
    grad.addColorStop(0, `rgba(${rgb},${alpha * (0.5 + r())})`);
    grad.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = grad;
    g.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
  }
}

function speckle(g, r, x0, y0, w, h, count, rgb, alpha) {
  for (let k = 0; k < count; k++) {
    g.fillStyle = `rgba(${rgb},${alpha * r()})`;
    g.fillRect(x0 + r() * w, y0 + r() * h, 1 + r() * 2, 1 + r() * 2);
  }
}

/** The floor: a checkerboard of cream and green-black marble, 0.5 m tiles; the canvas is 1 m square. */
export function floorTexture() {
  const S = 1024, T = S / 2;
  const c = canvas(S, S), g = c.getContext('2d'), r = rng(11);
  for (let ty = 0; ty < 2; ty++) {
    for (let tx = 0; tx < 2; tx++) {
      const dark = (tx + ty) % 2 === 1;
      const x0 = tx * T, y0 = ty * T;
      g.save();
      g.beginPath();
      g.rect(x0, y0, T, T);
      g.clip();
      const base = g.createLinearGradient(x0, y0, x0 + T, y0 + T);
      base.addColorStop(0, dark ? '#29342f' : '#ebe2cd');
      base.addColorStop(1, dark ? '#1c2522' : '#dccfb5');
      g.fillStyle = base;
      g.fillRect(x0, y0, T, T);
      clouds(g, r, x0 - 60, y0 - 60, T + 120, T + 120, 26, dark ? '92,116,104' : '168,146,112', 0.07, 120);
      // Veins: wandering lines, a faint wide one under a sharper thin one.
      for (let k = 0; k < 5; k++) {
        let px = x0 + r() * T, py = y0 - 30;
        const pts = [[px, py]];
        while (py < y0 + T + 30) {
          px += (r() - 0.5) * 150;
          py += 50 + r() * 70;
          pts.push([px, py]);
        }
        for (const [w, a] of [[5 + r() * 5, 0.05], [0.8 + r() * 1.4, 0.18 + r() * 0.16]]) {
          g.strokeStyle = dark ? `rgba(205,214,200,${a})` : `rgba(122,100,76,${a})`;
          g.lineWidth = w;
          g.beginPath();
          g.moveTo(pts[0][0], pts[0][1]);
          for (let i = 1; i < pts.length; i++) {
            const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
            g.quadraticCurveTo(ax + (r() - 0.5) * 60, (ay + by) / 2, bx, by);
          }
          g.stroke();
        }
      }
      speckle(g, r, x0, y0, T, T, 900, dark ? '220,230,220' : '90,70,50', 0.12);
      // A bevel: light along the top and left edges, shade along the bottom and right.
      g.fillStyle = 'rgba(255,250,235,0.10)';
      g.fillRect(x0, y0, T, 6);
      g.fillRect(x0, y0, 6, T);
      g.fillStyle = 'rgba(0,0,0,0.16)';
      g.fillRect(x0, y0 + T - 6, T, 6);
      g.fillRect(x0 + T - 6, y0, 6, T);
      g.restore();
    }
  }
  // Grout along every tile edge (the canvas repeats, so its own edges count as half of one).
  g.fillStyle = 'rgba(40,32,24,0.9)';
  for (const p of [0, T]) {
    g.fillRect(p - 2, 0, 4, S);
    g.fillRect(0, p - 2, S, 4);
  }
  g.fillRect(S - 2, 0, 2, S);
  g.fillRect(0, S - 2, S, 2);
  return texture(c, { wrapS: true, wrapT: true });
}

/**
 * The side and end walls: 1.6 m wide (repeating), the whole 3.2 m height. Striped paper above a
 * walnut wainscot of raised panels, a chair rail at 1 m, a skirting board and a cornice.
 */
export function wallTexture(height) {
  const W = 512, H = 1024, px = H / height;
  const c = canvas(W, H), g = c.getContext('2d'), r = rng(5);
  const yOf = (m) => H - m * px; // the canvas row of a height in metres
  const rail = yOf(1.0);
  // Paper.
  g.fillStyle = '#8e9c7d';
  g.fillRect(0, 0, W, rail);
  for (let x = 0; x < W; x += 64) {
    g.fillStyle = 'rgba(64,84,58,0.20)';
    g.fillRect(x + 18, 0, 28, rail);
    g.fillStyle = 'rgba(226,190,120,0.30)';
    g.fillRect(x + 31, 0, 2, rail);
  }
  clouds(g, r, 0, 0, W, rail, 40, '60,70,50', 0.05, 90);
  speckle(g, r, 0, 0, W, rail, 1500, '40,50,35', 0.10);
  // Cornice.
  const top = yOf(height - 0.14);
  const corn = g.createLinearGradient(0, 0, 0, top);
  corn.addColorStop(0, '#e9dfc9');
  corn.addColorStop(0.55, '#d7cab0');
  corn.addColorStop(0.75, '#f1e8d6');
  corn.addColorStop(1, '#b9aa8c');
  g.fillStyle = corn;
  g.fillRect(0, 0, W, top);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(0, top, W, 4);
  // Wainscot.
  const wood = g.createLinearGradient(0, rail, 0, H);
  wood.addColorStop(0, '#553522');
  wood.addColorStop(1, '#43291a');
  g.fillStyle = wood;
  g.fillRect(0, rail, W, H - rail);
  for (let k = 0; k < 140; k++) {
    g.fillStyle = `rgba(${r() < 0.5 ? '30,16,8' : '120,80,50'},${0.12 * r()})`;
    g.fillRect(r() * W, rail, 1 + r() * 2, H - rail);
  }
  // Two raised panels per repeat, each 0.8 m wide.
  const pTop = yOf(0.86), pBottom = yOf(0.24);
  for (let p = 0; p < 2; p++) {
    const x0 = p * (W / 2) + 24, x1 = (p + 1) * (W / 2) - 24;
    g.fillStyle = 'rgba(255,214,170,0.07)';
    g.fillRect(x0, pTop, x1 - x0, pBottom - pTop);
    g.fillStyle = 'rgba(255,222,180,0.22)';
    g.fillRect(x0, pTop, x1 - x0, 4);
    g.fillRect(x0, pTop, 4, pBottom - pTop);
    g.fillStyle = 'rgba(0,0,0,0.38)';
    g.fillRect(x0, pBottom - 4, x1 - x0, 4);
    g.fillRect(x1 - 4, pTop, 4, pBottom - pTop);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(x0 + 14, pTop + 14, x1 - x0 - 28, 3);
    g.fillRect(x0 + 14, pTop + 14, 3, pBottom - pTop - 28);
    g.fillStyle = 'rgba(255,222,180,0.10)';
    g.fillRect(x0 + 14, pBottom - 17, x1 - x0 - 28, 3);
    g.fillRect(x1 - 17, pTop + 14, 3, pBottom - pTop - 28);
  }
  // Chair rail.
  const cr = g.createLinearGradient(0, rail - 10, 0, rail + 14);
  cr.addColorStop(0, '#7a5034');
  cr.addColorStop(0.35, '#9a6a45');
  cr.addColorStop(1, '#3a2315');
  g.fillStyle = cr;
  g.fillRect(0, rail - 10, W, 24);
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.fillRect(0, rail + 14, W, 4);
  // Skirting.
  const sk = yOf(0.16);
  g.fillStyle = '#2f1d12';
  g.fillRect(0, sk, W, H - sk);
  g.fillStyle = 'rgba(255,214,170,0.18)';
  g.fillRect(0, sk, W, 3);
  return texture(c, { wrapS: true });
}

/** The ceiling: warm plaster, 2 m square, repeating. */
export function ceilingTexture() {
  const S = 512;
  const c = canvas(S, S), g = c.getContext('2d'), r = rng(3);
  g.fillStyle = '#ece3d0';
  g.fillRect(0, 0, S, S);
  clouds(g, r, -50, -50, S + 100, S + 100, 30, '170,150,120', 0.05, 110);
  speckle(g, r, 0, 0, S, S, 900, '120,100,80', 0.08);
  return texture(c, { wrapS: true, wrapT: true });
}

/** A closed door: six raised panels in dark wood, for a 1.1 × 2.25 m slab. */
export function doorTexture() {
  const W = 256, H = 512;
  const c = canvas(W, H), g = c.getContext('2d'), r = rng(9);
  g.fillStyle = '#5a3923';
  g.fillRect(0, 0, W, H);
  for (let k = 0; k < 90; k++) {
    g.fillStyle = `rgba(${r() < 0.5 ? '28,14,6' : '130,88,56'},${0.14 * r()})`;
    g.fillRect(r() * W, 0, 1 + r() * 2, H);
  }
  const cols = [[22, 120], [136, 234]];
  const rows = [[26, 168], [190, 312], [334, 486]];
  for (const [x0, x1] of cols) {
    for (const [y0, y1] of rows) {
      g.fillStyle = 'rgba(255,210,160,0.06)';
      g.fillRect(x0, y0, x1 - x0, y1 - y0);
      g.fillStyle = 'rgba(255,220,180,0.22)';
      g.fillRect(x0, y0, x1 - x0, 3);
      g.fillRect(x0, y0, 3, y1 - y0);
      g.fillStyle = 'rgba(0,0,0,0.42)';
      g.fillRect(x0, y1 - 3, x1 - x0, 3);
      g.fillRect(x1 - 3, y0, 3, y1 - y0);
    }
  }
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillRect(0, 0, 3, H);
  g.fillRect(W - 3, 0, 3, H);
  g.fillRect(0, 0, W, 3);
  return texture(c);
}

/** Lines of text no wider than maxWidth, at most maxLines (the last one cut short with an ellipsis). */
function wrap(g, text, maxWidth, maxLines) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (g.measureText(next).width <= maxWidth || !line) line = next;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    let last = lines[maxLines - 1];
    while (last && g.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last.trimEnd()}…`;
  }
  return lines;
}

/** The largest font (from size down) at which text fits maxWidth. */
function fit(g, text, maxWidth, size, style) {
  for (; size > 10; size -= 2) {
    g.font = `${style} ${size}px ${SERIF}`;
    if (g.measureText(text).width <= maxWidth) break;
  }
  return size;
}

/** A sign's ground: a wooden edge, dark green enamel and a gold line. */
export function enamel(g, w, h, inset) {
  g.fillStyle = '#2b1b10';
  g.fillRect(0, 0, w, h);
  const e = g.createLinearGradient(0, 0, 0, h);
  e.addColorStop(0, '#1b2e28');
  e.addColorStop(1, ENAMEL);
  g.fillStyle = e;
  g.fillRect(inset, inset, w - inset * 2, h - inset * 2);
  g.strokeStyle = GOLD;
  g.lineWidth = 3;
  g.strokeRect(inset + 8, inset + 8, w - (inset + 8) * 2, h - (inset + 8) * 2);
}

/** The plaque beside an open door: its title and a line or two about it. 0.56 × 0.30 m. */
export function plaqueTexture(env) {
  const W = 512, H = 274;
  const c = canvas(W, H), g = c.getContext('2d');
  enamel(g, W, H, 12);
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.fillStyle = GOLD;
  fit(g, env.title, W - 90, 72, '600');
  g.fillText(env.title, W / 2, 96);
  g.fillStyle = 'rgba(224,187,114,0.6)';
  g.fillRect(W / 2 - 60, 114, 120, 2);
  // The description, all of it (it is the page's own, word for word): the largest size, 26 px
  // down, at which its lines fit below the rule, centred there.
  g.fillStyle = '#efe5cf';
  const text = env.subtitle || '';
  const top = 124, bottom = H - 32, width = W - 80;
  let size = 26, lines = [];
  for (; size >= 13; size--) {
    g.font = `${size}px ${SANS}`;
    lines = wrap(g, text, width, Infinity);
    if (lines.length * size * 1.22 <= bottom - top) break;
  }
  // Even the lines out (no word left alone on the last): the narrowest width that takes no more.
  let even = width;
  while (even > width * 0.6 && wrap(g, text, even - 6, Infinity).length === lines.length) even -= 6;
  lines = wrap(g, text, even, Infinity);
  const lead = size * 1.22;
  const first = top + (bottom - top - lines.length * lead) / 2 + size * 0.9;
  lines.forEach((l, i) => g.fillText(l, W / 2, first + i * lead));
  return texture(c);
}

/** The sign hanging out over an open door, read from down the hall: what kind of place it is. 0.62 × 0.20 m. */
export function bladeTexture(env) {
  const text = env.sign || env.title;
  const W = 512, H = 166;
  const c = canvas(W, H), g = c.getContext('2d');
  enamel(g, W, H, 8);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = GOLD;
  fit(g, text, W - 70, 86, '600');
  g.fillText(text, W / 2, H / 2 + 4);
  return texture(c);
}

/** The hallway's own name, on the entrance wall. 1.3 × 0.5 m. */
export function titleTexture() {
  const W = 1024, H = 394;
  const c = canvas(W, H), g = c.getContext('2d');
  enamel(g, W, H, 16);
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.fillStyle = GOLD;
  g.font = `600 150px ${SERIF}`;
  g.fillText('Hallway', W / 2, 220);
  g.fillStyle = '#efe5cf';
  g.font = `italic 46px ${SERIF}`;
  g.fillText('Doors to other places', W / 2, 300);
  return texture(c);
}

/** What a doorway shows until its picture arrives, or when it has none. 2:1. */
export function previewFallback(env) {
  const W = 1024, H = 512;
  const c = canvas(W, H), g = c.getContext('2d');
  const grad = g.createRadialGradient(W / 2, H * 0.55, 10, W / 2, H * 0.55, W * 0.6);
  grad.addColorStop(0, env.color);
  grad.addColorStop(1, '#050403');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = 'rgba(255,248,235,0.9)';
  // The doorway shows only the middle of the picture, about a third of its width from across the
  // hall, so the title fits there: on one line, or on two when that makes it larger.
  const max = W * 0.28;
  let lines = [env.title];
  let size = fit(g, env.title, max, 110, '600');
  const words = env.title.split(' ');
  for (let i = 1; i < words.length; i++) {
    const two = [words.slice(0, i).join(' '), words.slice(i).join(' ')];
    const s = Math.min(fit(g, two[0], max, 110, '600'), fit(g, two[1], max, 110, '600'));
    if (s > size * 1.15) {
      lines = two;
      size = s;
    }
  }
  g.font = `600 ${size}px ${SERIF}`;
  lines.forEach((line, i) => g.fillText(line, W / 2, H * 0.5 + (i - (lines.length - 1) / 2) * size * 1.1));
  return texture(c);
}

// The fields out of the end window: the hallway's own scenery below the horizon, in front of
// common's sky (common/sky.js, outside's late afternoon, which the window's glass shows at
// infinity, hills and tree line included). A flat picture hung FIELDS.depth beyond the window, its
// horizon at the window's eye height, painted looking down the hall (-z) as the sky is laid out
// (yaw 0), so each field's haze is the sky's own colour at the horizon there, warmer toward its sun.
// Transparent above the horizon, where the sky shows. Sizes in metres at the picture.
export const FIELDS = { depth: 40, width: 160, above: 3, below: 60, near: 15 };

const DEG = Math.PI / 180;
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const rgb = (c) => `rgb(${c.map(Math.round).join(',')})`;
const SUN_AZ = Math.atan2(SUN_DIR[0], -SUN_DIR[2]);
/** The sky's colour just over the horizon at azimuth az (from -z toward +x), as common paints it. */
const horizonAt = (az) => skyColor(0.5 * DEG, Math.sin(az) * SUN_DIR[0] - Math.cos(az) * SUN_DIR[2]);

/** The fields: 1536 wide (about 10 px a metre, as the old picture), the horizon FIELDS.above from the top. */
export function fieldsTexture() {
  const W = 1536, H = Math.round((W * (FIELDS.above + FIELDS.below)) / FIELDS.width);
  const m = W / FIELDS.width; // pixels a metre
  const u = m / 20.48; // a pixel's size, for sizes given at 20.48 px a metre (100 m in 2048)
  const c = canvas(W, H), g = c.getContext('2d'), r = rng(81);
  const horizonY = FIELDS.above * m, nearY = horizonY + FIELDS.near * m;
  const azAt = (x) => Math.atan((x / W - 0.5) * FIELDS.width / FIELDS.depth);
  const sunnyAt = (az) => Math.max(0, Math.cos(az - SUN_AZ)) ** 4;
  // Bands, nearer ones deeper, down to FIELDS.near below the horizon, cut into fields whose sides
  // run to the horizon straight ahead; each a green or the gold of dry grass, hazier with distance
  // and warmer toward the sun, with hedgerows round it and a few trees along its far edge.
  const GRASS = ['#7d8a5e', '#6f7f4a', '#8e9460', '#a39a63', '#738653', '#66753f'].map(hex);
  const HEDGE = hex('#4c5a3a'), TREE = hex('#56654a');
  const vx = W / 2, bands = 7;
  /** x where a field's side, which meets the horizon at vx and the near line at foot, is at y. */
  const side = (foot, y) => vx + ((foot - vx) * (y - horizonY)) / (nearY - horizonY);
  for (let b = 0; b < bands; b++) { // far to near, so a hedgerow's trees stand over the field beyond
    const top = horizonY + (nearY - horizonY) * (b / bands) ** 1.8;
    const bottom = b === bands - 1 ? H : horizonY + (nearY - horizonY) * ((b + 1) / bands) ** 1.8;
    const far = 1 - b / bands, haze = 0.45 * far ** 2;
    const scale = ((Math.min(bottom, nearY) - top) / ((nearY - horizonY) / bands)) * u;
    const feet = [vx - 300 * m];
    for (let f = vx - 300 * m + r() * 100 * m; f < vx + 300 * m; f += (40 + r() * 90) * m) feet.push(f);
    feet.push(vx + 300 * m);
    g.save();
    g.beginPath();
    g.rect(0, top, W, bottom - top + 1);
    g.clip();
    for (let f = 0; f + 1 < feet.length; f++) {
      const az = azAt(side((feet[f] + feet[f + 1]) / 2, (top + Math.min(bottom, nearY)) / 2));
      g.fillStyle = rgb(mix(GRASS[Math.floor(r() * GRASS.length)], horizonAt(az), haze + 0.2 * far * sunnyAt(az)));
      g.beginPath();
      g.moveTo(side(feet[f], top), top);
      g.lineTo(side(feet[f + 1], top), top);
      g.lineTo(side(feet[f + 1], bottom + 1), bottom + 1);
      g.lineTo(side(feet[f], bottom + 1), bottom + 1);
      g.closePath();
      g.fill();
    }
    // Hedgerows: along the band's far edge, and down the fields' sides.
    g.strokeStyle = g.fillStyle = rgb(mix(HEDGE, horizonAt(0), 0.4 * far ** 2));
    g.fillRect(0, top - 1.5 * scale, W, 3 * scale);
    g.lineWidth = 2 * scale;
    for (let f = 1; f + 1 < feet.length; f++) {
      g.beginPath();
      g.moveTo(side(feet[f], top), top);
      g.lineTo(side(feet[f], bottom), bottom);
      g.stroke();
    }
    g.restore();
    for (let x = r() * 150 * u; x < W; x += (50 + r() * 220) * u) {
      const rad = (4 + r() * 6) * scale;
      g.fillStyle = rgb(mix(TREE, horizonAt(azAt(x)), 0.4 * far ** 2).map((v) => v * (0.85 + 0.25 * r())));
      g.beginPath();
      g.ellipse(x, top - rad * 0.7, rad * (0.9 + 0.5 * r()), rad, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  // Below the near line, the field nearest the hall, darkening toward the foot of the picture.
  const near = g.createLinearGradient(0, nearY, 0, H);
  near.addColorStop(0, 'rgba(0,0,0,0)');
  near.addColorStop(1, 'rgba(20,26,12,0.45)');
  g.fillStyle = near;
  g.fillRect(0, nearY, W, H - nearY);
  return texture(c);
}

/** A soft round glow, for the lamps. */
export function haloTexture() {
  const S = 128;
  const c = canvas(S, S), g = c.getContext('2d');
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0, 'rgba(255,236,200,1)');
  grad.addColorStop(0.25, 'rgba(255,220,170,0.45)');
  grad.addColorStop(1, 'rgba(255,210,150,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  return texture(c);
}
