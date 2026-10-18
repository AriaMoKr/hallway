// The link a door opens: its environment's URL with how the visitor came through the doorway, so
// the environment can carry the view on from it (README: Going in). Pure, for the tests.

/** The hallway's name in `from`. */
export const HALLWAY_ID = 'hallway';

/** The query parameters the hallway adds to a door's URL. A door's own URL must not use them. */
export const LINK_PARAMS = ['from', 'back', 'dx', 'yaw', 'pitch', 'dw', 'dh', 'glow'];

const DEG = 180 / Math.PI;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
/** v with at most `digits` decimals, no trailing zeros and no minus on a zero. */
const num = (v, digits) => String(+v.toFixed(digits));

/**
 * How a head at (x, z), looking along (dx, dy, dz), goes through a door, in the doorway's own
 * terms: `across`, metres from the doorway's centre, + to the right facing in (kept within the
 * opening); `yaw`, radians from straight in, + turned left as three.js's rotation.y (kept within
 * ±90°); `pitch`, radians, + looking up.
 */
export function doorPose(L, door, x, z, dx, dy, dz) {
  // Facing in, the visitor faces x × side, and their right is z × side.
  const half = L.hall.doorWidth / 2;
  const across = clamp(door.side * (z - door.z), -half, half);
  const inward = (-door.side * Math.PI) / 2; // the hallway's yaw that faces straight in
  const yaw = clamp(wrapAngle(Math.atan2(-dx, -dz) - inward), -Math.PI / 2, Math.PI / 2);
  const pitch = Math.asin(clamp(dy / (Math.hypot(dx, dy, dz) || 1), -1, 1));
  return { across, yaw, pitch };
}

/**
 * The URL env's door opens.
 * @param {{id: string, url: string, color: string}} env  an entry of environments.js
 * @param {object} o
 * @param {string} o.here  this page's URL: the way back is it with ?from=<env.id>
 * @param {{doorWidth: number, doorHeight: number}} o.hall
 * @param {{across: number, yaw: number, pitch: number}} [o.pose]  doorPose; none for the doors list
 * @param {boolean} [o.xr]  in VR the headset gives the pitch, so it is left out
 */
export function doorLink(env, { here, hall, pose = null, xr = false }) {
  const back = new URL(here);
  back.search = '';
  back.hash = '';
  back.searchParams.set('from', env.id);
  const url = new URL(env.url);
  const q = url.searchParams;
  q.set('from', HALLWAY_ID);
  q.set('back', back.href);
  if (pose) {
    q.set('dx', num(pose.across, 2));
    q.set('yaw', num(pose.yaw * DEG, 0));
    if (!xr) q.set('pitch', num(pose.pitch * DEG, 0));
  }
  q.set('dw', num(hall.doorWidth, 2));
  q.set('dh', num(hall.doorHeight, 2));
  q.set('glow', env.color.replace(/^#/, '').toLowerCase());
  return url.href;
}
