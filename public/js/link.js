// How a visitor goes through a door, in the doorway's own terms: the pose a door's link carries
// (common/door.js's doorLink makes the link, AriaMoKr/common's README "Going in" says what it
// means). It measures the hallway's own layout, so it stays here. Pure, for the tests.

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

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
