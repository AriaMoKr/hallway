// The hallway in the Android TV app (AriaMoKr/HallwayApp), whose WebView ends its user agent with
// " HallwayTV/<version>": the 10-foot view (style.css's html.tv) and the remote. Walking, the arrows
// walk and turn, and OK goes through the door in the middle of the view, where a dot shows what it is
// on (as a gamepad's A does). Menu, or a long press of Back, moves the focus into the card, where up
// and down go from control to control, left and right through a choice's options, and OK chooses;
// Escape or Back walk again. The 3D view holds the focus while walking (TalkBack reads its name; with
// TalkBack on, the arrows are TalkBack's and never reach the page, but OK on the view does).
// The app asks the page what Back and Menu do (window.hallwayTV, README "The TV app"): true when the
// page used the key, else the app goes back a page, or leaves. The pure parts are tested in Node.
import { isRoom } from 'layersharedsession/room.js';

/** Whether this is the TV app's WebView. */
export const isTV = (userAgent) => /\bHallwayTV\/\d/.test(userAgent ?? '');

/** The room in what was typed to join a shared session: a room's name, or a link to one (?room=); else null. */
export function roomFromInput(text) {
  const s = String(text ?? '').trim();
  const m = s.match(/[?&]room=([^&#\s]*)/i);
  let room = m ? m[1] : s;
  try {
    room = decodeURIComponent(room);
  } catch {
    return null;
  }
  room = room.trim().toLowerCase();
  return isRoom(room) ? room : null;
}

/**
 * The card's stops among its controls, in order ([{ radio }]: a radio's group name, else ''): their
 * indices, a choice (a radio group) one stop, its checked option standing for it (else its first).
 * @param {Array<{radio: string, checked?: boolean}>} items
 * @returns {number[]}
 */
export function focusStops(items) {
  const stops = [];
  const groups = new Map();
  items.forEach((item, i) => {
    if (!item.radio) {
      stops.push(i);
      return;
    }
    const at = groups.get(item.radio);
    if (at === undefined) {
      groups.set(item.radio, stops.length);
      stops.push(i);
    } else if (item.checked && !items[stops[at]].checked) {
      stops[at] = i;
    }
  });
  return stops;
}

/** The stop `dir` (−1, +1) on from `at` (−1: none yet) among `n`, staying at the ends; −1 when there are none. */
export function nextStop(n, at, dir) {
  if (n <= 0) return -1;
  if (at < 0) return dir < 0 ? n - 1 : 0;
  return Math.min(n - 1, Math.max(0, at + dir));
}

const FOCUSABLE = 'a[href], button, input, summary, [tabindex]:not([tabindex="-1"])';
const TYPED = new Set(['text', 'search', 'url', 'email', 'number', 'password', 'tel']);

/** The remote's keys, and the card's focus. */
export class Remote {
  /**
   * @param {object} o
   * @param {HTMLElement} o.root  the page around the view (overlay.js's root)
   * @param {HTMLElement} o.view  the 3D view's canvas
   * @param {() => void} o.use  OK while walking: the middle of the view (controls.useMiddle)
   */
  constructor({ root, view, use }) {
    this.root = root;
    this.view = view;
    this.use = use;
    /** (inCard) when the focus goes into the card or back to walking. */
    this.onMode = () => {};
    this._last = null; // the control last left in the card, to come back to
    view.tabIndex = 0;
    // Before the controls' own listener, which walks with the arrows: in the card they move the focus.
    addEventListener('keydown', (e) => this._key(e), true);
    view.focus({ preventScroll: true });
  }

  /** Whether the focus is in the card (or on its buttons), not on the view or nowhere. */
  get inCard() {
    const a = document.activeElement;
    return !!a && a !== this.view && a !== document.body && this.root.contains(a);
  }

  /** Menu: into the card, or out of it. */
  menu() {
    if (this.inCard) this.walk();
    else this.toCard();
    return true;
  }

  /** Back: out of the card; walking, it is the app's (false: back a page, or out of the app). */
  back() {
    if (!this.inCard) return false;
    this.walk();
    return true;
  }

  /** A gamepad's B or Back: out of the card, else back a page if there is one (the page can't leave the app). */
  padBack() {
    if (this.back()) return;
    if (window.navigation?.canGoBack) history.back();
  }

  walk() {
    if (this.inCard) this._last = document.activeElement;
    this.view.focus({ preventScroll: true });
    this.onMode(false);
  }

  toCard() {
    const stops = this._stops();
    const to = stops.includes(this._last) ? this._last : stops[0];
    to?.focus();
    this.onMode(true);
  }

  /** The controls the focus stops at, as shown: one per choice. */
  _stops() {
    const els = [...this.root.querySelectorAll(FOCUSABLE)].filter((e) => !e.disabled && e.checkVisibility({ visibilityProperty: true }));
    return focusStops(els.map((e) => ({ radio: e.type === 'radio' ? e.name : '', checked: e.checked }))).map((i) => els[i]);
  }

  _key(e) {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (!this.inCard) {
      // Walking: the arrows are the controls' (which keep them from the WebView's spatial navigation).
      if (e.key === 'Enter') {
        e.preventDefault();
        if (!e.repeat) this.use();
      }
      return;
    }
    const a = document.activeElement;
    const done = () => {
      e.preventDefault();
      e.stopPropagation();
    };
    switch (e.key) {
      case 'Escape':
        done();
        this.walk();
        return;
      case 'ArrowUp':
      case 'ArrowDown': {
        done();
        const stops = this._stops();
        const at = stops.findIndex((s) => s === a || (a.type === 'radio' && s.type === 'radio' && s.name === a.name));
        stops[nextStop(stops.length, at, e.key === 'ArrowUp' ? -1 : 1)]?.focus();
        return;
      }
      case 'ArrowLeft':
      case 'ArrowRight': {
        const dir = e.key === 'ArrowLeft' ? -1 : 1;
        if (a.type === 'radio') {
          // Through the choice's options: each chosen as it is reached, as arrows do in a radio group.
          done();
          const group = [...this.root.querySelectorAll(`input[type=radio][name="${a.name}"]`)];
          const to = group[nextStop(group.length, group.indexOf(a), dir)];
          if (to !== a) {
            to.focus();
            to.click();
          }
          return;
        }
        // In a text box the caret moves; at its ends, and anywhere else, the focus stays in the card.
        const caret = TYPED.has(a.type) && a.selectionStart === a.selectionEnd ? a.selectionStart : null;
        if (caret === null || (dir < 0 ? caret === 0 : caret === a.value.length)) done();
        return;
      }
      case 'Enter':
        if (a.type === 'checkbox' || a.type === 'radio') {
          done();
          a.click();
        }
        return;
    }
  }
}
