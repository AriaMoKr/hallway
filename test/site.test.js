// The site as published: the environments list, the page, and every client module.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENVIRONMENTS } from '../public/js/environments.js';
import { LINK_PARAMS } from '../public/js/link.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const html = readFileSync(join(root, 'index.html'), 'utf8');

test('every environment is complete and its id unique', () => {
  const ids = new Set();
  for (const e of ENVIRONMENTS) {
    assert.match(e.id, /^[a-z0-9-]+$/, `id ${e.id}`);
    assert.ok(!ids.has(e.id), `duplicate id ${e.id}`);
    ids.add(e.id);
    assert.ok(e.title, `${e.id}: title`);
    if ('sign' in e) assert.ok(typeof e.sign === 'string' && e.sign.trim(), `${e.id}: sign`);
    assert.equal(new URL(e.url).protocol, 'https:', `${e.id}: url`);
    if (e.preview) assert.equal(new URL(e.preview).protocol, 'https:', `${e.id}: preview`);
    assert.match(e.color, /^#[0-9a-f]{6}$/i, `${e.id}: color`);
    for (const k of LINK_PARAMS) assert.ok(!new URL(e.url).searchParams.has(k), `${e.id}: url uses ${k}, which the hallway adds`);
  }
});

test('the page without JavaScript lists every door', () => {
  const noscript = html.slice(html.indexOf('<noscript>'), html.indexOf('</noscript>'));
  for (const e of ENVIRONMENTS) assert.ok(noscript.includes(`href="${e.url}"`), `${e.id} missing from <noscript>`);
});

test('the page uses relative URLs only, so it works under any path (GitHub Pages: /<repo>/)', () => {
  const urls = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
  const map = JSON.parse(html.match(/<script type="importmap">(.*?)<\/script>/s)[1]);
  urls.push(...Object.values(map.imports));
  for (const u of urls) assert.ok(!u.startsWith('/'), `root-relative URL ${u}`);
});

test('every client module parses', () => {
  for (const f of readdirSync(join(root, 'js'))) {
    if (!f.endsWith('.js')) continue;
    const r = spawnSync(process.execPath, ['--check', join(root, 'js', f)], { encoding: 'utf8' });
    assert.equal(r.status, 0, `${f}: ${r.stderr}`);
  }
});

test('client modules import only three and each other', () => {
  for (const f of readdirSync(join(root, 'js'))) {
    if (!f.endsWith('.js')) continue;
    const src = readFileSync(join(root, 'js', f), 'utf8');
    for (const m of src.matchAll(/^import\s.*?from\s+'([^']+)'/gms)) {
      assert.ok(m[1] === 'three' || m[1].startsWith('./'), `${f} imports ${m[1]}`);
    }
  }
});
