// Sharing the hallway: a shared session (AriaMoKr/layersharedsession, peer to peer over WebRTC with
// Trystero) that the control panel starts and leaves. Its room is in the address (?room=), so the
// address is the invitation, and the doors carry it on (link.js), so the visitor stays in it in the
// environments and coming back. The others in it who are in the hallway are drawn here: a head with
// a visor on its front, a hand per tracked controller, a ring on the floor and their name. A visitor
// names themself (the overlay's box; the name is kept for every site on the origin), sees who else
// is in the session and where (presence.js words it), and can wave: the others' avatar of them
// bobs, and they get a toast.
//
// The session module (and Trystero under it, ~360 kB) loads only when a session starts, so a visit
// without one costs nothing.
import * as THREE from 'three';
import { cleanName, loadIdentity, saveName } from 'layersharedsession/identity.js';
import { newRoom } from 'layersharedsession/room.js';
import { emptyPose, hasPart, INTERP_DELAY_MS, latestPose, PART, PART_LENGTH, samplePose, setPart } from 'layersharedsession/pose.js';
import { ENVIRONMENTS } from './environments.js';
import { HALLWAY_ID } from './link.js';
import { peopleText, placeName, statusText } from './presence.js';
import { SANS } from './textures.js';

/** The app id every site in the session uses (and layersharedsession's test page, which can watch). */
export const APP_ID = 'ariamokr-layersharedsession-test';

/** How long the session may go without a relay before it says it can't reach them. */
const RELAY_WAIT_MS = 10000;
/** A wave's bob (the layer's test page's), and how soon the same visitor's next wave counts. */
const WAVE_MS = 1200;
const WAVE_AGAIN_MS = 1000;
/** The layer's log line for a failed handshake with a peer (a network that needs a TURN relay). */
const HANDSHAKE_FAILED = /^Couldn't connect to a peer/;

const storage = (name) => {
  try {
    return window[name];
  } catch {
    return null;
  }
};
const where = (page) => placeName(page, ENVIRONMENTS);
const inPlace = (page) => (where(page) === 'elsewhere' ? 'elsewhere' : `in ${where(page)}`);
/** Pages in words for the layer's log, the hallway by name. */
const pageName = (page) => (page === HALLWAY_ID ? 'the hallway' : where(page));

/** A box whose faces are shaded as if lit from above, like the hall's baked light (unlit material). */
function shadedBox(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  // BoxGeometry's faces, 4 vertices each: +x, -x, +y, -y, +z, -z.
  const shade = [0.78, 0.78, 1, 0.55, 0.88, 0.88];
  const colors = [];
  for (const s of shade) for (let i = 0; i < 4; i++) colors.push(s, s, s);
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return g;
}

const headGeometry = shadedBox(0.2, 0.24, 0.22);
const visorGeometry = shadedBox(0.17, 0.06, 0.02).translate(0, 0.02, -0.115);
const handGeometry = shadedBox(0.06, 0.04, 0.12);
const ringGeometry = new THREE.RingGeometry(0.2, 0.25, 32).rotateX(-Math.PI / 2);
const visorMaterial = new THREE.MeshBasicMaterial({ color: '#15110c', vertexColors: true });

function labelSprite(text, color) {
  const size = 44;
  const canvas = document.createElement('canvas');
  const g = canvas.getContext('2d');
  const font = `600 ${size}px ${SANS}`;
  g.font = font;
  const w = Math.ceil(g.measureText(text).width) + size;
  const h = Math.ceil(size * 1.6);
  canvas.width = w;
  canvas.height = h;
  g.font = font;
  g.fillStyle = `${color}d9`;
  g.beginPath();
  g.roundRect(0, 0, w, h, h / 2);
  g.fill();
  g.fillStyle = '#1a1208';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  const height = 0.1;
  sprite.scale.set((height * w) / h, height, 1);
  return sprite;
}

export class Together {
  /**
   * @param {object} o
   * @param {THREE.Scene} o.scene
   * @param {THREE.Camera} o.camera  the viewer's head
   * @param {THREE.WebGLRenderer} o.renderer
   * @param {() => Array<{controller: THREE.Object3D, source: XRInputSource|null}>} o.hands  controls.js's hands
   */
  constructor({ scene, camera, renderer, hands }) {
    this.camera = camera;
    this.renderer = renderer;
    this.hands = hands;
    this.session = null;
    this.room = null; // the room joined, or kept while paused (going through a door)
    this.paused = false;
    this.onChange = () => {};
    this.onNotice = () => {};
    this.group = new THREE.Group();
    this.group.name = 'visitors';
    scene.add(this.group);
    this.avatars = []; // index loops, no allocation per frame
    this._pose = emptyPose();
    this._sample = emptyPose();
    this._pos = new THREE.Vector3();
    this._quat = new THREE.Quaternion();
    this._joining = 0; // which join is current: a slow import must not join a room left since
    this._slow = false; // no relay RELAY_WAIT_MS after joining
    this._slowTimer = 0;
    this._failed = 0; // handshakes that failed
    this._waves = new Map(); // peer id → when its last wave counted
    const changed = () => this.active && this.onChange();
    addEventListener('online', changed);
    addEventListener('offline', changed);
  }

  /** This visitor: { memberId, name, color }, the session's once in one. */
  get self() {
    return this.session?.self ?? loadIdentity(storage('sessionStorage'), storage('localStorage'));
  }

  /**
   * Names this visitor, for everyone in the session (the layer sends its hello again), and keeps
   * the name for this tab and as the default for new ones, on every site of the origin. A name
   * that cleans up to nothing is ignored. Returns the name kept.
   */
  setName(name) {
    const clean = cleanName(name);
    if (!clean) return this.self.name;
    saveName(storage('sessionStorage'), storage('localStorage'), clean);
    this.session?.setName(clean);
    this.onChange();
    return clean;
  }

  /** How the session is doing, in a few words (presence.js). */
  get status() {
    const s = this.session;
    let here = 0, away = 0, connecting = 0;
    if (s) {
      for (const p of s.peers.values()) {
        if (!p.page) connecting++;
        else if (p.page === HALLWAY_ID) here++;
        else away++;
      }
    }
    return statusText({ online: navigator.onLine !== false, loaded: !!s, relays: s?.relays.open ?? 0, slow: this._slow, here, away, connecting, failed: this._failed });
  }

  /** The others whose hello has come: [{ peerId, name, color, where, rtt }], those here first. */
  people() {
    const out = [];
    if (this.session) {
      for (const p of this.session.peers.values()) if (p.page) out.push({ peerId: p.peerId, name: p.name, color: p.color, where: where(p.page), rtt: p.rtt });
    }
    return out.sort((a, b) => (b.where === 'here') - (a.where === 'here') || a.name.localeCompare(b.name));
  }

  /** The others for the control panel, as a string (presence.js): no round trips, which change every 2 s. */
  panelPeople() {
    return peopleText(this.people());
  }

  /** Waves to the others in the session. False when not in one. */
  wave() {
    if (!this.session) return false;
    this.session.channel('wave').send(1);
    return true;
  }

  /** In a session (joined, or joining). */
  get active() {
    return !!this.room && !this.paused;
  }

  /** The address that brings others into the session: this page with only ?room=. */
  get inviteLink() {
    if (!this.room) return '';
    const url = new URL(location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('room', this.room);
    return url.href;
  }

  /** How many others are in the hallway (here) and elsewhere in the session (away). */
  company() {
    let here = 0, away = 0;
    if (this.session) {
      for (const p of this.session.peers.values()) {
        if (p.page === HALLWAY_ID) here++;
        else if (p.page) away++;
      }
    }
    return { here, away };
  }

  /** Starts a session in `room` (a new one by default), and puts the room in the address. */
  start(room = newRoom()) {
    this._leave();
    this.room = room;
    this.paused = false;
    this._setAddress(room);
    this._join();
    this.onChange();
  }

  /** Leaves the session and takes the room out of the address. */
  stop() {
    this._leave();
    this.room = null;
    this.paused = false;
    this._setAddress(null);
    this.onChange();
  }

  /** Leaves for now, keeping the room: going through a door (the link carries the room on). */
  pause() {
    if (!this.active) return;
    this._leave();
    this.paused = true;
    this.onChange();
  }

  /** Back after a pause (the door's navigation didn't happen, or Back restored this page). */
  resume() {
    if (!this.paused || !this.room) return;
    this.paused = false;
    this._join();
    this.onChange();
  }

  async _join() {
    const ticket = ++this._joining;
    clearTimeout(this._slowTimer);
    this._slow = false;
    this._failed = 0;
    this._slowTimer = setTimeout(() => {
      this._slow = true;
      this.onChange();
    }, RELAY_WAIT_MS);
    const { joinSession } = await import('layersharedsession/session.js');
    if (ticket !== this._joining || !this.active) return;
    const identity = loadIdentity(storage('sessionStorage'), storage('localStorage'));
    const s = joinSession({ appId: APP_ID, room: this.room, page: HALLWAY_ID, identity, storage: storage('sessionStorage'), pageName });
    this.session = s;
    s.on('relays', () => this.onChange());
    s.on('self', () => this.onChange());
    s.on('log', (e) => {
      if (e.kind !== 'error' || !HANDSHAKE_FAILED.test(e.text)) return;
      this._failed++;
      this.onChange();
    });
    s.channel('wave').on((_, p) => this._waved(p));
    s.on('join', (p) => {
      this._show(p);
      this.onNotice(p.page === HALLWAY_ID ? `${p.name} is here` : `${p.name} is in the session, ${inPlace(p.page)}`);
      this.onChange();
    });
    s.on('update', (p) => {
      const a = this._show(p);
      if (a.page !== p.page && p.page === HALLWAY_ID) this.onNotice(`${p.name} came into the hallway`);
      a.page = p.page;
      this.onChange();
    });
    s.on('leave', (p) => {
      this._drop(p.peerId);
      this.onNotice(`${p.name || 'Someone'} left the session`);
      this.onChange();
    });
    this.onChange();
  }

  _leave() {
    this._joining++;
    clearTimeout(this._slowTimer);
    this._slow = false;
    this._failed = 0;
    this._waves.clear();
    if (!this.session) return;
    this.session.leave();
    this.session = null;
    while (this.avatars.length) this._drop(this.avatars[0].peerId);
  }

  _setAddress(room) {
    const url = new URL(location.href);
    if (room) url.searchParams.set('room', room);
    else url.searchParams.delete('room');
    history.replaceState(history.state, '', url.href);
  }

  /** The avatar for a visitor, made or relabelled. */
  _show(peer) {
    let a = this.avatars.find((x) => x.peerId === peer.peerId);
    if (!a) {
      const material = new THREE.MeshBasicMaterial({ color: peer.color, vertexColors: true });
      const ringMaterial = new THREE.MeshBasicMaterial({ color: peer.color, transparent: true, opacity: 0.55, depthWrite: false });
      const head = new THREE.Mesh(headGeometry, material);
      head.add(new THREE.Mesh(visorGeometry, visorMaterial));
      const hands = [new THREE.Mesh(handGeometry, material), new THREE.Mesh(handGeometry, material)];
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      const group = new THREE.Group();
      group.name = `visitor ${peer.peerId}`;
      group.visible = false;
      group.add(head, hands[0], hands[1], ring);
      this.group.add(group);
      a = { peerId: peer.peerId, group, head, hands, ring, material, ringMaterial, label: null, name: null, color: null, page: peer.page, waveAt: -Infinity };
      this.avatars.push(a);
    }
    const name = peer.name || '…';
    if (a.name !== name || a.color !== peer.color) {
      if (a.label) {
        a.group.remove(a.label);
        a.label.material.map.dispose();
        a.label.material.dispose();
      }
      a.label = labelSprite(name, peer.color);
      a.group.add(a.label);
      a.material.color.set(peer.color);
      a.ringMaterial.color.set(peer.color);
      a.name = name;
      a.color = peer.color;
    }
    return a;
  }

  /** A wave from `peer`: its avatar bobs (when it's in the hallway) and a toast says so. Anyone can
   * send anything, so a visitor's waves count at most once a second. */
  _waved(peer) {
    const now = performance.now();
    if (now - (this._waves.get(peer.peerId) ?? -Infinity) < WAVE_AGAIN_MS) return;
    this._waves.set(peer.peerId, now);
    const a = this.avatars.find((x) => x.peerId === peer.peerId);
    if (a) a.waveAt = now;
    const name = peer.name || 'Someone';
    this.onNotice(!peer.page || peer.page === HALLWAY_ID ? `${name} waved` : `${name} waved, ${inPlace(peer.page)}`);
  }

  _drop(peerId) {
    this._waves.delete(peerId);
    const i = this.avatars.findIndex((x) => x.peerId === peerId);
    if (i < 0) return;
    const a = this.avatars[i];
    this.avatars.splice(i, 1);
    this.group.remove(a.group);
    a.material.dispose();
    a.ringMaterial.dispose();
    if (a.label) {
      a.label.material.map.dispose();
      a.label.material.dispose();
    }
  }

  /** Per frame: sends where the head and hands are (at most 15 times a second), and places the others. */
  update(now) {
    const s = this.session;
    if (!s) return;
    const pose = this._pose;
    this.camera.getWorldPosition(this._pos);
    this.camera.getWorldQuaternion(this._quat);
    setPart(pose, PART.head, this._pos, this._quat);
    setPart(pose, PART.left, null);
    setPart(pose, PART.right, null);
    if (this.renderer.xr.isPresenting) {
      const hands = this.hands();
      for (let i = 0; i < hands.length; i++) {
        const side = hands[i].source?.handedness;
        if (side !== 'left' && side !== 'right') continue;
        hands[i].controller.getWorldPosition(this._pos);
        hands[i].controller.getWorldQuaternion(this._quat);
        setPart(pose, side === 'left' ? PART.left : PART.right, this._pos, this._quat);
      }
    }
    s.setPose(pose);
    s.tick();

    for (let i = 0; i < this.avatars.length; i++) {
      const a = this.avatars[i];
      const peer = s.peers.get(a.peerId);
      const p = peer && peer.page === HALLWAY_ID && latestPose(peer.buffer) ? samplePose(peer.buffer, now - INTERP_DELAY_MS, this._sample) : null;
      if (!p || !hasPart(p, PART.head)) {
        a.group.visible = false;
        continue;
      }
      a.group.visible = true;
      a.head.position.fromArray(p, 0);
      a.head.quaternion.fromArray(p, 3);
      for (let h = 0; h < 2; h++) {
        const part = h === 0 ? PART.left : PART.right;
        const hand = a.hands[h];
        hand.visible = hasPart(p, part);
        if (!hand.visible) continue;
        hand.position.fromArray(p, part * PART_LENGTH);
        hand.quaternion.fromArray(p, part * PART_LENGTH + 3);
      }
      a.ring.position.set(p[0], 0.01, p[2]);
      // A wave: the head bobs bigger and the name lifts, four times, dying away (as the test page).
      const k = (now - a.waveAt) / WAVE_MS;
      const bob = k >= 0 && k < 1 ? Math.abs(Math.sin(k * Math.PI * 4) * (1 - k)) : 0;
      a.head.scale.setScalar(1 + 0.25 * bob);
      a.label.position.set(p[0], p[1] + 0.25 + 0.12 * bob, p[2]);
    }
  }
}
