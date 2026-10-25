// Which door, if any, the viewer has just come back out of, so the page starts them in front of
// it. Pure, for the tests.

/**
 * @param {object} o
 * @param {string} o.search    location.search
 * @param {string} o.referrer  document.referrer
 * @param {string} [o.navType] the navigation's type ('navigate', 'reload', 'back_forward', …)
 * @param {string} [o.entryDoorId] the door this history entry was left by (history.state)
 * @param {string} [o.lastDoorId] the door last gone through in this tab (sessionStorage)
 * @param {Array<{id: string, url: string}>} o.envs
 * @returns {string|null} the environment's id
 */
export function arrivalDoorId({ search, referrer, navType, entryDoorId, lastDoorId, envs }) {
  const known = (id) => id && envs.some((e) => e.id === id);
  const back = navType === 'back_forward';
  // Back (or Forward) to the hallway: the door this entry was left by, though its ?from= says
  // which one the visitor first came out of.
  if (back && known(entryDoorId)) return entryDoorId;
  const from = new URLSearchParams(search).get('from');
  if (known(from)) return from;
  // Back to an entry left some other way: the referrer is the one this page first had, not the
  // environment just left, but the tab remembers the last door gone through.
  if (back && known(lastDoorId)) return lastDoorId;
  return matchReferrer(referrer, envs)?.id ?? null;
}

/** The environment a referrer URL belongs to: the longest URL it starts with, on the same origin. */
export function matchReferrer(referrer, envs) {
  if (!referrer) return null;
  let ref;
  try {
    ref = new URL(referrer);
  } catch {
    return null;
  }
  let best = null;
  let bestLength = -1;
  const sameOrigin = [];
  for (const e of envs) {
    let u;
    try {
      u = new URL(e.url);
    } catch {
      continue;
    }
    if (u.origin !== ref.origin) continue;
    sameOrigin.push(e);
    if (ref.pathname.startsWith(u.pathname) && u.pathname.length > bestLength) {
      best = e;
      bestLength = u.pathname.length;
    }
  }
  if (best) return best;
  // Browsers send other sites only their origin (strict-origin-when-cross-origin): enough when one
  // environment lives there.
  if (ref.pathname === '/' && !ref.search && sameOrigin.length === 1) return sameOrigin[0];
  return null;
}
