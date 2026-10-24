// Where everything in the hall is, and the geometry questions asked of it every frame: where the
// viewer may walk, which doorway they stepped through, what a ray points at. Pure functions with no
// three.js, so the tests run them in Node.
//
// Coordinates: metres, y up, the floor at y = 0. The entrance wall is at z = 0 and the hall runs
// along -z. Facing down the hall, left is -x. A yaw of 0 faces -z; positive yaws turn left.

export const HALL = {
  width: 3.0,
  height: 3.2,
  doorWidth: 1.1,
  doorHeight: 2.25,
  pairSpacing: 3.6, // between one pair of doors (left and right) and the next
  startLength: 4.2, // from the entrance wall to the first pair
  endLength: 2.8, // from the last pair to the end wall
  minSlots: 4, // doors drawn at least, the ones without an environment closed
  margin: 0.28, // how near a wall the viewer walks
  reveal: 0.15, // the wall's thickness at a doorway; the portal is drawn at its back
  threshold: 0.06, // how far past the wall's face the viewer's head goes to pass through
};

/** The window in the end wall. */
export const WINDOW = { width: 1.6, bottom: 0.95, top: 2.85 };

/** The plaque beside each open door, on its entrance side: its centre's distance from the door's, and its frame's width. */
export const PLAQUE = { offset: HALL.doorWidth / 2 + 0.46, width: 0.6 };

/**
 * The control panel on the right wall near the entrance, between it and the first door's plaque:
 * Enter / Exit VR, how to move in VR, the accessibility settings (common/access.js: motion, the
 * vignette, seated), and the shared session (together.js): its status and who is in it. y and z
 * are its centre, high enough that its frame clears the chair rail at 1 m and low enough that its
 * top is in reach; depth how far its face stands out from the wall.
 */
export const PANEL = { side: 1, z: -2.2, y: 1.51, width: 0.56, height: (0.56 * 784) / 512, depth: 0.03 };

/** The panel's canvas (its shape), and its buttons on it as [id, x0, y0, x1, y1] in canvas pixels (y down). */
export const PANEL_PX = { width: 512, height: 784 };
export const PANEL_BUTTONS = [
  ['vr', 32, 66, 480, 118],
  ['move:teleport', 160, 132, 314, 182],
  ['move:smooth', 326, 132, 480, 182],
  ['turn:snap', 160, 194, 314, 244],
  ['turn:smooth', 326, 194, 480, 244],
  ['motion:system', 160, 290, 260, 340],
  ['motion:reduce', 270, 290, 370, 340],
  ['motion:full', 380, 290, 480, 340],
  ['vignette:on', 160, 352, 314, 402],
  ['vignette:off', 326, 352, 480, 402],
  ['seated:on', 160, 414, 314, 464],
  ['seated:off', 326, 414, 480, 464],
  ['session', 32, 532, 480, 584],
];

/** The button at (u, v) on the panel (0…1 from its bottom left, as castRay reports), or null. */
export function panelButtonAt(u, v) {
  const x = u * PANEL_PX.width, y = (1 - v) * PANEL_PX.height;
  for (const b of PANEL_BUTTONS) {
    if (x >= b[1] && x <= b[3] && y >= b[2] && y <= b[4]) return b[0];
  }
  return null;
}

export function layoutHall(envs, hall = HALL) {
  const slots = Math.max(hall.minSlots, envs.length + (envs.length % 2));
  const pairs = slots / 2;
  const doors = [];
  for (let i = 0; i < slots; i++) {
    const pair = Math.floor(i / 2);
    doors.push({
      index: i,
      side: i % 2 === 0 ? -1 : 1,
      z: -(hall.startLength + pair * hall.pairSpacing),
      env: envs[i] || null,
    });
  }
  const pairZ = [];
  for (let p = 0; p < pairs; p++) pairZ.push(-(hall.startLength + p * hall.pairSpacing));
  const zEnd = pairZ[pairs - 1] - hall.endLength;
  const beams = [];
  for (let p = 0; p + 1 < pairs; p++) beams.push((pairZ[p] + pairZ[p + 1]) / 2);
  return {
    hall,
    halfWidth: hall.width / 2,
    zStart: 0,
    zEnd,
    doors,
    pairZ,
    lamps: [-1.6, ...pairZ, zEnd + 1.2],
    beams,
    spawn: { x: 0, z: -1.0, yaw: 0 },
  };
}

// Where arrivals stand, spread out so that two who come at once (a shared session, together.js)
// don't stand inside each other. A key, a visitor's member id hashed, picks the spot, so the same
// visitor always gets the same one.
/** At the entrance: [x, z], 0.6 m or more apart, the first row a little nearer than L.spawn. */
const ENTRANCE_SPOTS = [-0.85, -1.5].flatMap((z) => [-0.9, -0.3, 0.3, 0.9].map((x) => [x, z]));
/** In front of a door: [along the wall from its centre, out from the wall]; the first is the centre. */
const DOOR_SPOTS = [0.85, 1.4].flatMap((out) => [0, -0.4, 0.4].map((along) => [along, out]));

/** Which of n spots a key picks. Its bits are mixed first (MurmurHash3's finaliser): an FNV hash's
 * low bits alone spread similar ids poorly. 0 picks the first. */
function spot(key, n) {
  let h = key >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) % n;
}

/** Where someone arriving at the entrance stands, by key, facing down the hall. */
export function entranceSpawn(L, key) {
  const [x, z] = ENTRANCE_SPOTS[spot(key, ENTRANCE_SPOTS.length)];
  return { x, z, yaw: L.spawn.yaw };
}

/**
 * Where someone coming back out of a door stands: in front of it (within 0.4 m of its centre, by
 * key; key 0 is the centre), turned away from it and down the hall.
 */
export function doorSpawn(L, door, key = 0) {
  const [along, out] = DOOR_SPOTS[spot(key, DOOR_SPOTS.length)];
  return { x: door.side * (L.halfWidth - out), z: door.z + along, yaw: door.side * 0.5 };
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * The nearest place to (x, z) the viewer may stand: inside the hall, or in an open doorway (which
 * they pass through on the way to the other side). Writes { x, z } into out.
 */
export function clampToHall(L, x, z, out = { x: 0, z: 0 }) {
  const { hall } = L;
  const lim = L.halfWidth - L.hall.margin;
  z = clamp(z, L.zEnd + hall.margin, L.zStart - hall.margin);
  if (x < -lim || x > lim) {
    const side = x < 0 ? -1 : 1;
    // In a doorway: stay between its jambs, which the shoulders keep clear of.
    const half = hall.doorWidth / 2 - 0.2;
    let door = null;
    for (const d of L.doors) {
      if (d.env && d.side === side && Math.abs(z - d.z) < half + 0.3) door = d;
    }
    if (door && Math.abs(z - door.z) < half) {
      x = clamp(x, -(L.halfWidth + hall.reveal + 0.1), L.halfWidth + hall.reveal + 0.1);
    } else if (door && side * x > lim + 0.08) {
      z = clamp(z, door.z - half, door.z + half); // already in the doorway: slide along it
      x = clamp(x, -(L.halfWidth + hall.reveal + 0.1), L.halfWidth + hall.reveal + 0.1);
    } else {
      x = clamp(x, -lim, lim);
    }
  }
  out.x = x;
  out.z = z;
  return out;
}

/** The open door whose threshold a head at (x, z) has crossed, or null. */
export function doorCrossed(L, x, z) {
  const half = L.hall.doorWidth / 2;
  const past = L.halfWidth + L.hall.threshold;
  for (const d of L.doors) {
    if (d.env && d.side * x > past && Math.abs(z - d.z) < half) return d;
  }
  return null;
}

/**
 * What a ray from inside the hall reaches first: a doorway (open or closed), the control panel, the
 * window, the floor, a wall or the ceiling. The hall is a box, so this is where the ray leaves it.
 * Writes into out { t, kind, door, x, y, z, nx, ny, nz, u, v } (n: the surface's normal, pointing
 * into the hall; u, v: where on the panel, 0…1 from its bottom left) and returns it, or null when
 * the ray leaves through no surface (it starts outside, pointing away).
 */
export function castRay(L, ox, oy, oz, dx, dy, dz, out) {
  const { hall } = L;
  const hw = L.halfWidth;
  let t = Infinity;
  let plane = '';
  if (dx < 0) { const s = (-hw - ox) / dx; if (s > 0 && s < t) { t = s; plane = 'left'; } }
  if (dx > 0) { const s = (hw - ox) / dx; if (s > 0 && s < t) { t = s; plane = 'right'; } }
  if (dy < 0) { const s = -oy / dy; if (s > 0 && s < t) { t = s; plane = 'floor'; } }
  if (dy > 0) { const s = (hall.height - oy) / dy; if (s > 0 && s < t) { t = s; plane = 'ceiling'; } }
  if (dz < 0) { const s = (L.zEnd - oz) / dz; if (s > 0 && s < t) { t = s; plane = 'end'; } }
  if (dz > 0) { const s = (L.zStart - oz) / dz; if (s > 0 && s < t) { t = s; plane = 'entrance'; } }
  if (t === Infinity) return null;
  const x = ox + dx * t, y = oy + dy * t, z = oz + dz * t;
  out.t = t;
  out.x = x;
  out.y = y;
  out.z = z;
  out.door = null;
  out.nx = 0;
  out.ny = 0;
  out.nz = 0;
  out.u = 0;
  out.v = 0;
  if (plane === 'left' || plane === 'right') {
    const side = plane === 'left' ? -1 : 1;
    out.kind = 'wall';
    out.nx = -side;
    if (side === PANEL.side) {
      // The panel's face stands a little out from the wall, so the ray meets it first.
      const px = side * (hw - PANEL.depth);
      const s = (px - ox) / dx;
      const py = oy + dy * s, pz = oz + dz * s;
      const u = 0.5 + (side * (pz - PANEL.z)) / PANEL.width;
      const v = 0.5 + (py - PANEL.y) / PANEL.height;
      if (s > 0 && u >= 0 && u <= 1 && v >= 0 && v <= 1) {
        out.kind = 'panel';
        out.t = s;
        out.x = px;
        out.y = py;
        out.z = pz;
        out.u = u;
        out.v = v;
        return out;
      }
    }
    if (y < hall.doorHeight) {
      for (const d of L.doors) {
        if (d.side === side && Math.abs(z - d.z) < hall.doorWidth / 2) {
          out.kind = 'door';
          out.door = d;
          break;
        }
      }
    }
  } else if (plane === 'floor') {
    out.kind = 'floor';
    out.ny = 1;
  } else if (plane === 'ceiling') {
    out.kind = 'ceiling';
    out.ny = -1;
  } else if (plane === 'end') {
    out.kind = Math.abs(x) < WINDOW.width / 2 && y > WINDOW.bottom && y < WINDOW.top ? 'window' : 'wall';
    out.nz = 1;
  } else {
    out.kind = 'wall';
    out.nz = -1;
  }
  return out;
}
