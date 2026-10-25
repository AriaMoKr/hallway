import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTogether } from 'layersharedsession/together.js';
import { HALLWAY_ID } from 'common/door.js';
import { ENVIRONMENTS } from '../public/js/environments.js';
import { companyText, noticeText, peopleList, peopleText, placeName, statusText } from '../public/js/presence.js';
import { APP_ID, noticeToast, panelPeople, sessionPeople, sessionStatus } from '../public/js/together.js';

test("a visitor's page in words: here, an environment's title, or elsewhere", () => {
  assert.equal(placeName('hallway', ENVIRONMENTS), 'here');
  for (const e of ENVIRONMENTS) assert.equal(placeName(e.id, ENVIRONMENTS), e.title, e.id);
  assert.equal(placeName('garden', [{ id: 'garden', title: 'The Garden' }]), 'The Garden');
  for (const page of ['page-a', 'page-b', '', null, undefined]) assert.equal(placeName(page, ENVIRONMENTS), 'elsewhere', String(page));
});

test("the session's status: connecting, the relays, offline, waiting, or who is in it", () => {
  const up = { loaded: true, relays: 3, slow: false };
  assert.equal(statusText({ loaded: false, relays: 0, slow: false }), 'Connecting…');
  assert.equal(statusText({ loaded: true, relays: 0, slow: false }), 'Connecting…');
  assert.equal(statusText({ loaded: true, relays: 0, slow: true }), "Can't reach the relays");
  assert.equal(statusText({ ...up, online: false }), 'Offline');
  assert.equal(statusText({ ...up, online: false, here: 2 }), 'Offline');
  assert.equal(statusText(up), 'Waiting for others');
  assert.equal(statusText({ ...up, failed: 1 }), "Couldn't connect to 1 visitor");
  assert.equal(statusText({ ...up, failed: 3 }), "Couldn't connect to 3 visitors");
  assert.equal(statusText({ ...up, connecting: 2 }), 'Connecting to 2 visitors…');
  assert.equal(statusText({ ...up, here: 2, away: 1 }), '2 here · 1 elsewhere');
  // Once others are connected, the relays don't matter (WebRTC is up).
  assert.equal(statusText({ loaded: true, relays: 0, slow: true, away: 1 }), '1 elsewhere');
  assert.equal(companyText(0, 0), 'Nobody else yet');
});

test('the others for the panel: at most four lines, then "+N more"; the same people, the same string', () => {
  const people = ['Ada', 'Ben', 'Cy', 'Di', 'Ed', 'Flo'].map((name, i) => ({ name, where: i % 2 ? 'here' : 'Outside' }));
  assert.equal(peopleText([]), '');
  assert.equal(peopleText(people.slice(0, 2)), 'Ada\tOutside\nBen\there');
  const all = peopleText(people);
  assert.deepEqual(all.split('\n'), ['Ada\tOutside', 'Ben\there', 'Cy\tOutside', 'Di\there', '+2 more']);
  assert.equal(peopleText(people.map((p) => ({ ...p }))), all);
});

test('the toasts: who said hello and where, who came in, left or waved', () => {
  const ada = { name: 'Ada', page: 'hallway' };
  assert.equal(noticeText({ kind: 'join', peer: ada }, ENVIRONMENTS), 'Ada is here');
  assert.equal(noticeText({ kind: 'join', peer: { name: 'Ben', page: 'outside' } }, ENVIRONMENTS), 'Ben is in the session, in outside');
  assert.equal(noticeText({ kind: 'join', peer: { name: 'Cy', page: 'page-a' } }, ENVIRONMENTS), 'Cy is in the session, elsewhere');
  assert.equal(noticeText({ kind: 'arrive', peer: ada, from: 'music' }, ENVIRONMENTS), 'Ada came into the hallway');
  assert.equal(noticeText({ kind: 'leave', peer: { name: null, page: null } }, ENVIRONMENTS), 'Someone left the session');
  assert.equal(noticeText({ kind: 'wave', peer: ada }, ENVIRONMENTS), 'Ada waved');
  assert.equal(noticeText({ kind: 'wave', peer: { name: 'Di', page: 'music' } }, ENVIRONMENTS), 'Di waved, in music');
});

test('the others for the overlay: where each is, those here first, then by name', () => {
  const peers = [
    { peerId: 'a', name: 'Zed', color: '#111', page: 'hallway', rtt: 30 },
    { peerId: 'b', name: 'Ada', color: '#222', page: 'outside', rtt: null },
    { peerId: 'c', name: 'Bo', color: '#333', page: 'hallway', rtt: 55 },
  ];
  assert.deepEqual(peopleList(peers, ENVIRONMENTS), [
    { peerId: 'c', name: 'Bo', color: '#333', where: 'here', rtt: 55 },
    { peerId: 'a', name: 'Zed', color: '#111', where: 'here', rtt: 30 },
    { peerId: 'b', name: 'Ada', color: '#222', where: 'outside', rtt: null },
  ]);
});

/** A stand-in for the layer's session.js: its peers, its events and its wave channel. */
function standInSession() {
  const listeners = new Map();
  const waves = [];
  return {
    self: { memberId: 'me', name: 'Me', color: '#fff', page: HALLWAY_ID },
    peers: new Map(),
    relays: { open: 2, total: 3 },
    on(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
      return () => {};
    },
    emit(type, peer) {
      for (const fn of listeners.get(type) ?? []) fn(peer);
    },
    channel: () => ({ on: (fn) => waves.push(fn), send() {} }),
    waved(peer) {
      for (const fn of waves) fn(1, peer);
    },
    setPose() {},
    tick() {},
    setName() {},
    leave() {},
  };
}

test("the hallway's words over the layer's controller: the toasts, the status and the people", async () => {
  const s = standInSession();
  let now = 0;
  const together = createTogether({ appId: APP_ID, page: HALLWAY_ID, joinSession: () => s, now: () => now });
  const toasts = [];
  together.on('notice', (n) => toasts.push(noticeToast(n)));
  together.start('k3vd-q8hn');
  await new Promise((r) => setTimeout(r));
  assert.equal(together.session, s);
  assert.equal(sessionStatus(together), 'Waiting for others');
  const peer = (peerId, name, page) => {
    const p = { peerId, name, color: '#888', page, rtt: null };
    s.peers.set(peerId, p);
    s.emit('join', p);
    return p;
  };
  const ada = peer('a', 'Ada', HALLWAY_ID);
  const ben = peer('b', 'Ben', 'outside');
  peer('c', 'Cy', 'music');
  ben.page = HALLWAY_ID; // Ben comes back through outside's door
  s.emit('update', ben);
  ada.name = 'Ada L.'; // a rename is no arrival
  s.emit('update', ada);
  s.waved(ada);
  s.waved(ada); // again within a second: not counted
  now = 1500;
  s.waved(ada);
  s.waved(s.peers.get('c'));
  s.peers.delete('b');
  s.emit('leave', ben);
  assert.deepEqual(toasts, [
    'Ada is here',
    'Ben is in the session, in outside',
    'Cy is in the session, in music',
    'Ben came into the hallway',
    'Ada L. waved',
    'Ada L. waved',
    'Cy waved, in music',
    'Ben left the session',
  ]);
  assert.equal(sessionStatus(together), '1 here · 1 elsewhere');
  assert.deepEqual(sessionPeople(together).map((p) => [p.name, p.where]), [['Ada L.', 'here'], ['Cy', 'music']]);
  assert.equal(panelPeople(together), 'Ada L.\there\nCy\tmusic');
  await together.stop();
  assert.equal(sessionStatus(together), 'Connecting…');
});
