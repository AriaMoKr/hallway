import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HALL, PANEL, PANEL_BUTTONS, PANEL_PX, PLAQUE, layoutHall, clampToHall, doorCrossed, doorSpawn, entranceSpawn, castRay, panelButtonAt } from '../public/js/layout.js';
import { hash } from '../public/vendor/layersharedsession/identity.js';

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

test('castRay says only the floor is walkable, though one hit is written over from ray to ray', () => {
  // common's controls walk to a click, and teleport to a trigger, only where it is walkable.
  const L = layoutHall([env('a')]);
  const [open] = L.doors;
  const out = {};
  const at = (tx, ty, tz) => {
    const ox = 0, oy = 1.6, oz = -1;
    const dx = tx - ox, dy = ty - oy, dz = tz - oz, n = Math.hypot(dx, dy, dz);
    return castRay(L, ox, oy, oz, dx / n, dy / n, dz / n, out);
  };
  for (const [kind, x, y, z] of [
    ['wall', -L.halfWidth, 1.2, -1.5],
    ['panel', PANEL.side * (L.halfWidth - PANEL.depth), PANEL.y, PANEL.z],
    ['door', -L.halfWidth, 1.2, open.z],
    ['window', 0, 1.6, L.zEnd],
    ['ceiling', 0, 3.2, -1.5],
    ['wall', 0, 1.6, 0],
  ]) {
    const floor = at(0.5, 0, -2);
    assert.equal(floor.kind, 'floor');
    assert.equal(floor.walkable, true, 'the floor');
    const hit = at(x, y, z);
    assert.equal(hit, floor, 'the same hit, written over');
    assert.equal(hit.kind, kind);
    assert.equal(hit.walkable, false, `the ${kind}, met after the floor`);
  }
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
  // And of every plaque on its wall, open or not yet, with room for both frames between them.
  for (const d of L.doors) {
    if (d.side === PANEL.side) assert.ok(Math.abs(d.z + PLAQUE.offset - PANEL.z) > PLAQUE.width / 2 + PANEL.width / 2 + 0.25, `clear of door ${d.index}'s plaque`);
  }
});

test('the panel hangs clear of the chair rail painted at 1 m', () => {
  assert.ok(PANEL.y - PANEL.height / 2 - 0.025 > 1.05, 'its frame stops above the rail');
  assert.ok(PANEL.y + PANEL.height / 2 < 1.95, 'and its top is in reach');
  assert.ok(Math.abs(PANEL_PX.width / PANEL_PX.height - PANEL.width / PANEL.height) < 1e-9, 'its canvas has its shape');
});

/** The different spots spawn(key) gives over many keys. */
function spots(spawn) {
  const out = [];
  for (let key = 0; key < 500; key++) {
    const s = spawn(key);
    if (!out.some((o) => o.x === s.x && o.z === s.z)) out.push(s);
  }
  return out;
}
const apart = (list) => Math.min(...list.flatMap((a, i) => list.slice(i + 1).map((b) => Math.hypot(a.x - b.x, a.z - b.z))));

test('arrivals at the entrance spread over spots in the hall, the same key always the same spot', () => {
  const L = layoutHall([env('a'), env('b')]);
  const list = spots((k) => entranceSpawn(L, k));
  assert.ok(list.length >= 8 && list.length <= 10, `${list.length} spots`);
  for (const s of list) {
    const c = clampToHall(L, s.x, s.z);
    assert.ok(c.x === s.x && c.z === s.z, `(${s.x}, ${s.z}) is where one may stand`);
    assert.equal(doorCrossed(L, s.x, s.z), null);
    assert.equal(s.yaw, L.spawn.yaw, 'facing down the hall');
    assert.ok(s.z < L.zStart && s.z > -2.2, 'near the entrance');
  }
  assert.ok(apart(list) >= 0.5, `spots ${apart(list)} m apart`);
  const id = 'k3vd8hnq2w0x';
  assert.deepEqual(entranceSpawn(L, hash(id)), entranceSpawn(L, hash(id)), 'the same member, the same spot');
  // A handful of member ids don't all land on one spot.
  const used = new Set(['aaaaaaaaaaaa', 'bbbbbbbbbbbb', 'cccccccccccc', 'dddddddddddd', 'eeeeeeeeeeee'].map((m) => JSON.stringify(entranceSpawn(L, hash(m)))));
  assert.ok(used.size >= 3, `${used.size} spots for 5 visitors`);
});

test('coming back out of a door spreads too: within 0.4 m of its centre, facing down the hall', () => {
  const L = layoutHall([env('a'), env('b'), env('c')]);
  for (const door of L.doors.filter((d) => d.env)) {
    assert.deepEqual(doorSpawn(L, door, 0), doorSpawn(L, door), 'key 0 is the old spot, the door\'s centre');
    const list = spots((k) => doorSpawn(L, door, k));
    assert.ok(list.length >= 3, `${list.length} spots`);
    for (const s of list) {
      assert.ok(Math.abs(s.z - door.z) <= 0.4 + 1e-9, 'within 0.4 m of the door\'s centre');
      const c = clampToHall(L, s.x, s.z);
      assert.ok(c.x === s.x && c.z === s.z, 'in the hall');
      assert.equal(doorCrossed(L, s.x, s.z), null, 'not in the doorway');
      assert.ok(door.side * s.x < L.halfWidth - 0.5, 'a step out from the wall');
      assert.equal(s.yaw, door.side * 0.5, 'turned away from the door, down the hall');
    }
    assert.ok(apart(list) >= 0.39, `spots ${apart(list)} m apart`);
  }
});

test("the panel's choices are the values common keeps: every movement choice and accessibility setting", async () => {
  const { normalizeNav } = await import('common/nav.js');
  const { normalizeAccess } = await import('common/access.js');
  const ids = PANEL_BUTTONS.map(([id]) => id).filter((id) => id.includes(':'));
  for (const id of ids) {
    const [key, value] = id.split(':');
    if (key === 'move' || key === 'turn') assert.equal(normalizeNav({ [key]: value })[key], value, id);
    else if (key === 'motion') assert.equal(normalizeAccess({ motion: value }).motion, value, id);
    else assert.equal(normalizeAccess({ [key]: value === 'on' })[key], value === 'on', id);
  }
  for (const want of ['move:smooth', 'move:teleport', 'turn:snap', 'turn:smooth', 'motion:system', 'motion:reduce', 'motion:full', 'vignette:on', 'vignette:off', 'seated:on', 'seated:off']) {
    assert.ok(ids.includes(want), `no ${want} button`);
  }
});
