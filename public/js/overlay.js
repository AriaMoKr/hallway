// The page around the 3D view (not shown in a headset): the hallway's name and its doors as plain
// links (for keyboards, screen readers and browsers without WebGL), a hint on how to move, the
// Fullscreen and Enter VR buttons, while in a shared session its Together section (your name, how
// it's going, who else is in it) and the Wave and Copy invite link buttons, the dot a gamepad aims
// with, and short messages. Its Settings hold what the control panel on the wall offers in 3D (how
// to move and turn in VR, the accessibility settings: motion, the vignette, seated; Start / Leave
// shared session) as real controls, so a keyboard or a screen reader reaches them too. On a TV
// (tv.js) there is nothing to copy a link to: the invite link is shown to type on another device,
// and a room another device shows can be joined by its name. Names come from other visitors: they go in as text, never as HTML.
import { readable } from './color.js';

const COLLAPSED = 'hallway.doorsCollapsed';

function stored(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function store(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage blocked (a private window, a preview): it stays as it is for this visit.
  }
}

function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'style') e.style.cssText = v;
    else e.setAttribute(k, v);
  }
  for (const c of children) e.append(c);
  return e;
}

export class Overlay {
  /**
   * @param {Array} envs
   * @param {(env) => string} href the link a door opens (link.js)
   * @param {(env) => void} onLeave called when a door's link is followed
   * @param {boolean} tv the TV app's page (tv.js)
   */
  constructor(envs, { href = (env) => env.url, onLeave = () => {}, tv = false } = {}) {
    this.root = document.getElementById('overlay');
    this.tv = tv;
    this.envs = envs;
    this.href = href;
    this.links = new Map();
    const list = el('ul', { class: 'doors', id: 'doors' });
    for (const env of envs) {
      // The name in a tint of the door's glow that reads on the list (color.js); the edge in the glow itself.
      const a = el('a', { href: href(env), style: `--door:${env.color};--door-text:${readable(env.color)}` }, el('span', { class: 'door-title' }, env.title), el('span', { class: 'door-sub' }, env.subtitle || ''));
      a.addEventListener('click', () => onLeave(env));
      this.links.set(env.id, a);
      list.append(el('li', {}, a));
    }
    this.toggle = el('button', { class: 'doors-toggle', type: 'button', 'aria-controls': 'doors' }, 'Doors');
    this.card = el('nav', { class: 'card', 'aria-label': 'Doors' }, el('header', {}, el('h1', { class: 'brand' }, 'Hallway'), this.toggle), list);
    this.toggle.addEventListener('click', () => this._collapse(!this.card.classList.contains('collapsed')));
    this._collapse(stored(COLLAPSED) === '1', false);
    // The shared session: shown while in one, whether the doors list is folded or not.
    /** (name) when the visitor renames themself; returns the name kept. */
    this.onName = (name) => name;
    this.onWave = () => {};
    this.myDot = el('span', { class: 'dot', 'aria-hidden': 'true' });
    this.myName = el('input', { class: 'my-name', type: 'text', maxlength: '24', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Your name in the shared session' });
    this.myName.addEventListener('change', () => {
      this.myName.value = this.onName(this.myName.value);
    });
    this.myName.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.myName.blur();
    });
    this.status = el('span', { class: 'together-status' });
    this.people = el('ul', { class: 'people', 'aria-label': 'Others in the shared session' });
    // On a TV, the address others open to join (setInvite).
    this.inviteText = tv ? el('p', { class: 'together-note invite-text' }) : null;
    this.together = el('section', { class: 'together', hidden: '', 'aria-label': 'Shared session' },
      el('header', {}, el('h2', {}, 'Together'), this.status),
      el('label', { class: 'me' }, this.myDot, this.myName),
      this.people,
      this.inviteText ?? el('p', { class: 'together-note' }, 'Set your name here before entering VR: there is no typing in a headset.'));
    this.card.append(this.together);
    // The control panel's choices (main.js's controls.onPanel does the rest), in the same words.
    /** (key, value) when a movement choice is made: 'move' 'smooth' | 'teleport', 'turn' 'snap' | 'smooth'. */
    this.onNav = () => {};
    /** When Start / Leave shared session is pressed. */
    this.onSession = () => {};
    /** (change) when an accessibility setting changes: { motion }, { vignette } or { seated } (common/access.js). */
    this.onAccess = () => {};
    this.navInputs = {};
    const choice = (key, legend, options, onChoose = (value) => this.onNav(key, value)) => {
      const set = el('fieldset', { class: 'choice' }, el('legend', {}, legend));
      for (const [value, label] of options) {
        const input = el('input', { type: 'radio', name: `nav-${key}`, value });
        input.addEventListener('change', () => {
          if (input.checked) onChoose(value);
        });
        this.navInputs[`${key}:${value}`] = input;
        set.append(el('label', {}, input, label));
      }
      return set;
    };
    const check = (key, label) => {
      const input = el('input', { type: 'checkbox' });
      input.addEventListener('change', () => this.onAccess({ [key]: input.checked }));
      this.navInputs[key] = input;
      return el('label', { class: 'check' }, input, label);
    };
    this.session = el('button', { class: 'session', type: 'button' }, 'Start shared session');
    this.session.addEventListener('click', () => this.onSession());
    this.settings = el('details', { class: 'settings' },
      el('summary', {}, 'Settings'),
      choice('move', 'Move in VR', [['teleport', 'Teleport'], ['smooth', 'Smooth']]),
      choice('turn', 'Turn in VR', [['snap', 'Snap'], ['smooth', 'Smooth']]),
      choice('motion', 'Motion', [['system', 'As the system'], ['reduce', 'Less'], ['full', 'Full']], (motion) => this.onAccess({ motion })),
      check('vignette', 'Darken the edges when moving smoothly in VR'),
      check('seated', 'Seated: raise the view in VR'),
      this.session);
    this.card.append(this.settings);
    /** (text) when a room is given to join, on a TV: what was typed (main.js finds the room in it). */
    this.onJoin = () => {};
    if (tv) {
      this.joinRoom = el('input', { class: 'join-room', type: 'text', maxlength: '120', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', placeholder: 'k3vd-q8hn' });
      this.join = el('form', { class: 'join' }, el('label', {}, 'Or join one by its room', this.joinRoom), el('button', { type: 'submit' }, 'Join'));
      this.join.addEventListener('submit', (e) => {
        e.preventDefault();
        this.onJoin(this.joinRoom.value);
      });
      this.settings.append(this.join);
    }
    this.hint = el('p', { class: 'hint', id: 'hint' });
    this.fullscreen = el('button', { class: 'pill', type: 'button', hidden: '' }, 'Fullscreen');
    this.vr = el('button', { class: 'pill vr', type: 'button', hidden: '' }, 'Enter VR');
    this.invite = el('button', { class: 'pill invite', type: 'button', hidden: '' }, 'Copy invite link');
    this.invite.addEventListener('click', () => this._copyInvite());
    this._inviteLink = '';
    this.wave = el('button', { class: 'pill', type: 'button', hidden: '' }, 'Wave');
    this.wave.addEventListener('click', () => this.onWave());
    this.buttons = el('div', { class: 'buttons' }, this.wave, this.invite, this.fullscreen, this.vr);
    this.dot = el('div', { class: 'aim', hidden: '', 'aria-hidden': 'true' });
    this.toasts = el('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
    this.root.append(this.card, this.hint, this.buttons, this.dot, this.toasts);
    // The card stops above the buttons, which wrap to two rows on a phone in a shared session (style.css).
    new ResizeObserver(() => this.root.style.setProperty('--buttons', `${this.buttons.offsetHeight}px`)).observe(this.buttons);
    this._hover = null;
  }

  _collapse(collapsed, save = true) {
    this.card.classList.toggle('collapsed', collapsed);
    this.toggle.setAttribute('aria-expanded', String(!collapsed));
    if (save) store(COLLAPSED, collapsed ? '1' : null);
  }

  /** @param {'mouse'|'touch'|'gamepad'|'tv'|'tv-card'} how  tv: walking with a remote; tv-card: in the card */
  setHint(how) {
    this.hint.classList.remove('gone');
    this.hint.textContent = {
      touch: 'Drag to look · tap the floor to walk · tap a glowing door to go in',
      mouse: 'Drag to look around · WASD or arrows to walk · click a glowing door to go through',
      gamepad: 'Right stick to look · left stick to walk · A goes through a door',
      tv: 'Arrows: walk and turn · OK: the door in the middle · Menu or hold Back: doors and settings',
      'tv-card': 'Up, down: from control to control · left, right: a choice · OK: choose · Back: walk again',
    }[how];
    clearTimeout(this._hintTimer);
    this._hintTimer = setTimeout(() => this.hideHint(), 12000);
  }

  hideHint() {
    this.hint.classList.add('gone');
  }

  showVR(onClick) {
    this.vr.hidden = false;
    this.vr.addEventListener('click', onClick);
  }

  /**
   * What the control panel shows, for the Settings: { move, turn, motion, vignette, seated, room }
   * (vignette and seated true or false; room null when not in a session).
   */
  setPanel({ move, turn, motion, vignette, seated, room }) {
    for (const [id, input] of Object.entries(this.navInputs)) {
      const checked = id === 'vignette' ? vignette : id === 'seated' ? seated : id === `move:${move}` || id === `turn:${turn}` || id === `motion:${motion}`;
      if (input.checked !== checked) input.checked = checked;
    }
    const label = room ? 'Leave shared session' : 'Start shared session';
    if (this.session.textContent !== label) this.session.textContent = label;
    if (this.join && this.join.hidden !== !!room) this.join.hidden = !!room;
  }

  /** The shared session's invite link (together.js), or '' when not in one: hides the button. On a TV, the link to type elsewhere. */
  setInvite(link) {
    this._inviteLink = link;
    if (this.inviteText) {
      if (link) this.inviteText.replaceChildren('To join from a phone or a computer, open ', el('span', { class: 'invite-link' }, link.replace(/^https?:\/\//, '')));
      return;
    }
    this.invite.hidden = !link;
  }

  /**
   * The shared session's section, and the Wave button: hidden when not in one.
   * @param {{ active: boolean, self?: {name, color}, status?: string, people?: Array<{name, color, where, rtt}> }} t
   */
  setTogether({ active, self, status = '', people = [] }) {
    this.together.hidden = !active;
    this.wave.hidden = !active;
    if (!active) return;
    this.myDot.style.background = self.color;
    if (document.activeElement !== this.myName) this.myName.value = self.name;
    this.status.textContent = status;
    this.people.replaceChildren(...people.map((p) => {
      const dot = el('span', { class: 'dot', 'aria-hidden': 'true' });
      dot.style.background = p.color;
      const rtt = el('span', { class: 'rtt' }, p.rtt == null ? '…' : `${Math.round(p.rtt)} ms`);
      return el('li', {}, dot, el('span', { class: 'who' }, p.name), el('span', { class: 'where' }, p.where), rtt);
    }));
  }

  async _copyInvite() {
    const link = this._inviteLink;
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      this.toast('Invite link copied: anyone who opens it joins you here');
    } catch {
      prompt('Copy this link to invite others:', link);
    }
  }

  /** Works out the doors' links again (they carry the shared session's room). */
  refreshLinks() {
    for (const env of this.envs) this.links.get(env.id)?.setAttribute('href', this.href(env));
  }

  showFullscreen(onClick) {
    this.fullscreen.hidden = false;
    this.fullscreen.addEventListener('click', onClick);
  }

  setFullscreen(on) {
    this.fullscreen.textContent = on ? '✕ Exit fullscreen' : 'Fullscreen';
    this.fullscreen.classList.toggle('on', on);
  }

  /** The dot in the middle of the view that a gamepad aims with; larger and filled on something A would use. */
  setAim(on, hover = false) {
    if (this.dot.hidden !== !on) this.dot.hidden = !on;
    if (this.dot.classList.contains('hover') !== hover) this.dot.classList.toggle('hover', hover);
  }

  /** Marks the door pointed at in 3D in the list too. */
  setHover(env) {
    if (env === this._hover) return;
    if (this._hover) this.links.get(this._hover.id)?.classList.remove('hover');
    this._hover = env;
    if (env) this.links.get(env.id)?.classList.add('hover');
  }

  toast(text, seconds = 3.5) {
    const t = el('div', { class: 'toast' }, text);
    this.toasts.append(t);
    setTimeout(() => t.remove(), seconds * 1000);
  }

  /** No 3D view: the links are the hallway. */
  noWebGL(message) {
    this._collapse(false, false);
    this.toggle.hidden = true;
    this.card.classList.add('alone');
    this.card.append(el('p', { class: 'no-webgl' }, message));
    this.hint.remove();
  }
}
