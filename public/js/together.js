// Sharing the hallway: a shared session (AriaMoKr/layersharedsession, peer to peer over WebRTC with
// Trystero) that the control panel starts and leaves, run by the layer's controller (its
// together.js, createTogether). Its room is in the address (?room=), so the address is the
// invitation, and the doors carry it on (common/door.js), so the visitor stays in it in the
// environments and coming back. The others in it who are in the hallway are drawn by the layer's
// avatars.js: a head with a visor on its front, a hand per tracked controller, a ring on the floor
// and their name. A visitor names themself (the overlay's box; the name is kept for every site on
// the origin), sees who else is in the session and where, and can wave: the others' avatar of them
// bobs, and they get a toast. The session module (and Trystero under it, ~360 kB) loads only when
// a session starts, so a visit without one costs nothing.
//
// What is the hallway's own is here: its app id and page, the avatars in its font, and its words
// for the session (presence.js).
import { createTogether } from 'layersharedsession/together.js';
import { HALLWAY_ID } from 'common/door.js';
import { ENVIRONMENTS } from './environments.js';
import { noticeText, peopleList, peopleText, placeName, statusText } from './presence.js';
import { SANS } from './textures.js';

/** The app id every site in the session uses (and layersharedsession's test page, which can watch). */
export const APP_ID = 'ariamokr-layersharedsession-test';

/** Pages in words for the layer's log, the hallway by name. */
const pageName = (page) => (page === HALLWAY_ID ? 'the hallway' : placeName(page, ENVIRONMENTS));

/**
 * The hallway's shared session: everyone on its page is here (no isHere).
 * @param {object} o
 * @param {THREE.Scene} o.scene
 * @param {THREE.Camera} o.camera  the viewer's head
 * @param {THREE.WebGLRenderer} o.renderer
 * @param {() => Array<{controller: THREE.Object3D, source: XRInputSource|null}>} o.hands  controls.js's hands
 */
export function hallwayTogether({ scene, camera, renderer, hands }) {
  return createTogether({ appId: APP_ID, page: HALLWAY_ID, camera, renderer, hands, avatars: { parent: scene, font: SANS }, pageName });
}

/** How the session is doing, in a few words. */
export const sessionStatus = (together) => statusText({ ...together.condition(), ...together.company() });

/** The others whose hello has come, for the overlay: those here first. */
export const sessionPeople = (together) => peopleList(together.people(), ENVIRONMENTS);

/** The others for the control panel, as a string: no round trips, which change every 2 s. */
export const panelPeople = (together) => peopleText(sessionPeople(together));

/** A notice (someone said hello, came in, left or waved) as its toast. */
export const noticeToast = (notice) => noticeText(notice, ENVIRONMENTS);
