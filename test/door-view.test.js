// The view out of a door (public/js/door-view.js) and views.json (tools/door-views.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENVIRONMENTS } from '../public/js/environments.js';
import { layoutHall } from '../public/js/layout.js';
import { VIEW, doorView } from '../public/js/door-view.js';
import { viewsJson } from '../tools/door-views.mjs';

const L = layoutHall(ENVIRONMENTS);
const near = (a, b) => Math.abs(a - b) < 1e-9;

test('a door\'s view looks straight across the hall from its doorway, at eye height', () => {
  const [left, right] = L.doors;
  const a = doorView(L, left);
  assert.ok(near(a.eye.x, -(L.halfWidth - VIEW.inset)) && a.eye.y === VIEW.eye && a.eye.z === left.z);
  assert.ok(near(-Math.sin(a.yaw), 1) && near(Math.cos(a.yaw), 0), 'a left door looks toward +x');
  const b = doorView(L, right);
  assert.ok(near(b.eye.x, L.halfWidth - VIEW.inset) && near(-Math.sin(b.yaw), -1), 'a right door looks toward -x');
});

test('its picture, hung at the opposite wall, matches its frustum', () => {
  const v = doorView(L, L.doors[0]);
  const { depth, pictureHeight, eye, horizon, aspect } = v.params;
  assert.ok(Math.abs(depth - (L.hall.width - VIEW.inset)) < 1e-3, 'the opposite wall');
  assert.equal(aspect, VIEW.width / VIEW.height);
  // At the far wall: below the eye by horizon × height, above it by the rest, centred across.
  assert.ok(Math.abs(v.frustum.bottom * depth + horizon * pictureHeight) < 2e-3);
  assert.ok(Math.abs(v.frustum.top * depth - (1 - horizon) * pictureHeight) < 2e-3);
  assert.ok(Math.abs((v.frustum.right - v.frustum.left) * depth - pictureHeight * aspect) < 2e-3);
  assert.equal(eye, VIEW.eye);
  // The floor across the hall is in it: the far wall's foot is above its bottom.
  assert.ok(eye - horizon * pictureHeight < -2);
});

test('views.json names each picture with its parameters', () => {
  const json = JSON.parse(viewsJson([{ id: 'vrlbry', params: doorView(L, L.doors[0]).params }]));
  assert.deepEqual(Object.keys(json.views), ['vrlbry']);
  assert.equal(json.views.vrlbry.image, 'vrlbry.jpg');
  for (const k of ['depth', 'pictureHeight', 'eye', 'horizon', 'aspect']) assert.equal(typeof json.views.vrlbry[k], 'number', k);
});
