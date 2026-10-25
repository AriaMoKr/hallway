// The TV app's page (tv.js): telling it is the app, joining a room typed in, and the card's stops.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { focusStops, isTV, nextStop, roomFromInput } from '../public/js/tv.js';

const BRAVIA = 'Mozilla/5.0 (Linux; Android 12; BRAVIA 4K VH21 Build/STT2.230505.001.S136; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/155.0.8059.43 Mobile Safari/537.36';

test("the TV app's WebView, by the end of its user agent", () => {
  assert.equal(isTV(`${BRAVIA} HallwayTV/1.0.0`), true);
  assert.equal(isTV(`${BRAVIA} HallwayTV/0.0.0-dev`), true);
  assert.equal(isTV(BRAVIA), false, 'another app\'s WebView on the same TV');
  assert.equal(isTV('Mozilla/5.0 (X11; Linux x86_64) Chrome/155.0 Safari/537.36'), false);
  assert.equal(isTV('NotHallwayTV/1.0'), false);
  assert.equal(isTV(undefined), false);
});

test('a room to join: its name, or a link to it, as typed on a remote', () => {
  assert.equal(roomFromInput('k3vd-q8hn'), 'k3vd-q8hn');
  assert.equal(roomFromInput('  K3VD-Q8HN '), 'k3vd-q8hn');
  assert.equal(roomFromInput('https://ariamokr.github.io/hallway/?room=k3vd-q8hn'), 'k3vd-q8hn');
  assert.equal(roomFromInput('ariamokr.github.io/music/?from=hallway&room=Ab12-cd34#x'), 'ab12-cd34');
  assert.equal(roomFromInput('?room=k3vd-q8hn'), 'k3vd-q8hn');
  assert.equal(roomFromInput(''), null);
  assert.equal(roomFromInput('   '), null);
  assert.equal(roomFromInput('-k3vd'), null, "a room doesn't start with '-'");
  assert.equal(roomFromInput('two words'), null);
  assert.equal(roomFromInput('https://ariamokr.github.io/hallway/'), null, 'a link to no room');
  assert.equal(roomFromInput('?room=%E0%A4%A'), null, 'not even a URL');
  assert.equal(roomFromInput('x'.repeat(41)), null);
});

test("the card's stops: every control once, each choice one stop at its checked option", () => {
  const items = [
    { radio: '' }, // the Doors toggle
    { radio: '' }, // a door
    { radio: 'nav-move', checked: false },
    { radio: 'nav-move', checked: true },
    { radio: 'nav-turn', checked: false },
    { radio: 'nav-turn', checked: false },
    { radio: '' }, // a checkbox
    { radio: 'nav-motion', checked: true },
    { radio: 'nav-motion', checked: false },
    { radio: 'nav-motion', checked: false },
    { radio: '' }, // Start shared session
  ];
  assert.deepEqual(focusStops(items), [0, 1, 3, 4, 6, 7, 10]);
  assert.deepEqual(focusStops([]), []);
});

test('up and down through the stops: from none, the first or the last; at the ends, they stay', () => {
  assert.equal(nextStop(5, -1, 1), 0);
  assert.equal(nextStop(5, -1, -1), 4);
  assert.equal(nextStop(5, 2, 1), 3);
  assert.equal(nextStop(5, 2, -1), 1);
  assert.equal(nextStop(5, 4, 1), 4);
  assert.equal(nextStop(5, 0, -1), 0);
  assert.equal(nextStop(0, -1, 1), -1);
});

test("the 10-foot view's focus ring is thicker than a desktop's, and drawn on a dark halo", () => {
  const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'css', 'style.css'), 'utf8');
  const ring = css.match(/html\.tv :focus-visible \{ outline: (\d+)px solid #[0-9a-f]{6}; outline-offset: \d+px; box-shadow: 0 0 0 (\d+)px rgba\(0, 0, 0, [\d.]+\); \}/);
  assert.ok(ring, 'html.tv :focus-visible');
  assert.ok(Number(ring[1]) >= 4, 'at least 4 px');
  assert.ok(Number(ring[2]) > Number(ring[1]) + 3, 'the halo shows round the ring');
});
