// The hallway: a corridor whose doors lead to other environments. Walk through a glowing doorway
// (or click it, or point at it in VR and pull the trigger) and the page goes to that environment.
// Coming back, from its link or with Back, puts the viewer in front of the door they left by.
import * as THREE from 'three';
import { ENVIRONMENTS } from './environments.js';
import { doorCrossed, doorSpawn } from './layout.js';
import { buildHall } from './hall.js';
import { Controls } from './controls.js';
import { Fade } from './fade.js';
import { Overlay } from './overlay.js';
import { arrivalDoorId } from './arrival.js';
import { setAnisotropy } from './textures.js';
import { loadNav, saveNav } from './settings.js';

const params = new URLSearchParams(location.search);
const LAST_DOOR = 'hallway.lastDoor';

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

function rememberDoor(id) {
  try {
    sessionStorage.setItem(LAST_DOOR, id);
  } catch {
    // Storage blocked: Back then starts at the entrance.
  }
}
function lastDoor() {
  try {
    return sessionStorage.getItem(LAST_DOOR);
  } catch {
    return null;
  }
}

const overlay = new Overlay(ENVIRONMENTS, { onLeave: (env) => rememberDoor(env.id) });

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

const hall = buildHall(ENVIRONMENTS, { anisotropy });
scene.add(hall.group);
const L = hall.layout;

const controls = new Controls({ renderer, camera, rig, scene, dom: renderer.domElement, layout: L });
const nav = loadNav();
controls.setNav(nav);
const fade = new Fade(camera, 1);

// Where to start: in front of the door just come back through, else at the entrance.
function startPose() {
  const navType = performance.getEntriesByType?.('navigation')?.[0]?.type;
  const id = arrivalDoorId({ search: location.search, referrer: document.referrer, navType, lastDoorId: lastDoor(), envs: ENVIRONMENTS });
  const door = id && L.doors.find((d) => d.env?.id === id);
  return door ? doorSpawn(L, door) : L.spawn;
}
const start = startPose();
controls.setPose(start.x, start.z, start.yaw);

// ── Going through a door ─────────────────────────────────────────────────────

let leaving = null;
let leaveTimer = 0;
function go(door) {
  if (leaving || !door?.env) return;
  leaving = door;
  rememberDoor(door.env.id);
  fade.to(1, renderer.xr.isPresenting ? 0.3 : 0.4, () => location.assign(door.env.url));
  // Still here a while later (the navigation was stopped or failed): come back.
  clearTimeout(leaveTimer);
  leaveTimer = setTimeout(() => arrive(door), 12000);
}

/** Back in the hallway (from the back/forward cache, or after a navigation that did not happen). */
function arrive(door) {
  leaving = null;
  clearTimeout(leaveTimer);
  if (door) {
    const p = doorSpawn(L, door);
    controls.setPose(p.x, p.z, p.yaw);
  }
  fade.to(0, 0.6);
}

window.addEventListener('pageshow', (e) => {
  if (!e.persisted) return;
  const id = lastDoor();
  arrive(L.doors.find((d) => d.env && d.env.id === id) || leaving);
});

controls.onSelect = (door, how) => {
  if (!door.env) {
    overlay.toast('That door is not open yet.');
    return;
  }
  if (how === 'xr') go(door);
  else controls.walkInto(door);
};
let active = false;
controls.onActivity = () => {
  if (active) return;
  active = true;
  overlay.hideHint();
};
overlay.setHint(matchMedia('(pointer: coarse)').matches);

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
navigator.xr?.isSessionSupported?.('immersive-vr').then((ok) => {
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
  hall.panel.set({ vr: renderer.xr.isPresenting ? 'exit' : vrSupported ? 'enter' : 'none', move: nav.move, turn: nav.turn });
}
showPanel();
controls.onPanel = (id) => {
  if (id === 'vr') {
    if (renderer.xr.isPresenting || vrSupported) enterVR(); // enters, or exits when in VR
    return;
  }
  const [key, value] = id.split(':');
  nav[key] = value;
  controls.setNav(nav);
  saveNav(nav);
  showPanel();
};
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

// ── The frame loop ───────────────────────────────────────────────────────────

const head = new THREE.Vector3();
let last = performance.now();
let time = 0;

function step(dt) {
  time += dt;
  controls.update(dt);
  camera.getWorldPosition(head);
  hall.update(time, dt, head, controls.hoverDoor);
  hall.panel.setHover(controls.hoverPanel);
  overlay.setHover(controls.hoverDoor?.env ?? null);
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

fade.to(0, 0.8);

// For scripted testing. A hidden page gets no animation frames: drive it with tick().
window.__hallway = {
  THREE, renderer, scene, camera, rig, hall, layout: L, controls, overlay, fade, xrDevice, go, enterVR,
  tick(dt = 1 / 60, n = 1) {
    for (let i = 0; i < n; i++) step(dt);
    renderer.render(scene, camera);
  },
};
