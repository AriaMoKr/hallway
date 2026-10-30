// Moving about the hall and choosing doors, on every device: common's walking (common/controls.js,
// whose README says what each device does: a drag looks, WASD or the arrows walk, a click, a tap, a
// gamepad's A, the TV remote's OK or a trigger uses what it is on, the sticks walk, turn or aim a
// teleport in VR), with the hall's own:
//   - what a ray meets (layout.js's castRay: the doorways, the control panel, the floor, the only
//     walkable ground, and the walls) and where one may walk (clampToHall: the hall, and the open
//     doorways on the way through them);
//   - its doors: only one that leads somewhere is used ('door': the cursor, the dot and the reticle),
//     but every door comes to onDoor (main.js says a closed one isn't open yet), and walkInto walks
//     up to a door and through it;
//   - the control panel on the wall: the button pointed at (hoverPanel), and pressed (onPanel).
// Per frame nothing is allocated.
import { Controls as Walking } from 'common/controls.js';
import { castRay, clampToHall, panelButtonAt } from './layout.js';

/** What each key does, by keyOf's name: common's (test/tv.test.js reads it here). */
export { KEYS } from 'common/controls.js';

/**
 * What a ray meets in the hall (layout.js's castRay): common's Hit, with the door met (open or
 * closed; null off the doorways) and where on the control panel (u, v: 0…1 from its bottom left).
 * @typedef {import('common/controls.js').Hit & { door: import('./layout.js').Door | null, u: number, v: number }} HallHit
 */

/**
 * Walking about the hall: common's, with its doors and its control panel.
 * @extends {Walking<HallHit>}
 */
export class Controls extends Walking {
  /**
   * @param {Omit<import('common/controls.js').ControlsOptions<HallHit>, 'eye' | 'hit'> & { layout: import('./layout.js').Layout }} options
   */
  constructor({ layout, ...options }) {
    super({ ...options, hit: () => ({ t: 0, kind: '', door: null, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, u: 0, v: 0, walkable: false }) });
    this.layout = layout; // after super(): common's constructor calls none of the methods below
    /** The open door pointed at, or null (hoverDoor, common's, says only whether it is a doorway). @type {import('./layout.js').Door | null} */
    this.pointedDoor = null;
    /** The control panel's button pointed at, or null. @type {string | null} */
    this.hoverPanel = null;
    /** (button id) when a button of the control panel is pressed. @type {(id: string) => void} */
    this.onPanel = () => {};
  }

  castRay(ox, oy, oz, dx, dy, dz, out) {
    return castRay(this.layout, ox, oy, oz, dx, dy, dz, out);
  }

  clampWalk(fx, fz, x, z, out) {
    return clampToHall(this.layout, x, z, out);
  }

  /** A panel's button, or 'door' on a door that leads somewhere: a closed one is no more than the wall. */
  usable(hit) {
    if (hit?.kind === 'panel') return panelButtonAt(hit.u, hit.v);
    if (hit?.kind === 'door' && !hit.door?.env) return null;
    return super.usable(hit);
  }

  /** A panel's button pressed; the rest is common's: every door to onDoor, the floor walked or teleported to. */
  use(hit, how) {
    if (hit?.kind === 'panel') this._press(panelButtonAt(hit.u, hit.v));
    else super.use(hit, how);
  }

  _setHover(usable, hit) {
    super._setHover(usable, hit);
    this.pointedDoor = usable === 'door' ? hit.door : null;
    this.hoverPanel = hit?.kind === 'panel' ? usable : null;
  }

  /**
   * Walks up to a door and through it, facing it from the first step (`false`, _startWalk's turn):
   * main.js's go() hands the view on as the head crosses the threshold, on the way, so it must face
   * the door by then.
   * @param {import('./layout.js').Door} [door] optional only so that it overrides common's walkInto()
   */
  walkInto(door) {
    if (!door) return;
    const hw = this.layout.halfWidth;
    /** @type {[number, number]} */
    const front = [door.side * (hw - 0.75), door.z];
    /** @type {[number, number]} */
    const through = [door.side * (hw + 0.4), door.z];
    const p = this.rig.position;
    const inFront = door.side * p.x > hw - 0.8 && Math.abs(p.z - door.z) < this.layout.hall.doorWidth / 2 - 0.2;
    this._startWalk(inFront ? [through] : [front, through], -door.side * Math.PI / 2, null, false);
  }

  _press(id) {
    if (id) this.onPanel(id);
  }
}
