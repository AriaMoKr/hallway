// The hallway's own part of the Android TV app's page: joining a shared session by its room, typed
// with the remote (the Join form under Settings, overlay.js), since a TV can't open an invite link.
// The rest of TV mode (tvMode, the Remote and its card, keyOf, window.hallwayTV) is common's tv.js,
// which every site behind the doors uses (README, "The TV app"). Pure, tested in Node.
import { isRoom } from 'layersharedsession/room.js';

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
