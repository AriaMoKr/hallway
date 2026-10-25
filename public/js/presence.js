// Who is in the shared session (together.js), in words: where a visitor is, how the session is
// doing, what the toasts say, and the others for the overlay and the control panel. Pure, for the
// tests.
import { HALLWAY_ID } from 'common/door.js';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const inPlace = (page, envs) => {
  const where = placeName(page, envs);
  return where === 'elsewhere' ? where : `in ${where}`;
};

/**
 * Where a visitor on `page` is: 'here' in the hallway, an environment's title (other sites take
 * their environments.js id as their page), anything else 'elsewhere' (the layer's test page uses
 * page-a and page-b).
 */
export function placeName(page, envs) {
  if (page === HALLWAY_ID) return 'here';
  const env = page ? envs.find((e) => e.id === page) : null;
  return env ? env.title : 'elsewhere';
}

/** Who else is in the session, in a few words. */
export function companyText(here, away) {
  if (!here && !away) return 'Nobody else yet';
  const parts = [];
  if (here) parts.push(`${here} here`);
  if (away) parts.push(`${away} elsewhere`);
  return parts.join(' · ');
}

/**
 * How the session is doing, in a few words, for the panel and the overlay.
 * @param {object} o
 * @param {boolean} [o.online]  navigator.onLine
 * @param {boolean} o.loaded  the session module has loaded and the room is joined
 * @param {number} o.relays  the Nostr relays open
 * @param {boolean} o.slow  still no relay about 10 s after joining
 * @param {number} [o.here]  others in the hallway, [o.away] elsewhere in the session (their hello has come)
 * @param {number} [o.connecting]  others connected whose hello hasn't come yet
 * @param {number} [o.failed]  handshakes with others that failed (a network that needs a TURN relay)
 */
export function statusText({ online = true, loaded, relays, slow, here = 0, away = 0, connecting = 0, failed = 0 }) {
  if (!online) return 'Offline';
  if (here || away) return companyText(here, away);
  if (connecting) return `Connecting to ${plural(connecting, 'visitor')}…`;
  if (!loaded || !relays) return slow ? "Can't reach the relays" : 'Connecting…';
  if (failed) return `Couldn't connect to ${plural(failed, 'visitor')}`;
  return 'Waiting for others';
}

/**
 * A notice from the session (layersharedsession's together.js) as its toast: a visitor said hello
 * (`join`), came into the hallway from another page (`arrive`), left (`leave`) or waved (`wave`).
 * @param {{ kind: string, peer: { name?: string|null, page?: string|null } }} notice
 * @param {Array<{id: string, title: string}>} envs
 */
export function noticeText({ kind, peer }, envs) {
  const name = peer.name || 'Someone';
  const here = !peer.page || peer.page === HALLWAY_ID;
  if (kind === 'join') return peer.page === HALLWAY_ID ? `${name} is here` : `${name} is in the session, ${inPlace(peer.page, envs)}`;
  if (kind === 'arrive') return `${name} came into the hallway`;
  if (kind === 'leave') return `${name} left the session`;
  if (kind === 'wave') return here ? `${name} waved` : `${name} waved, ${inPlace(peer.page, envs)}`;
  return '';
}

/**
 * The others whose hello has come (the session's peers), for the overlay: { peerId, name, color,
 * where, rtt }, those here first, then by name.
 * @param {Array<{peerId: string, name: string, color: string, page: string, rtt: number|null}>} peers
 * @param {Array<{id: string, title: string}>} envs
 */
export function peopleList(peers, envs) {
  return peers
    .map((p) => ({ peerId: p.peerId, name: p.name, color: p.color, where: placeName(p.page, envs), rtt: p.rtt }))
    .sort((a, b) => (b.where === 'here') - (a.where === 'here') || a.name.localeCompare(b.name));
}

/**
 * The others, for the control panel, as one string so it can tell when nothing it shows has
 * changed: a line per person, "name\twhere", at most `max` of them, then "+N more". Names have no
 * tabs or line breaks (the layer's cleanName collapses whitespace).
 * @param {Array<{name: string, where: string}>} people
 */
export function peopleText(people, max = 4) {
  const lines = people.slice(0, max).map((p) => `${p.name}\t${p.where}`);
  if (people.length > max) lines.push(`+${people.length - max} more`);
  return lines.join('\n');
}
