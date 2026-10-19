import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HALL, layoutHall } from '../public/js/layout.js';
import { HALLWAY_ID, LINK_PARAMS, doorLink, doorPose } from '../public/js/link.js';

const env = { id: 'garden', title: 'Garden', url: 'https://example.org/garden/?place=%7Edusk#gate', color: '#7FC4A0' };
const L = layoutHall([env, { ...env, id: 'pond' }]);
const [left, right] = L.doors;
const here = 'https://ariamokr.github.io/hallway/?from=pond#x';
const DEG = Math.PI / 180;
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} ≠ ${b}`);

test('a pose is measured in the doorway: across + to the right facing in, yaw + to the left', () => {
  // Through the right-hand door (facing +x), 0.1 m towards the entrance (+z): their right.
  let p = doorPose(L, right, 1.6, right.z + 0.1, 1, 0, 0);
  near(p.across, 0.1, 'right door, across');
  near(p.yaw, 0, 'right door, straight in');
  near(p.pitch, 0, 'level');
  // The same spot through the left-hand door (facing -x) is on their left.
  p = doorPose(L, left, -1.6, left.z + 0.1, -1, 0, 0);
  near(p.across, -0.1, 'left door, across');
  near(p.yaw, 0, 'left door, straight in');
  // Turned 20° left of straight in: towards -z through the right door, towards +z through the left.
  p = doorPose(L, right, 1.6, right.z, Math.cos(20 * DEG), 0, -Math.sin(20 * DEG));
  near(p.yaw, 20 * DEG, 'right door, turned left');
  p = doorPose(L, left, -1.6, left.z, -Math.cos(20 * DEG), 0, Math.sin(20 * DEG));
  near(p.yaw, 20 * DEG, 'left door, turned left');
  // Looking 30° down.
  p = doorPose(L, right, 1.6, right.z, Math.cos(30 * DEG), -Math.sin(30 * DEG), 0);
  near(p.pitch, -30 * DEG, 'looking down');
});

test('a pose from across the hall (pointing at the door) stays within the opening and ±90°', () => {
  const p = doorPose(L, right, -1.2, right.z + 3, 0, 0, 1); // far off and facing the entrance
  near(p.across, HALL.doorWidth / 2, 'across, clamped');
  near(p.yaw, -Math.PI / 2, 'yaw, clamped');
});

test("a door's link keeps the environment's URL and adds the visit to its query", () => {
  const pose = { across: 0.123, yaw: -8.4 * DEG, pitch: -3.2 * DEG };
  const url = new URL(doorLink(env, { here, hall: HALL, pose, room: 'k3vd-q8hn' }));
  assert.equal(url.origin + url.pathname, 'https://example.org/garden/');
  assert.equal(url.hash, '#gate');
  assert.ok(url.search.startsWith('?place=%7Edusk&'), url.search);
  assert.deepEqual([...url.searchParams.keys()], ['place', ...LINK_PARAMS]);
  const q = Object.fromEntries(url.searchParams);
  assert.equal(q.from, HALLWAY_ID);
  assert.equal(q.back, 'https://ariamokr.github.io/hallway/?from=garden&room=k3vd-q8hn');
  assert.equal(q.room, 'k3vd-q8hn');
  assert.equal(q.dx, '0.12');
  assert.equal(q.yaw, '-8');
  assert.equal(q.pitch, '-3');
  assert.equal(q.dw, String(HALL.doorWidth));
  assert.equal(q.dh, String(HALL.doorHeight));
  assert.equal(q.glow, '7fc4a0');
});

test('in VR the link leaves out the pitch; the doors list leaves out the pose; zero has no minus', () => {
  const xr = new URL(doorLink(env, { here, hall: HALL, pose: { across: -0.001, yaw: -0.001, pitch: 0.5 }, xr: true }));
  assert.equal(xr.searchParams.get('dx'), '0');
  assert.equal(xr.searchParams.get('yaw'), '0');
  assert.equal(xr.searchParams.has('pitch'), false);
  const list = new URL(doorLink(env, { here, hall: HALL }));
  for (const k of ['dx', 'yaw', 'pitch']) assert.equal(list.searchParams.has(k), false, k);
  for (const k of ['from', 'back', 'dw', 'dh', 'glow']) assert.ok(list.searchParams.has(k), k);
});

test('outside a shared session neither the link nor the way back has a room', () => {
  const url = new URL(doorLink(env, { here: 'https://ariamokr.github.io/hallway/?room=old', hall: HALL }));
  assert.equal(url.searchParams.has('room'), false);
  assert.equal(url.searchParams.get('back'), 'https://ariamokr.github.io/hallway/?from=garden');
});
