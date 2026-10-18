import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HALL, PANEL, PANEL_BUTTONS, PANEL_PX, layoutHall, clampToHall, doorCrossed, doorSpawn, castRay, panelButtonAt } from '../public/js/layout.js';

const env = (id) => ({ id, title: id, url: `https://example.org/${id}/`, color: '#ffffff' });

test('doors alternate sides from the entrance, and empty slots stay closed', () => {
  const L = layoutHall([env('a'), env('b'), env('c')]);
  assert.equal(L.doors.length, 4);
  assert.deepEqual(L.doors.map((d) => d.side), [-1, 1, -1, 1]);
  assert.deepEqual(L.doors.map((d) => d.env?.id ?? null), ['a', 'b', 'c', null]);
  assert.equal(L.doors[0].z, L.doors[1].z);
  assert.ok(L.doors[2].z < L.doors[0].z);
  assert.ok(L.zEnd < L.doors[3].z);
  assert.equal(layoutHall([]).doors.length, HALL.minSlots);
  assert.equal(layoutHall([1, 2, 3, 4, 5].map((n) => env(`e${n}`))).doors.length, 6);
});

test('walls stop the viewer, an open doorway lets them through', () => {
  const L = layoutHall([env('a')]);
  const [open, closed] = L.doors;
  const lim = L.halfWidth - HALL.margin;
  assert.equal(clampToHall(L, -5, open.z + 1.5).x, -lim, 'plain wall');
  assert.equal(clampToHall(L, 5, closed.z).x, lim, 'closed door');
  assert.ok(clampToHall(L, -5, open.z).x < -L.halfWidth - HALL.threshold, 'into the open doorway, past its threshold');
  assert.equal(clampToHall(L, 0, 5).z, L.zStart - HALL.margin, 'entrance wall');
  assert.equal(clampToHall(L, 0, -100).z, L.zEnd + HALL.margin, 'end wall');
  // In the doorway and drifting sideways: kept between the jambs.
  const c = clampToHall(L, -L.halfWidth - 0.05, open.z + HALL.doorWidth / 2 - 0.1);
  assert.ok(Math.abs(c.z - open.z) < HALL.doorWidth / 2 - 0.15);
  assert.ok(c.x < -lim);
});

test('crossing an open door\'s threshold, and only that, counts as going through', () => {
  const L = layoutHall([env('a')]);
  const [open, closed] = L.doors;
  assert.equal(doorCrossed(L, -L.halfWidth - 0.1, open.z), open);
  assert.equal(doorCrossed(L, -L.halfWidth + 0.1, open.z), null, 'not yet through');
  assert.equal(doorCrossed(L, -L.halfWidth - 0.1, open.z + HALL.doorWidth), null, 'beside the opening');
  assert.equal(doorCrossed(L, L.halfWidth + 0.1, closed.z), null, 'closed');
});

test('coming back out of a door: in front of it, facing away from it', () => {
  const L = layoutHall([env('a'), env('b')]);
  for (const door of L.doors.slice(0, 2)) {
    const p = doorSpawn(L, door);
    assert.equal(p.z, door.z);
    assert.ok(Math.abs(p.x) < L.halfWidth - HALL.margin);
    const forwardX = -Math.sin(p.yaw), forwardZ = -Math.cos(p.yaw);
    assert.ok(forwardX * door.side < 0, 'turned away from the door');
    assert.ok(forwardZ < 0, 'and down the hall');
    assert.equal(doorCrossed(L, p.x, p.z), null);
  }
});

test('castRay finds doors, the floor, the window and the walls', () => {
  const L = layoutHall([env('a')]);
  const [open, closed] = L.doors;
  const out = {};
  const at = (ox, oy, oz, tx, ty, tz) => {
    const dx = tx - ox, dy = ty - oy, dz = tz - oz, n = Math.hypot(dx, dy, dz);
    return castRay(L, ox, oy, oz, dx / n, dy / n, dz / n, out) && { ...out };
  };
  let hit = at(0, 1.6, -1, -L.halfWidth, 1.2, open.z);
  assert.equal(hit.kind, 'door');
  assert.equal(hit.door, open);
  assert.equal(hit.nx, 1);
  hit = at(0, 1.6, -1, L.halfWidth, 1.2, closed.z);
  assert.equal(hit.door, closed);
  hit = at(0, 1.6, -1, -L.halfWidth, 2.6, open.z);
  assert.equal(hit.kind, 'wall', 'above the door');
  hit = at(0, 1.6, -1, 0.5, 0, -2);
  assert.equal(hit.kind, 'floor');
  assert.ok(Math.abs(hit.x - 0.5) < 1e-9 && Math.abs(hit.z + 2) < 1e-9);
  assert.equal(at(0, 1.6, -1, 0, 1.6, L.zEnd).kind, 'window');
  assert.equal(at(0, 1.6, -1, 1.2, 0.5, L.zEnd).kind, 'wall');
  assert.equal(at(0, 1.6, -1, 0, 3.2, -1.5).kind, 'ceiling');
  assert.equal(at(0, 1.6, -1, 0, 1.6, 0).kind, 'wall');
  assert.ok(Math.abs(at(0, 1.6, -1, 0, 1.6, 0).t - 1) < 1e-9);
});

test('castRay finds the control panel and the button pointed at', () => {
  const L = layoutHall([env('a')]);
  const out = {};
  const face = PANEL.side * (L.halfWidth - PANEL.depth);
  const at = (y, z) => {
    const ox = 0, oy = 1.6, oz = -1;
    const dx = face - ox, dy = y - oy, dz = z - oz, n = Math.hypot(dx, dy, dz);
    return castRay(L, ox, oy, oz, dx / n, dy / n, dz / n, out) && { ...out };
  };
  // Every button's centre, mapped from the canvas to the wall.
  for (const [id, x0, y0, x1, y1] of PANEL_BUTTONS) {
    const u = (x0 + x1) / 2 / PANEL_PX.width, v = 1 - (y0 + y1) / 2 / PANEL_PX.height;
    const hit = at(PANEL.y + (v - 0.5) * PANEL.height, PANEL.z + PANEL.side * (u - 0.5) * PANEL.width);
    assert.equal(hit.kind, 'panel', id);
    assert.ok(Math.abs(hit.u - u) < 1e-6 && Math.abs(hit.v - v) < 1e-6, id);
    assert.equal(panelButtonAt(hit.u, hit.v), id);
    assert.ok(Math.abs(Math.abs(hit.x) - (L.halfWidth - PANEL.depth)) < 1e-9, 'on the panel face, in front of the wall');
  }
  assert.equal(panelButtonAt(0.02, 0.98), null, 'the title, no button');
  assert.equal(at(PANEL.y, PANEL.z + PANEL.width).kind, 'wall', 'beside the panel');
  assert.ok(L.doors.every((d) => d.side !== PANEL.side || Math.abs(d.z - PANEL.z) > HALL.doorWidth / 2 + 0.2 + PANEL.width / 2), 'clear of the doors');
});
