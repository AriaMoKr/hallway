// The hallway: a corridor whose doors lead to other environments. Walk through a glowing doorway
// (or click it, or point at it in VR and pull the trigger) and the page goes to that environment.
// Coming back, from its link or with Back, puts the viewer in front of the door they left by.
// A shared session (together.js), started from the control panel or joined from an invite link,
// shows the others in it, and the doors carry it into the environments and back. In the Android TV
// app (tv.js) it is the 10-foot view, walked with the remote.
import * as THREE from 'three';
import { ENVIRONMENTS } from './environments.js';
import { HALL, doorCrossed, doorSpawn, entranceSpawn } from './layout.js';
import { buildHall } from './hall.js';
import { Controls } from './controls.js';
import { Fade } from 'common/fade.js';
import { Overlay } from './overlay.js';
import { arrivalDoorId } from './arrival.js';
import { doorLink } from 'common/door.js';
import { NAV_KEY, loadNav, saveNav } from 'common/nav.js';
import { ACCESS_KEY, Vignette, eyeLift, loadAccess, motionQuery, reduceMotion, saveAccess, watchMotion } from 'common/access.js';
import { doorPose } from './link.js';
import { setAnisotropy } from './textures.js';
import { doorView, renderDoorView, renderHallView } from './door-view.js';
import { hallwayTogether, noticeToast, panelPeople, sessionPeople, sessionStatus } from './together.js';
import { hash, loadIdentity } from 'layersharedsession/identity.js';
import { roomFromUrl } from 'layersharedsession/room.js';
import { Remote, isTV, roomFromInput } from './tv.js';

const params = new URLSearchParams(location.search);
// The TV app's page (?tv=emulate: as if, in any browser).
const tv = isTV(navigator.userAgent) || params.get('tv') === 'emulate';
document.documentElement.classList.toggle('tv', tv);
const LAST_DOOR = 'hallway.lastDoor';
// The door a history entry was left by, in its state: Back or Forward to it starts there.
const ENTRY_DOOR = 'hallwayDoor';

// Dev: emulate a Quest 3 with IWER (before anything asks navigator.xr). Chromium has a native
// navigator.xr even without a headset, so it is replaced.
let xrDevice = null;
if (params.get('xr') === 'emulate') {
  try {
    const { XRDevice, metaQuest3 } = await import(new URL('../vendor/iwer/iwer.module.js', import.meta.url).href);
    xrDevice = new XRDevice(metaQuest3);
    xrDevice.installRuntime({ forceInstall: true });
    console.info('hallway: IWER WebXR emulation installed (Meta Quest 3)');
  } catch (err) {
    console.warn(`hallway: no WebXR emulation: ${err.message}`);
  }
}

/** Going through a door: the tab remembers it, and so does this page's history entry. */
function rememberDoor(id) {
  try {
    sessionStorage.setItem(LAST_DOOR, id);
  } catch {
    // Storage blocked: the history entry still has it.
  }
  try {
    // Beside what else the entry's state holds (the layer keeps it when it changes ?room=).
    history.replaceState({ ...history.state, [ENTRY_DOOR]: id }, '');
  } catch {
    // Too many history calls at once (browsers limit them): the tab's door has to do.
  }
}
function lastDoor() {
  try {
    return sessionStorage.getItem(LAST_DOOR);
  } catch {
    return null;
  }
}
/** The door this history entry was left by, if it was left by one. */
function entryDoor() {
  return history.state?.[ENTRY_DOOR] ?? null;
}

let together = null; // the shared session, made once the scene is (below)
const overlay = new Overlay(ENVIRONMENTS, {
  href: (env) => doorLink(env, { here: location.href, hall: HALL, room: together?.room ?? null }),
  onLeave: (env) => rememberDoor(env.id),
  tv,
});

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true });
} catch (err) {
  overlay.noWebGL('This browser cannot show the hallway in 3D, but its doors are open from this list.');
  throw err;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
document.getElementById('app').append(renderer.domElement);
// For a screen reader the view is one picture; the doors list beside it is what it shows, as text.
renderer.domElement.setAttribute('role', 'img');
renderer.domElement.setAttribute('aria-label', 'A hallway whose doors lead to other places. Its doors are listed under Doors.');
const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
setAnisotropy(anisotropy);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0b0907');
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 120);
/** A tall screen (a phone held upright) gets a taller view, so the doors at the sides stay in sight. */
function fitCamera() {
  camera.aspect = innerWidth / innerHeight;
  const wide = (2 * Math.atan(Math.tan((60 / 2) * THREE.MathUtils.DEG2RAD) / camera.aspect)) * THREE.MathUtils.RAD2DEG;
  camera.fov = Math.min(100, Math.max(70, wide));
  camera.updateProjectionMatrix();
}
fitCamera();
const rig = new THREE.Group();
rig.name = 'rig';
rig.add(camera);
scene.add(rig);

const hall = buildHall(ENVIRONMENTS, { anisotropy, large: tv });
scene.add(hall.group);
const L = hall.layout;

const controls = new Controls({ renderer, camera, rig, scene, dom: renderer.domElement, layout: L });
const nav = loadNav();
controls.setNav(nav);
const fade = new Fade(camera, 1);
// The comfort vignette, under the fade: it closes in while the sticks walk or turn smoothly in VR.
const vignette = new Vignette(camera);

// The accessibility settings every site on the origin shares (common/access.js, hallway.access):
// less motion, the vignette, seated. Less motion: a click on the floor jumps there, a door clicked on
// a screen is gone through at once, the fades blink, the doorways' veils hold still, and a wave
// doesn't bob (the toast still says who waved).
let access = loadAccess();
const motion = motionQuery();
let reduce = false;
/** A fade of `seconds`, or a blink with less motion. */
const fadeTime = (seconds) => (reduce ? 0.08 : seconds);
function applyAccess() {
  reduce = reduceMotion(access, motion);
  controls.reduceMotion = reduce;
  controls.setLift(eyeLift(access));
  vignette.enabled = access.vignette;
  if (together) together.reduceMotion = reduce;
  document.documentElement.classList.toggle('reduce-motion', reduce);
}
applyAccess();
/** A setting changed, on the panel or in the overlay's Settings. */
function setAccess(change) {
  access = { ...access, ...change };
  saveAccess(access);
  applyAccess();
  showPanel();
}
watchMotion(() => {
  applyAccess();
  showPanel();
}, motion);
/** The settings again, as another page on the origin left them (one still open, or this one coming back). */
function reloadSettings() {
  access = loadAccess();
  applyAccess();
  Object.assign(nav, loadNav());
  controls.setNav(nav);
  showPanel();
}
addEventListener('storage', (e) => {
  if (e.key === ACCESS_KEY || e.key === NAV_KEY) reloadSettings();
});

// Where to start: in front of the door just come back through, else at the entrance. Arrivals
// spread out by who they are (the shared session's member id, kept for the tab before any session
// starts), so two who arrive together don't stand inside each other.
const browserStorage = (name) => {
  try {
    return window[name];
  } catch {
    return null;
  }
};
const spawnKey = hash(loadIdentity(browserStorage('sessionStorage'), browserStorage('localStorage')).memberId);
function startPose() {
  const navType = performance.getEntriesByType?.('navigation')?.[0]?.type;
  const id = arrivalDoorId({ search: location.search, referrer: document.referrer, navType, entryDoorId: entryDoor(), lastDoorId: lastDoor(), envs: ENVIRONMENTS });
  const door = id && L.doors.find((d) => d.env?.id === id);
  return door ? doorSpawn(L, door, spawnKey) : entranceSpawn(L, spawnKey);
}
const start = startPose();
controls.setPose(start.x, start.z, start.yaw);

// ── Going through a door ─────────────────────────────────────────────────────

let leaving = null;
let leaveTimer = 0;
const eye = new THREE.Vector3();
const look = new THREE.Vector3();
function go(door) {
  if (leaving || !door?.env) return;
  leaving = door;
  rememberDoor(door.env.id);
  // The link tells the environment how the visitor came through, so it can carry the view on.
  camera.getWorldPosition(eye);
  camera.getWorldDirection(look);
  const xr = renderer.xr.isPresenting;
  const pose = doorPose(L, door, eye.x, eye.z, look.x, look.y, look.z);
  const url = doorLink(door.env, { here: location.href, hall: L.hall, pose, xr, room: together.room });
  // Leave the shared session now, so the others see the visitor go at once (the link carries its
  // room on); the fade gives the leaving message time to go out.
  together.pause();
  fade.to(1, fadeTime(xr ? 0.3 : 0.4), () => location.assign(url));
  // Still here a while later (the navigation was stopped or failed): come back.
  clearTimeout(leaveTimer);
  leaveTimer = setTimeout(() => arrive(door), 12000);
}

/** Back in the hallway (from the back/forward cache, or after a navigation that did not happen). */
function arrive(door) {
  leaving = null;
  clearTimeout(leaveTimer);
  if (door) {
    const p = doorSpawn(L, door, spawnKey);
    controls.setPose(p.x, p.z, p.yaw);
  }
  together.resume();
  fade.to(0, fadeTime(0.6));
}

window.addEventListener('pageshow', (e) => {
  if (!e.persisted) return;
  reloadSettings();
  const id = entryDoor() ?? lastDoor();
  arrive(L.doors.find((d) => d.env && d.env.id === id) || leaving);
});
// Leaving the page another way (a link, the address bar, closing it): leave the session too.
window.addEventListener('pagehide', () => together.pause());

controls.onSelect = (door, how) => {
  if (!door.env) {
    overlay.toast('That door is not open yet.');
    return;
  }
  if (how === 'xr' || reduce) go(door);
  else controls.walkInto(door);
};
let active = false;
controls.onActivity = () => {
  if (active) return;
  active = true;
  overlay.hideHint();
};
overlay.setHint(tv ? 'tv' : matchMedia('(pointer: coarse)').matches ? 'touch' : 'mouse');

// On a TV, the remote (tv.js): the view holds the focus while walking, the card when Menu is pressed.
// The app asks window.hallwayTV what Back and Menu do.
let remote = null;
if (tv) {
  controls.aimMiddle = true;
  renderer.domElement.setAttribute('aria-describedby', overlay.hint.id);
  remote = new Remote({ root: overlay.root, view: renderer.domElement, use: () => controls.useMiddle() });
  remote.onMode = (inCard) => overlay.setHint(inCard ? 'tv-card' : 'tv');
  window.hallwayTV = { menu: () => remote.menu(), back: () => remote.back() };
}

// ── Fullscreen, and the gamepad ──────────────────────────────────────────────

const root = document.documentElement;
const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
function toggleFullscreen() {
  const request = fullscreenElement()
    ? (document.exitFullscreen || document.webkitExitFullscreen).call(document)
    : (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
  Promise.resolve(request).catch((err) => overlay.toast(`Could not change fullscreen: ${err.message}`, 5));
}
function onFullscreenChange() {
  const on = !!fullscreenElement();
  overlay.setFullscreen(on);
  if (on) overlay.toast(controls.hasPad ? 'Esc or B leaves fullscreen' : 'Esc leaves fullscreen', 4);
}
// Browsers that cannot (an iPhone's) do not get the button, nor does the TV app, which is full screen.
if (!tv && (document.fullscreenEnabled || document.webkitFullscreenEnabled)) {
  overlay.showFullscreen(toggleFullscreen);
  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);
}
// As in vrlbry: the gamepad takes over when used (its hint, and a dot in the middle of the view to
// aim with), and the mouse takes it back. B or Back leaves fullscreen; on a TV, it is the remote's Back.
controls.onPadActive = (on) => {
  if (on) overlay.setHint('gamepad');
};
controls.onPadBack = () => {
  if (remote) remote.padBack();
  else if (fullscreenElement()) toggleFullscreen();
};

// ── VR ───────────────────────────────────────────────────────────────────────

const SESSION_INIT = { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] };
let entering = false;
async function enterVR() {
  if (renderer.xr.isPresenting) {
    await renderer.xr.getSession().end();
    return;
  }
  if (entering || !navigator.xr) return;
  entering = true;
  try {
    const session = await navigator.xr.requestSession('immersive-vr', SESSION_INIT);
    await renderer.xr.setSession(session);
  } catch (err) {
    console.error(err);
    overlay.toast(`Could not start VR: ${err.message}`, 6);
  } finally {
    entering = false;
  }
}
let vrSupported = false;
renderer.xr.addEventListener('sessionstart', () => {
  overlay.vr.textContent = 'Exit VR';
  showPanel();
});
renderer.xr.addEventListener('sessionend', () => {
  overlay.vr.textContent = 'Enter VR';
  showPanel();
});
// Not on a TV, which has no headset (nor, so far, a WebXR in its WebView).
if (!tv) navigator.xr?.isSessionSupported?.('immersive-vr').then((ok) => {
  vrSupported = ok;
  showPanel();
  if (ok) overlay.showVR(enterVR);
}, () => {});
// Arriving from another environment's immersive session (Quest Browser): the browser grants this
// page a session without a click, for about 5 s and only within one origin (README). The inline
// script in index.html notes a grant made before this module ran.
const takeGranted = () => {
  if (!renderer.xr.isPresenting) enterVR();
};
if (window.hallwayXrGranted) takeGranted();
navigator.xr?.addEventListener?.('sessiongranted', takeGranted);

// ── The control panel on the wall ────────────────────────────────────────────

function showPanel() {
  const room = together?.room ?? null;
  overlay.setPanel({ move: nav.move, turn: nav.turn, motion: access.motion, vignette: access.vignette, seated: access.seated, room });
  hall.panel.set({
    vr: renderer.xr.isPresenting ? 'exit' : vrSupported ? 'enter' : 'none',
    move: nav.move,
    turn: nav.turn,
    motion: access.motion,
    vignette: access.vignette ? 'on' : 'off',
    seated: access.seated ? 'on' : 'off',
    room: together?.room ?? null,
    link: together?.inviteLink.replace(/^https?:\/\//, '') ?? '',
    status: together?.room ? sessionStatus(together) : '',
    people: together?.active ? panelPeople(together) : '',
  });
}
showPanel();
controls.onPanel = (id) => {
  if (id === 'vr') {
    if (renderer.xr.isPresenting || vrSupported) enterVR(); // enters, or exits when in VR
    return;
  }
  if (id === 'session') {
    if (together.room) {
      together.stop();
      overlay.toast('You left the shared session');
    } else {
      together.start();
      overlay.toast('Shared session started: Copy invite link to bring others in', 5);
    }
    return;
  }
  const [key, value] = id.split(':');
  if (key === 'motion') return setAccess({ motion: value });
  if (key === 'vignette' || key === 'seated') return setAccess({ [key]: value === 'on' });
  nav[key] = value;
  controls.setNav(nav);
  saveNav(nav);
  showPanel();
};
// The overlay's Settings press the same buttons.
overlay.onNav = (key, value) => controls.onPanel(`${key}:${value}`);
overlay.onSession = () => controls.onPanel('session');
overlay.onAccess = setAccess;
// A teleport in VR blinks: a moment of black hides the jump.
controls.onTeleport = (move) => {
  if (leaving || !renderer.xr.isPresenting) {
    move();
    return;
  }
  fade.to(1, 0.08, () => {
    move();
    fade.to(0, 0.2);
  });
};

// ── The shared session ───────────────────────────────────────────────────────

together = hallwayTogether({ scene, camera, renderer, hands: () => controls.hands });
together.reduceMotion = reduce;
together.on('change', () => {
  showPanel();
  overlay.setInvite(together.active ? together.inviteLink : '');
  overlay.setTogether(together.active ? { active: true, self: together.self, status: sessionStatus(together), people: sessionPeople(together) } : { active: false });
  overlay.refreshLinks();
});
together.on('notice', (notice) => overlay.toast(noticeToast(notice), 4));
overlay.onName = (name) => together.setName(name);
// On a TV: a room another device shows (its invite link, or the room's name).
overlay.onJoin = (text) => {
  const room = roomFromInput(text);
  if (!room) {
    overlay.toast('A room is named like k3vd-q8hn: the end of its invite link, after ?room=', 6);
    return;
  }
  overlay.joinRoom.value = '';
  together.start(room);
  overlay.toast(`Joined the shared session ${room}`);
  remote.walk(); // the box is gone (in a session): back to the view
};
// A wave: the Wave button, or a controller's grip in VR (which pulses, so the waver feels it go).
overlay.onWave = () => {
  if (together.wave()) overlay.toast('You waved', 2);
};
controls.onSqueeze = (hand) => {
  if (together.wave()) hand.source?.gamepad?.hapticActuators?.[0]?.pulse?.(0.6, 60);
};
// An invite link, or a door's way back from an environment, names the room: join it.
const invitedRoom = roomFromUrl(location.href);
if (invitedRoom) together.start(invitedRoom);

// ── The frame loop ───────────────────────────────────────────────────────────

const head = new THREE.Vector3();
let last = performance.now();
let time = 0;

function step(dt) {
  if (!reduce) time += dt; // the doorways' veils drift with it, and hold still with less motion
  controls.update(dt);
  vignette.update(dt, controls.xrSpeed, controls.xrTurnRate, renderer.xr.isPresenting);
  camera.getWorldPosition(head);
  hall.update(time, dt, head, controls.hoverDoor);
  together.update(performance.now());
  hall.panel.setHover(controls.hoverPanel);
  overlay.setHover(controls.hoverDoor?.env ?? null);
  overlay.setAim((controls.padActive || (remote !== null && !remote.inCard)) && !renderer.xr.isPresenting, !!(controls.hoverDoor?.env || controls.hoverPanel));
  if (!leaving) {
    const door = doorCrossed(L, head.x, head.z);
    if (door) go(door);
  }
  fade.update(dt);
}

renderer.setAnimationLoop(() => {
  const now = performance.now();
  step(Math.min(0.1, (now - last) / 1000));
  last = now;
  renderer.render(scene, camera);
});

addEventListener('resize', () => {
  if (renderer.xr.isPresenting) return;
  fitCamera();
  renderer.setSize(innerWidth, innerHeight);
});

fade.to(0, fadeTime(0.8));

// For scripted testing. A hidden page gets no animation frames: drive it with tick().
window.__hallway = {
  THREE, renderer, scene, camera, rig, hall, layout: L, controls, overlay, fade, vignette, xrDevice, go, enterVR, together, remote,
  get access() {
    return { ...access, reduce };
  },
  /**
   * The view out of every open door (door-view.js), once the doorways' pictures have loaded:
   * [{ id, jpeg (a data: URL), params }], for tools/door-views.mjs.
   */
  async doorViews(quality = 0.88) {
    await hall.previewsLoaded;
    return L.doors.filter((d) => d.env).map((d) => ({
      id: d.env.id,
      jpeg: renderDoorView(renderer, scene, hall, d, { hide: [fade.mesh, vignette.mesh] }).toDataURL('image/jpeg', quality),
      params: doorView(L, d).params,
    }));
  },
  /** The link preview's picture (door-view.js's HALL_VIEW), once the doorways' pictures have loaded: a data: URL. */
  async hallView(quality = 0.88) {
    await hall.previewsLoaded;
    return renderHallView(renderer, scene, hall, { hide: [fade.mesh, vignette.mesh] }).toDataURL('image/jpeg', quality);
  },
  tick(dt = 1 / 60, n = 1) {
    for (let i = 0; i < n; i++) step(dt);
    renderer.render(scene, camera);
  },
};
