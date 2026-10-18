// Moving about the hall and choosing doors, on every device:
//   desktop: drag to look, WASD / arrows to walk (Shift runs), click a door or the floor
//   phone:   drag to look, tap a door or the floor
//   headset: point and pull the trigger (or pinch) at a door or the floor; the left stick walks,
//            the right one turns in steps; or walk through a doorway in the room
// The viewer's body is `rig` (yaw only); the camera is its head (pitch on a desktop, the headset's
// pose in VR). Per frame nothing is allocated.
import * as THREE from 'three';
import { castRay, clampToHall } from './layout.js';

const LOOK = 0.0045; // radians per pixel dragged
const WALK = 1.9, RUN = 3.8, XR_WALK = 1.8; // metres per second
const TURN = 1.9; // radians per second (arrow keys)
const SNAP = Math.PI / 6;
const PITCH = 1.35;
const EYE = 1.6;

const KEYS = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', KeyD: 'right',
  ArrowLeft: 'turnLeft', KeyQ: 'turnLeft',
  ArrowRight: 'turnRight', KeyE: 'turnRight',
  ShiftLeft: 'run', ShiftRight: 'run',
};

const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export class Controls {
  constructor({ renderer, camera, rig, scene, dom, layout }) {
    this.renderer = renderer;
    this.camera = camera;
    this.rig = rig;
    this.scene = scene;
    this.dom = dom;
    this.layout = layout;
    this.yaw = 0;
    this.pitch = 0;
    this.keys = new Set();
    this.hoverDoor = null;
    /** (door, how) when a door is chosen: how is 'screen' or 'xr'. */
    this.onSelect = () => {};
    /** The first time the viewer does anything (hides the hint). */
    this.onActivity = () => {};
    this.auto = null; // a walk under way: { points: [[x, z], …], i, face: door|null, speed }
    this._down = null;
    this._mouse = null;
    this._cursor = '';
    this._raycaster = new THREE.Raycaster();
    this._ndc = new THREE.Vector2();
    this._hit = { t: 0, kind: '', door: null, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0 };
    this._head = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._origin = new THREE.Vector3();
    this._normal = new THREE.Vector3();
    this._clamped = { x: 0, z: 0 };
    this._snapArmed = true;
    this._recenter = 0; // frames until VR lines the headset up with the pose it entered at
    this._entry = { x: 0, z: 0, yaw: 0 };
    camera.position.set(0, EYE, 0);
    camera.rotation.order = 'YXZ';
    this._bindDom();
    this._setupXR();
  }

  /** Puts the viewer at (x, z) facing yaw. */
  setPose(x, z, yaw) {
    this.rig.position.set(x, 0, z);
    this.yaw = yaw;
    this.pitch = 0;
    this.auto = null;
    this._apply();
  }

  /** Walks to a point on the floor. */
  walkTo(x, z) {
    this._startWalk([[x, z]], null);
  }

  /** Walks up to a door and through it. */
  walkInto(door) {
    const hw = this.layout.halfWidth;
    const front = [door.side * (hw - 0.75), door.z];
    const through = [door.side * (hw + 0.4), door.z];
    const p = this.rig.position;
    const inFront = door.side * p.x > hw - 0.8 && Math.abs(p.z - door.z) < this.layout.hall.doorWidth / 2 - 0.2;
    this._startWalk(inFront ? [through] : [front, through], door);
  }

  _startWalk(points, face) {
    let length = 0, x = this.rig.position.x, z = this.rig.position.z;
    for (const [px, pz] of points) {
      length += Math.hypot(px - x, pz - z);
      x = px;
      z = pz;
    }
    // Long walks go faster, so none takes much more than a second and a half.
    this.auto = { points, i: 0, face, speed: clamp(length / 1.5, 2.2, 7) };
  }

  update(dt) {
    if (this.renderer.xr.isPresenting) {
      this._updateXR(dt);
      return;
    }
    if (this.auto) this._updateWalk(dt);
    else this._updateKeys(dt);
    this._apply();
    this._updateHover();
  }

  _apply() {
    this.rig.rotation.y = this.yaw;
    if (!this.renderer.xr.isPresenting) this.camera.rotation.set(this.pitch, 0, 0);
  }

  _move(x, z) {
    const c = clampToHall(this.layout, x, z, this._clamped);
    this.rig.position.x = c.x;
    this.rig.position.z = c.z;
    return c;
  }

  _updateKeys(dt) {
    const k = this.keys;
    if (!k.size) return;
    this.yaw += ((k.has('turnLeft') ? 1 : 0) - (k.has('turnRight') ? 1 : 0)) * TURN * dt;
    const f = (k.has('forward') ? 1 : 0) - (k.has('back') ? 1 : 0);
    const s = (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0);
    if (!f && !s) return;
    const step = ((k.has('run') ? RUN : WALK) * dt) / Math.hypot(f, s);
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    // Forward is (-sin, -cos); right is (cos, -sin).
    const p = this.rig.position;
    this._move(p.x + (-sin * f + cos * s) * step, p.z + (-cos * f - sin * s) * step);
  }

  _updateWalk(dt) {
    const a = this.auto;
    const p = this.rig.position;
    const [tx, tz] = a.points[a.i];
    const dx = tx - p.x, dz = tz - p.z;
    const dist = Math.hypot(dx, dz);
    const turn = 1 - Math.exp(-dt * 6);
    if (a.face) {
      // Turn to face the door on the way.
      this.yaw += wrapAngle(-a.face.side * Math.PI / 2 - this.yaw) * turn;
      this.pitch += (0 - this.pitch) * turn;
    }
    const step = a.speed * dt;
    if (dist <= step) {
      this._move(tx, tz);
      if (++a.i >= a.points.length) this.auto = null;
      return;
    }
    const px = p.x, pz = p.z;
    const c = this._move(px + (dx / dist) * step, pz + (dz / dist) * step);
    if (Math.hypot(c.x - px, c.z - pz) < step * 0.05) this.auto = null; // blocked by a wall
  }

  _pickScreen(clientX, clientY) {
    const r = this.dom.getBoundingClientRect();
    this._ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.camera.updateWorldMatrix(true, false);
    this._raycaster.setFromCamera(this._ndc, this.camera);
    const { origin: o, direction: d } = this._raycaster.ray;
    return castRay(this.layout, o.x, o.y, o.z, d.x, d.y, d.z, this._hit);
  }

  _updateHover() {
    let door = null;
    if (this._mouse && !this._down) {
      const hit = this._pickScreen(this._mouse.x, this._mouse.y);
      if (hit?.kind === 'door') door = hit.door;
    }
    this.hoverDoor = door;
    const cursor = door?.env ? 'pointer' : this._down?.moved ? 'grabbing' : '';
    if (cursor !== this._cursor) this.dom.style.cursor = this._cursor = cursor;
  }

  _tap(clientX, clientY) {
    const hit = this._pickScreen(clientX, clientY);
    if (!hit) return;
    if (hit.kind === 'door') this.onSelect(hit.door, 'screen');
    else if (hit.kind === 'floor') this.walkTo(hit.x, hit.z);
  }

  _bindDom() {
    const el = this.dom;
    el.addEventListener('pointerdown', (e) => {
      if (this._down || (e.pointerType === 'mouse' && e.button !== 0)) return;
      this._down = { id: e.pointerId, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, touch: e.pointerType !== 'mouse', moved: false };
      el.setPointerCapture?.(e.pointerId);
      this.onActivity();
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse') this._mouse = { x: e.clientX, y: e.clientY };
      const d = this._down;
      if (!d || d.id !== e.pointerId) return;
      const dx = e.clientX - d.lx, dy = e.clientY - d.ly;
      d.lx = e.clientX;
      d.ly = e.clientY;
      if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) > (d.touch ? 10 : 5)) d.moved = true;
      if (!d.moved) return;
      // The mouse turns the view the way it is dragged; a finger drags the scene (the opposite).
      const k = d.touch ? -LOOK * 1.15 : LOOK;
      this.yaw -= dx * k;
      this.pitch = clamp(this.pitch - dy * k, -PITCH, PITCH);
      this.auto = null;
    });
    const end = (e) => {
      const d = this._down;
      if (!d || d.id !== e.pointerId) return;
      this._down = null;
      if (e.type === 'pointerup' && !d.moved) this._tap(e.clientX, e.clientY);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse') this._mouse = null;
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = KEYS[e.code];
      if (!k) return;
      if (e.code.startsWith('Arrow')) e.preventDefault();
      this.keys.add(k);
      if (k !== 'run') this.auto = null;
      this.onActivity();
    });
    window.addEventListener('keyup', (e) => {
      const k = KEYS[e.code];
      if (k) this.keys.delete(k);
    });
    window.addEventListener('blur', () => this.keys.clear());
  }

  // ── VR ──────────────────────────────────────────────────────────────────────

  _setupXR() {
    const laserGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
    const laserMaterial = new THREE.LineBasicMaterial({ color: 0xfff0d6, transparent: true, opacity: 0.6 });
    const ringGeometry = new THREE.RingGeometry(0.022, 0.034, 28);
    this.hands = [];
    for (let i = 0; i < 2; i++) {
      const controller = this.renderer.xr.getController(i);
      const laser = new THREE.Line(laserGeometry, laserMaterial);
      laser.visible = false;
      controller.add(laser);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff0d6 }));
      controller.add(tip);
      const reticle = new THREE.Mesh(ringGeometry, new THREE.MeshBasicMaterial({ color: 0xfff0d6, transparent: true, opacity: 0.85, depthWrite: false }));
      reticle.visible = false;
      this.scene.add(reticle);
      const hand = { controller, laser, tip, reticle, source: null, hit: { ...this._hit }, last: null };
      controller.addEventListener('connected', (e) => {
        hand.source = e.data;
      });
      controller.addEventListener('disconnected', () => {
        hand.source = null;
        hand.last = null;
        laser.visible = reticle.visible = false;
      });
      controller.addEventListener('select', () => this._xrSelect(hand));
      this.rig.add(controller);
      this.hands.push(hand);
    }
    this.renderer.xr.addEventListener('sessionstart', () => {
      this._entry.x = this.rig.position.x;
      this._entry.z = this.rig.position.z;
      this._entry.yaw = this.yaw;
      this._recenter = 2;
      this.auto = null;
      this.keys.clear();
    });
    this.renderer.xr.addEventListener('sessionend', () => this._onSessionEnd());
  }

  _headYaw() {
    this.camera.getWorldDirection(this._dir);
    return Math.atan2(-this._dir.x, -this._dir.z);
  }

  /** Turns the rig by angle about the head, so the viewer turns in place. */
  _turnAboutHead(angle) {
    this.camera.getWorldPosition(this._head);
    const p = this.rig.position;
    const ox = p.x - this._head.x, oz = p.z - this._head.z;
    const c = Math.cos(angle), s = Math.sin(angle);
    p.x = this._head.x + ox * c + oz * s;
    p.z = this._head.z - ox * s + oz * c;
    this.yaw += angle;
    this.rig.rotation.y = this.yaw;
  }

  /** Moves the rig so the head goes to (x, z), or as near as the hall allows. */
  _moveHead(x, z) {
    this.camera.getWorldPosition(this._head);
    const c = clampToHall(this.layout, x, z, this._clamped);
    this.rig.position.x += c.x - this._head.x;
    this.rig.position.z += c.z - this._head.z;
  }

  _updateXR(dt) {
    // A moment after entering, line the headset up with where the viewer stood and looked.
    if (this._recenter > 0 && --this._recenter === 0) {
      this._turnAboutHead(wrapAngle(this._entry.yaw - this._headYaw()));
      this.rig.updateMatrixWorld();
      this._moveHead(this._entry.x, this._entry.z);
    }
    const session = this.renderer.xr.getSession();
    const sources = session ? session.inputSources : [];
    for (let i = 0; i < sources.length; i++) {
      const src = sources[i];
      const pad = src.gamepad;
      if (!pad || pad.axes.length < 2) continue;
      const ax = pad.axes.length >= 4 ? pad.axes[2] : pad.axes[0];
      const ay = pad.axes.length >= 4 ? pad.axes[3] : pad.axes[1];
      if (src.handedness === 'right') {
        if (this._snapArmed && Math.abs(ax) > 0.6) {
          this._turnAboutHead(-Math.sign(ax) * SNAP);
          this._snapArmed = false;
        } else if (Math.abs(ax) < 0.3) this._snapArmed = true;
      } else if (Math.hypot(ax, ay) > 0.15) {
        this.camera.getWorldDirection(this._dir);
        let fx = this._dir.x, fz = this._dir.z;
        const fl = Math.hypot(fx, fz) || 1;
        fx /= fl;
        fz /= fl;
        // Right of forward (fx, fz) is (-fz, fx).
        const step = XR_WALK * dt;
        this.camera.getWorldPosition(this._head);
        this._moveHead(this._head.x + (-fz * ax - fx * ay) * step, this._head.z + (fx * ax - fz * ay) * step);
      }
    }
    this.rig.updateMatrixWorld();
    let hover = null;
    for (const h of this.hands) {
      const mode = h.source?.targetRayMode;
      if (mode !== 'tracked-pointer') {
        h.laser.visible = h.reticle.visible = false;
        h.last = null;
        continue;
      }
      const m = h.controller.matrixWorld;
      this._origin.setFromMatrixPosition(m);
      this._dir.set(0, 0, -1).transformDirection(m);
      const o = this._origin, d = this._dir;
      const hit = castRay(this.layout, o.x, o.y, o.z, d.x, d.y, d.z, h.hit);
      h.last = hit;
      h.laser.visible = true;
      h.laser.scale.z = hit ? hit.t : 4;
      if (!hit || hit.kind === 'ceiling') {
        h.reticle.visible = false;
        continue;
      }
      const open = hit.kind === 'door' && hit.door.env;
      if (open) hover = hit.door;
      this._normal.set(hit.nx, hit.ny, hit.nz);
      h.reticle.position.set(hit.x + hit.nx * 0.01, hit.y + hit.ny * 0.01, hit.z + hit.nz * 0.01);
      h.reticle.quaternion.setFromUnitVectors(Z_AXIS, this._normal);
      h.reticle.scale.setScalar(open ? 1.8 : 1);
      h.reticle.material.color.setHex(open ? 0xe8c47c : hit.kind === 'floor' ? 0xfff0d6 : 0x9a8f80);
      h.reticle.visible = true;
    }
    this.hoverDoor = hover;
  }

  _xrSelect(hand) {
    const hit = hand.last;
    if (!hit) return;
    this.onActivity();
    if (hit.kind === 'door') this.onSelect(hit.door, 'xr');
    else if (hit.kind === 'floor') this._moveHead(hit.x, hit.z);
  }

  _onSessionEnd() {
    // Carry on from where the headset was, facing the way it faced.
    this.camera.getWorldPosition(this._head);
    const yaw = this._headYaw();
    const c = clampToHall(this.layout, this._head.x, this._head.z, this._clamped);
    this.camera.position.set(0, EYE, 0);
    this.camera.quaternion.identity();
    for (const h of this.hands) {
      h.laser.visible = h.reticle.visible = false;
      h.last = null;
    }
    this.hoverDoor = null;
    this.setPose(c.x, c.z, yaw);
  }
}

const Z_AXIS = new THREE.Vector3(0, 0, 1);
