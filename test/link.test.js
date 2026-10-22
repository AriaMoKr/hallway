// doorPose (public/js/link.js): how a visitor goes through a door. The link it goes into is
// common's doorLink, tested there.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HALL, layoutHall } from '../public/js/layout.js';
import { doorLink } from 'common/door.js';
import { doorPose } from '../public/js/link.js';

const env = { id: 'garden', title: 'Garden', url: 'https://example.org/garden/?place=%7Edusk#gate', color: '#7FC4A0' };
const L = layoutHall([env, { ...env, id: 'pond' }]);
const [left, right] = L.doors;
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

test("the pose goes into common's link as dx (m), and yaw and pitch in degrees", () => {
  const pose = doorPose(L, right, 1.6, right.z + 0.123, Math.cos(8 * DEG), -Math.sin(3 * DEG), -Math.sin(8 * DEG));
  const q = new URL(doorLink(env, { here: 'https://ariamokr.github.io/hallway/', hall: L.hall, pose })).searchParams;
  assert.equal(q.get('dx'), '0.12');
  assert.equal(q.get('yaw'), '8');
  assert.equal(q.get('pitch'), '-3');
});
