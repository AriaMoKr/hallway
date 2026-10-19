import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENVIRONMENTS } from '../public/js/environments.js';
import { companyText, peopleText, placeName, statusText } from '../public/js/presence.js';

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
