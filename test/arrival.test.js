import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arrivalDoorId, matchReferrer } from '../public/js/arrival.js';

const envs = [
  { id: 'vrlbry', url: 'https://ariamokr.github.io/vrlbry/' },
  { id: 'garden', url: 'https://ariamokr.github.io/garden/' },
  { id: 'far', url: 'https://example.org/' },
];
const arrive = (o) => arrivalDoorId({ search: '', referrer: '', navType: 'navigate', entryDoorId: null, lastDoorId: null, envs, ...o });

test('?from= names the door', () => {
  assert.equal(arrive({ search: '?from=garden' }), 'garden');
  assert.equal(arrive({ search: '?from=nowhere' }), null);
});

test('a referrer from inside an environment names its door', () => {
  assert.equal(arrive({ referrer: 'https://ariamokr.github.io/vrlbry/?xr=emulate' }), 'vrlbry');
  assert.equal(arrive({ referrer: 'https://ariamokr.github.io/vrlbry/reader-test.html' }), 'vrlbry');
  assert.equal(arrive({ referrer: 'https://ariamokr.github.io/vrlbryx/' }), null);
  assert.equal(arrive({ referrer: 'https://ariamokr.github.io/' }), null, 'the shared origin alone names neither');
  assert.equal(arrive({ referrer: 'https://example.org/' }), 'far', 'a cross-origin referrer is its origin alone');
  assert.equal(arrive({ referrer: 'https://elsewhere.net/' }), null);
  assert.equal(arrive({ referrer: 'not a url' }), null);
});

test('Back to the hallway: the door its history entry was left by', () => {
  assert.equal(arrive({ navType: 'back_forward', entryDoorId: 'garden' }), 'garden');
  // Came out of vrlbry's door (?from=vrlbry), went through the garden's, and pressed Back.
  assert.equal(arrive({ search: '?from=vrlbry', navType: 'back_forward', entryDoorId: 'garden', lastDoorId: 'garden' }), 'garden', 'not the ?from= it was first reached with');
  assert.equal(arrive({ search: '?from=vrlbry', navType: 'back_forward', entryDoorId: 'garden', lastDoorId: 'vrlbry' }), 'garden', 'nor the last door of the tab, gone through from another entry');
  assert.equal(arrive({ search: '?from=vrlbry', navType: 'reload', entryDoorId: 'garden' }), 'vrlbry', 'a reload is not Back');
  assert.equal(arrive({ search: '?from=vrlbry', navType: 'back_forward', entryDoorId: 'gone' }), 'vrlbry');
});

test('Back to an entry left some other way: ?from=, then the door last gone through in this tab', () => {
  assert.equal(arrive({ navType: 'back_forward', lastDoorId: 'garden' }), 'garden');
  assert.equal(arrive({ navType: 'navigate', lastDoorId: 'garden' }), null, 'a new visit starts at the entrance');
  assert.equal(arrive({ navType: 'back_forward', lastDoorId: 'gone' }), null);
  assert.equal(arrive({ search: '?from=vrlbry', navType: 'back_forward', lastDoorId: 'garden' }), 'vrlbry', '?from= before the tab\'s door');
});

test('the longest matching URL wins', () => {
  const nested = [
    { id: 'site', url: 'https://a.example/' },
    { id: 'sub', url: 'https://a.example/sub/' },
  ];
  assert.equal(matchReferrer('https://a.example/sub/page', nested).id, 'sub');
  assert.equal(matchReferrer('https://a.example/other', nested).id, 'site');
});

test('the real doors: a page anywhere in an environment names its door, whatever its URL\'s query', async () => {
  const { ENVIRONMENTS } = await import('../public/js/environments.js');
  for (const e of ENVIRONMENTS) {
    const u = new URL(e.url);
    assert.equal(matchReferrer(`${u.origin}${u.pathname}`, ENVIRONMENTS)?.id, e.id, e.id);
    assert.equal(matchReferrer(e.url, ENVIRONMENTS)?.id, e.id, e.id);
  }
});
