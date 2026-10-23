// The doors list's text colours (public/js/color.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENVIRONMENTS } from '../public/js/environments.js';
import { LIST_BACKGROUNDS, contrast, readable } from '../public/js/color.js';

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'css', 'style.css'), 'utf8');

test('contrast follows WCAG: black on white is 21:1, a colour on itself 1:1', () => {
  assert.equal(Math.round(contrast('#000000', '#ffffff') * 100) / 100, 21);
  assert.equal(contrast('#d8543f', '#d8543f'), 1);
});

test("the list's backgrounds are style.css's card over the page, under the link's wash", () => {
  const n = (s) => s.split(',').map(Number);
  const panel = n(css.match(/--panel:\s*rgba\(([^)]+)\)/)[1]);
  const page = css.match(/--bg:\s*#([0-9a-f]{6})/i)[1];
  const pageRgb = [0, 2, 4].map((i) => parseInt(page.slice(i, i + 2), 16));
  const card = pageRgb.map((v, i) => panel[i] * panel[3] + v * (1 - panel[3]));
  const washes = [
    n(css.match(/\.doors a \{[^}]*background:\s*rgba\(([^)]+)\)/)[1])[3],
    n(css.match(/\.doors a:hover, \.doors a\.hover \{[^}]*background:\s*rgba\(([^)]+)\)/)[1])[3],
  ];
  const hex = (c) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
  assert.deepEqual(washes.map((w) => hex(card.map((v) => v + (255 - v) * w))), LIST_BACKGROUNDS);
});

test("every door's name reads at 4.5:1 on the list, plain and hovered, and as near its glow as that allows", () => {
  for (const e of ENVIRONMENTS) {
    const text = readable(e.color);
    for (const bg of LIST_BACKGROUNDS) assert.ok(contrast(text, bg) >= 4.5, `${e.id}: ${text} on ${bg}`);
  }
  assert.equal(readable('#d9b26a'), '#d9b26a', "vrlbry's gold already reads");
  const red = readable('#d8543f');
  assert.notEqual(red, '#d8543f', "breadboard's red does not (4.04:1)");
  assert.ok(contrast(red, LIST_BACKGROUNDS[1]) < 4.8, 'lightened no more than it needs');
});
