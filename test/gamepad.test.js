import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUTTON, DEADZONE, readPad } from '../public/js/gamepad.js';

const pad = (axes, pressed = []) => ({ axes, buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i), value: pressed.includes(i) ? 1 : 0 })) });
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} ≠ ${b}`);

test('sticks at rest, or resting a little off centre, ask for nothing', () => {
  const s = readPad(pad([0.1, -0.08, DEADZONE * 0.9, 0]));
  for (const k of ['moveX', 'moveY', 'lookX', 'lookY']) assert.equal(Math.abs(s[k]), 0, k);
  assert.equal(s.use || s.exit || s.run, false);
});

test('full tilt reaches 1, diagonally too, and no further', () => {
  let s = readPad(pad([0, -1, 1, 0]));
  near(s.moveY, -1, 'forward');
  near(s.lookX, 1, 'look right');
  s = readPad(pad([Math.SQRT1_2, Math.SQRT1_2, 0, 0]));
  near(Math.hypot(s.moveX, s.moveY), 1, 'diagonal');
  s = readPad(pad([1, 1, 0, 0])); // some pads report a square
  near(Math.hypot(s.moveX, s.moveY), 1, 'square corner');
});

test('looking is finer than walking near the middle', () => {
  const s = readPad(pad([0.5, 0, 0.5, 0]));
  near(s.moveX, (0.5 - DEADZONE) / (1 - DEADZONE), 'walking: linear past the dead zone');
  near(s.lookX, ((0.5 - DEADZONE) / (1 - DEADZONE)) ** 2, 'looking: squared');
});

test('A uses, View leaves fullscreen, the left stick clicked in runs; a pad with one stick only walks', () => {
  const s = readPad(pad([0, 0, 0, 0], [BUTTON.a, BUTTON.view, BUTTON.leftStick]));
  assert.deepEqual([s.use, s.exit, s.run], [true, true, true]);
  const one = readPad({ axes: [0.9, 0], buttons: [] });
  assert.ok(one.moveX > 0.8);
  assert.equal(one.lookX, 0);
  assert.equal(one.use, false);
});
