// A gamepad as a first-person controller, in fullscreen: the left stick walks (clicked in, it
// runs), the right one looks, A uses what the middle of the view is on, View (Back, Select, Share
// or −) leaves fullscreen. Pure: it reads a Gamepad-shaped object, for the tests.

/** Buttons in the standard mapping (https://w3c.github.io/gamepad/#remapping). */
export const BUTTON = { a: 0, view: 8, leftStick: 10 };

/** How far a stick moves before it counts: worn sticks rest a little off centre. */
export const DEADZONE = 0.15;

/**
 * The factor to multiply a stick's (x, y) by: 0 inside the dead zone, then rising to reach 1 at
 * full tilt, squared when `fine` (looking: small tilts turn slowly, for aiming).
 */
function stickScale(x, y, fine) {
  const m = Math.hypot(x, y);
  if (m <= DEADZONE) return 0;
  const k = Math.min(1, (m - DEADZONE) / (1 - DEADZONE));
  return (fine ? k * k : k) / m;
}

/**
 * What a gamepad asks for now. Writes into out { moveX, moveY, lookX, lookY, run, use, exit }:
 * the sticks as -1…1 (y down, as gamepads give it), the buttons as held or not.
 */
export function readPad(pad, out = { moveX: 0, moveY: 0, lookX: 0, lookY: 0, run: false, use: false, exit: false }) {
  const a = pad.axes;
  const lx = a[0] ?? 0, ly = a[1] ?? 0, rx = a[2] ?? 0, ry = a[3] ?? 0;
  const m = stickScale(lx, ly, false), l = stickScale(rx, ry, true);
  out.moveX = lx * m;
  out.moveY = ly * m;
  out.lookX = rx * l;
  out.lookY = ry * l;
  const held = (i) => !!pad.buttons[i]?.pressed;
  out.run = held(BUTTON.leftStick);
  out.use = held(BUTTON.a);
  out.exit = held(BUTTON.view);
  return out;
}
