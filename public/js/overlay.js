// The page around the 3D view (not shown in a headset): the hallway's name and its doors as plain
// links (for keyboards, screen readers and browsers without WebGL), a hint on how to move, the
// Fullscreen and Enter VR buttons, Copy invite link while in a shared session, the dot a gamepad
// aims with, and short messages.

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
   */
  constructor(envs, { href = (env) => env.url, onLeave = () => {} } = {}) {
    this.root = document.getElementById('overlay');
    this.envs = envs;
    this.href = href;
    this.links = new Map();
    const list = el('ul', { class: 'doors', id: 'doors' });
    for (const env of envs) {
      const a = el('a', { href: href(env), style: `--door:${env.color}` }, el('span', { class: 'door-title' }, env.title), el('span', { class: 'door-sub' }, env.subtitle || ''));
      a.addEventListener('click', () => onLeave(env));
      this.links.set(env.id, a);
      list.append(el('li', {}, a));
    }
    this.toggle = el('button', { class: 'doors-toggle', type: 'button', 'aria-controls': 'doors' }, 'Doors');
    this.card = el('nav', { class: 'card', 'aria-label': 'Doors' }, el('header', {}, el('h1', { class: 'brand' }, 'Hallway'), this.toggle), list);
    this.toggle.addEventListener('click', () => this._collapse(!this.card.classList.contains('collapsed')));
    this._collapse(stored(COLLAPSED) === '1', false);
    this.hint = el('p', { class: 'hint' });
    this.fullscreen = el('button', { class: 'pill', type: 'button', hidden: '' }, 'Fullscreen');
    this.vr = el('button', { class: 'pill vr', type: 'button', hidden: '' }, 'Enter VR');
    this.invite = el('button', { class: 'pill invite', type: 'button', hidden: '' }, 'Copy invite link');
    this.invite.addEventListener('click', () => this._copyInvite());
    this._inviteLink = '';
    this.buttons = el('div', { class: 'buttons' }, this.invite, this.fullscreen, this.vr);
    this.dot = el('div', { class: 'aim', hidden: '', 'aria-hidden': 'true' });
    this.toasts = el('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
    this.root.append(this.card, this.hint, this.buttons, this.dot, this.toasts);
    this._hover = null;
  }

  _collapse(collapsed, save = true) {
    this.card.classList.toggle('collapsed', collapsed);
    this.toggle.setAttribute('aria-expanded', String(!collapsed));
    if (save) store(COLLAPSED, collapsed ? '1' : null);
  }

  /** @param {'mouse'|'touch'|'gamepad'} how */
  setHint(how) {
    this.hint.classList.remove('gone');
    this.hint.textContent = {
      touch: 'Drag to look · tap the floor to walk · tap a glowing door to go in',
      mouse: 'Drag to look around · WASD or arrows to walk · click a glowing door to go through',
      gamepad: 'Left stick walks · right stick looks · A goes through the door in the middle · View leaves fullscreen',
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

  /** The shared session's invite link (together.js), or '' when not in one: hides the button. */
  setInvite(link) {
    this._inviteLink = link;
    this.invite.hidden = !link;
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

  /** The dot in the middle of the view that a gamepad aims with. */
  setAim(on) {
    if (this.dot.hidden === !on) return;
    this.dot.hidden = !on;
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
