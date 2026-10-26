// The TV app's page: what is the hallway's own (joining a room typed in, the 10-foot focus ring, the
// controls' keys). Telling it is the app, the card's stops and keyOf are common's tv.js, tested there.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { keyOf } from 'common/tv.js';
import { KEYS } from '../public/js/controls.js';
import { roomFromInput } from '../public/js/tv.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

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

test("the remote walks and turns: its arrows (with no code), and with TalkBack on its channel and media keys", () => {
  const does = (e) => KEYS[keyOf(e)];
  assert.equal(does({ code: '', key: 'ArrowUp' }), 'forward', "a remote's arrow, with an empty code");
  assert.equal(does({ code: 'ArrowLeft', key: 'ArrowLeft' }), 'turnLeft');
  assert.equal(does({ code: '', key: 'ChannelUp' }), 'forward');
  assert.equal(does({ code: '', key: 'ChannelDown' }), 'back');
  assert.equal(does({ code: '', key: 'MediaRewind' }), 'turnLeft');
  assert.equal(does({ code: 'MediaFastForward', key: 'MediaFastForward' }), 'turnRight');
  assert.equal(does({ code: '', key: 'MediaPlayPause' }), undefined, 'play and pause are not the arrows');
  assert.equal(does({ code: 'KeyW', key: 'w' }), 'forward', 'a keyboard, as before');
  assert.equal(does({ code: 'KeyQ', key: 'q' }), 'turnLeft');
});

test("the 10-foot view's focus ring is thicker than a desktop's, and drawn on a dark halo", () => {
  const css = readFileSync(join(root, 'css', 'style.css'), 'utf8');
  const ring = css.match(/html\.tv :focus-visible \{ outline: (\d+)px solid #[0-9a-f]{6}; outline-offset: \d+px; box-shadow: 0 0 0 (\d+)px rgba\(0, 0, 0, [\d.]+\); \}/);
  assert.ok(ring, 'html.tv :focus-visible');
  assert.ok(Number(ring[1]) >= 4, 'at least 4 px');
  assert.ok(Number(ring[2]) > Number(ring[1]) + 3, 'the halo shows round the ring');
});

test("the TV's hint says how to walk with TalkBack, which keeps the arrows; the view is described by it", () => {
  const overlay = readFileSync(join(root, 'js', 'overlay.js'), 'utf8');
  assert.match(overlay, /tv: '[^'\n]*\\nWith TalkBack: channel up and down walk, rewind and fast-forward turn'/);
  assert.match(readFileSync(join(root, 'css', 'style.css'), 'utf8'), /html\.tv \.hint \{[^}]*white-space: pre-line;/, 'on a line of its own');
  assert.match(readFileSync(join(root, 'js', 'main.js'), 'utf8'), /setAttribute\('aria-describedby', overlay\.hint\.id\)/);
});
