// Sharing the hallway: a shared session (AriaMoKr/layersharedsession, peer to peer over WebRTC with
// Trystero) that the control panel starts and leaves. Its room is in the address (?room=), so the
// address is the invitation, and the doors carry it on (common/door.js), so the visitor stays in it
// in the environments and coming back. The others in it who are in the hallway are drawn by the
// layer's avatars.js: a head with a visor on its front, a hand per tracked controller, a ring on the
// floor and their name. A visitor names themself (the overlay's box; the name is kept for every
// site on the origin), sees who else is in the session and where (presence.js words it), and can
// wave: the others' avatar of them bobs, and they get a toast.
//
// The session module (and Trystero under it, ~360 kB) loads only when a session starts, so a visit
// without one costs nothing.
import { createAvatars, readPose } from 'layersharedsession/avatars.js';
import { cleanName, loadIdentity, saveName } from 'layersharedsession/identity.js';
import { newRoom } from 'layersharedsession/room.js';
import { emptyPose } from 'layersharedsession/pose.js';
import { ENVIRONMENTS } from './environments.js';
import { HALLWAY_ID } from 'common/door.js';
import { peopleText, placeName, statusText } from './presence.js';
import { SANS } from './textures.js';

/** The app id every site in the session uses (and layersharedsession's test page, which can watch). */
export const APP_ID = 'ariamokr-layersharedsession-test';

/** How long the session may go without a relay before it says it can't reach them. */
const RELAY_WAIT_MS = 10000;
/** How soon the same visitor's next wave counts (the bob itself is avatars.js's). */
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
/** Whose avatar shows: those in the hallway. */
const inHallway = (peer) => peer.page === HALLWAY_ID;

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
    this.avatars = createAvatars({ parent: scene, font: SANS });
    this._pose = emptyPose();
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
      this.avatars.show(p);
      this.onNotice(p.page === HALLWAY_ID ? `${p.name} is here` : `${p.name} is in the session, ${inPlace(p.page)}`);
      this.onChange();
    });
    s.on('update', (p) => {
      const a = this.avatars.show(p);
      if (a.page !== p.page && p.page === HALLWAY_ID) this.onNotice(`${p.name} came into the hallway`);
      a.page = p.page;
      this.onChange();
    });
    s.on('leave', (p) => {
      this._waves.delete(p.peerId);
      this.avatars.drop(p.peerId);
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
    this.avatars.clear();
  }

  _setAddress(room) {
    const url = new URL(location.href);
    if (room) url.searchParams.set('room', room);
    else url.searchParams.delete('room');
    history.replaceState(history.state, '', url.href);
  }

  /** A wave from `peer`: its avatar bobs (when it's in the hallway) and a toast says so. Anyone can
   * send anything, so a visitor's waves count at most once a second. */
  _waved(peer) {
    const now = performance.now();
    if (now - (this._waves.get(peer.peerId) ?? -Infinity) < WAVE_AGAIN_MS) return;
    this._waves.set(peer.peerId, now);
    this.avatars.wave(peer.peerId, now);
    const name = peer.name || 'Someone';
    this.onNotice(!peer.page || peer.page === HALLWAY_ID ? `${name} waved` : `${name} waved, ${inPlace(peer.page)}`);
  }

  /** Per frame: sends where the head and hands are (at most 15 times a second), and places the others. */
  update(now) {
    const s = this.session;
    if (!s) return;
    s.setPose(readPose(this.camera, this.renderer.xr.isPresenting ? this.hands() : null, this._pose));
    s.tick();
    this.avatars.place(now, s.peers, inHallway);
  }
}
