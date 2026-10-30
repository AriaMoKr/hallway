// The control panel on the wall (layout.js PANEL): Enter / Exit VR, how to move and turn in VR, the
// accessibility settings every site shares (common/access.js: motion, the comfort vignette, seated),
// and the shared session (together.js): Start / Leave, how it's going, its invite link to read out, and
// who else is in it and where (up to four, then "+N more"). Its canvas is redrawn only when what it
// shows changes (a setting, a session, the button pointed at, someone coming, going or renaming),
// never per frame: the people come as a string (presence.js), and round trips stay off it. Large (a
// TV's, tv.js) its text is a fifth larger, every line fitted to where it goes.
import * as THREE from 'three';
import { PANEL, PANEL_PX, PANEL_BUTTONS } from './layout.js';
import { GOLD, SANS, SERIF, enamel } from './textures.js';

const LABELS = {
  'move:teleport': 'Teleport', 'move:smooth': 'Smooth', 'turn:snap': 'Snap', 'turn:smooth': 'Smooth',
  'motion:system': 'System', 'motion:reduce': 'Less', 'motion:full': 'Full',
  'vignette:on': 'On', 'vignette:off': 'Off', 'seated:on': 'On', 'seated:off': 'Off',
};
/** The rows' names, at their middles on the canvas. @type {[string, number][]} */
const ROWS = [['Move', 157], ['Turn', 219], ['Motion', 315], ['Vignette', 377], ['Seated', 439]];
const VR_LABELS = { exit: 'Exit VR', enter: 'Enter VR', none: 'No VR in this browser' };
const HINTS = {
  teleport: 'Left stick forward, aim, let go: teleport',
  smooth: 'Left stick: walk · trigger at the floor: teleport',
};
const SESSION_LABELS = { on: 'Leave shared session', off: 'Start shared session' };
const KEYS = ['vr', 'move', 'turn', 'motion', 'vignette', 'seated', 'room', 'link', 'status', 'people'];
const LARGE = 1.2;

export class ControlPanel {
  /** @param {{ halfWidth: number, color: THREE.Color, anisotropy?: number, large?: boolean }} o */
  constructor({ halfWidth, color, anisotropy = 1, large = false }) {
    this.scale = large ? LARGE : 1;
    this.canvas = document.createElement('canvas');
    this.canvas.width = PANEL_PX.width;
    this.canvas.height = PANEL_PX.height;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = anisotropy;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(PANEL.width, PANEL.height), new THREE.MeshBasicMaterial({ map: this.texture, color }));
    this.mesh.name = 'control panel';
    this.mesh.position.set(PANEL.side * (halfWidth - PANEL.depth), PANEL.y, PANEL.z);
    this.mesh.rotation.y = -PANEL.side * Math.PI / 2;
    this.state = { vr: 'none', move: 'smooth', turn: 'snap', motion: 'system', vignette: 'on', seated: 'off', room: null, link: '', status: '', people: '' };
    this.hover = null;
    this._draw();
  }

  /**
   * What it shows, all or part of it: vr is 'exit' (in VR), 'enter' (VR available) or 'none'; move
   * and turn as in common/nav.js; motion as in common/access.js, vignette and seated 'on' or 'off';
   * room is the shared session's (null when not in one), link its
   * invite link, status how it's going, people who else is in it (presence.js peopleText).
   */
  set(state) {
    const next = { ...this.state, ...state };
    if (KEYS.every((k) => next[k] === this.state[k])) return;
    this.state = next;
    this._draw();
  }

  /** The button pointed at, or null. */
  setHover(id) {
    if (id === this.hover) return;
    this.hover = id;
    this._draw();
  }

  _draw() {
    const g = this.ctx, W = PANEL_PX.width, H = PANEL_PX.height;
    const px = (size) => Math.round(size * this.scale);
    enamel(g, W, H, 10);
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.fillStyle = GOLD;
    g.font = `600 ${px(30)}px ${SERIF}`;
    g.fillText('Controls', 32, 50);
    g.fillStyle = '#b9a98d';
    g.textBaseline = 'middle';
    for (const [name, y] of ROWS) {
      fitText(g, name, 120, px(24)); // clear of the buttons at 160
      g.fillText(name, 34, y);
    }
    for (const [id, x0, y0, x1, y1] of PANEL_BUTTONS) {
      let label, selected = false, disabled = false;
      if (id === 'vr') {
        label = VR_LABELS[this.state.vr];
        disabled = this.state.vr === 'none';
      } else if (id === 'session') {
        label = SESSION_LABELS[this.state.room ? 'on' : 'off'];
      } else {
        const [group, value] = id.split(':');
        label = LABELS[id];
        selected = this.state[group] === value;
      }
      const hover = this.hover === id && !disabled;
      g.beginPath();
      g.roundRect(x0, y0, x1 - x0, y1 - y0, 12);
      g.fillStyle = selected ? (hover ? '#f0cf8a' : GOLD) : hover ? 'rgba(224,187,114,0.32)' : 'rgba(255,255,255,0.06)';
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = disabled ? 'rgba(224,187,114,0.3)' : GOLD;
      g.stroke();
      g.fillStyle = selected ? '#1a1208' : disabled ? 'rgba(239,229,207,0.45)' : '#efe5cf';
      fitText(g, label, x1 - x0 - 16, px((id === 'vr' && disabled) || id.startsWith('motion:') ? 22 : 26), '600 ');
      g.textAlign = 'center';
      g.fillText(label, (x0 + x1) / 2, (y0 + y1) / 2 + 1);
    }
    g.fillStyle = '#b9a98d';
    fitText(g, HINTS[this.state.move], W - 64, px(18));
    g.textAlign = 'center';
    g.fillText(HINTS[this.state.move], W / 2, 268);

    // The shared session.
    g.fillStyle = 'rgba(224,187,114,0.35)';
    g.fillRect(32, 486, W - 64, 2);
    g.textAlign = 'left';
    g.fillStyle = GOLD;
    g.font = `600 ${px(26)}px ${SERIF}`;
    g.fillText('Together', 32, 514);
    if (this.state.room) {
      g.textAlign = 'right';
      g.fillStyle = '#efe5cf';
      fitText(g, this.state.status, W - 210, px(20));
      g.fillText(this.state.status, W - 32, 515);
    }
    g.textAlign = 'center';
    g.fillStyle = '#b9a98d';
    const note = this.state.room ? this.state.link : 'Start one, share its link, and see each other here';
    fitText(g, note, W - 64, px(18));
    g.fillText(note, W / 2, 612);

    // Who else is in it, and where.
    const rows = this.state.room && this.state.people ? this.state.people.split('\n') : [];
    rows.forEach((row, i) => {
      const y = 642 + i * 25;
      const [name, place] = row.split('\t');
      if (place === undefined) {
        g.textAlign = 'left';
        g.fillStyle = '#b9a98d';
        g.font = `${px(18)}px ${SANS}`;
        g.fillText(name, 44, y);
        return;
      }
      g.textAlign = 'right';
      g.fillStyle = '#b9a98d';
      fitText(g, place, 150, px(18));
      g.fillText(place, W - 44, y);
      g.textAlign = 'left';
      g.fillStyle = '#efe5cf';
      fitText(g, name, W - 88 - 170, px(19), '600 ');
      g.fillText(name, 44, y);
    });
    this.texture.needsUpdate = true;
  }
}

/** Sets the largest font, from `size` px down, at which `text` fits `width`. */
function fitText(g, text, width, size, weight = '') {
  for (let s = size; s >= 12; s--) {
    g.font = `${weight}${s}px ${SANS}`;
    if (g.measureText(text).width <= width) return;
  }
}
