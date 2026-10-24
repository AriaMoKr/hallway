// The site as published: the environments list, the page, and every client module.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENVIRONMENTS } from '../public/js/environments.js';
import { LINK_PARAMS } from 'common/door.js';
import { HALL_VIEW } from '../public/js/door-view.js';

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

test('nothing in style.css takes away the focus ring, which forced colours keep and a border colour is not', () => {
  const css = readFileSync(join(root, 'css', 'style.css'), 'utf8');
  assert.match(css, /:focus-visible \{ outline: 2px solid/);
  assert.doesNotMatch(css, /outline:\s*(none|0)\b/);
});

test("the link preview: its tags, and the picture they name (door-view.js's HALL_VIEW)", () => {
  const meta = (k) => html.match(new RegExp(`<meta (?:property|name)="${k}" content="([^"]*)">`))?.[1];
  const { homepage } = JSON.parse(readFileSync(join(root, '..', 'package.json'), 'utf8'));
  assert.equal(meta('og:url'), homepage);
  assert.equal(meta('og:image'), new URL('social.jpg', homepage).href);
  for (const k of ['og:type', 'og:site_name', 'og:title', 'og:description', 'og:image:alt']) assert.ok(meta(k), k);
  assert.equal(meta('twitter:card'), 'summary_large_image');
  const size = { width: Number(meta('og:image:width')), height: Number(meta('og:image:height')) };
  assert.deepEqual(size, { width: HALL_VIEW.width, height: HALL_VIEW.height });
  assert.deepEqual(jpegSize(readFileSync(join(root, 'social.jpg'))), size, 'social.jpg (node tools/door-views.mjs)');
});

test('every client module parses', () => {
  for (const f of readdirSync(join(root, 'js'))) {
    if (!f.endsWith('.js')) continue;
    const r = spawnSync(process.execPath, ['--check', join(root, 'js', f)], { encoding: 'utf8' });
    assert.equal(r.status, 0, `${f}: ${r.stderr}`);
  }
});

test('client modules import only three, the shared packages and each other', () => {
  const layer = /^layersharedsession\/[a-z]+\.js$/;
  const common = /^common\/[a-z]+\.js$/;
  for (const f of readdirSync(join(root, 'js'))) {
    if (!f.endsWith('.js')) continue;
    const src = readFileSync(join(root, 'js', f), 'utf8');
    for (const m of src.matchAll(/(?:^import\s.*?from\s+|import\()'([^']+)'/gms)) {
      assert.ok(m[1] === 'three' || layer.test(m[1]) || common.test(m[1]) || m[1].startsWith('./'), `${f} imports ${m[1]}`);
      // The layer's modules are the ones tools/vendor.mjs copies from the package.
      if (layer.test(m[1])) assert.ok(existsSync(join(packageDir('layersharedsession'), 'public', 'js', m[1].split('/')[1])), `${f}: no ${m[1]} in the package (npm install?)`);
      if (common.test(m[1])) assert.ok(existsSync(join(packageDir('common'), 'src', m[1].split('/')[1])), `${f}: no ${m[1]} in the package (npm install?)`);
    }
  }
});

test('the import map maps everything the shared session loads to its copy in vendor/', () => {
  const { imports } = JSON.parse(html.match(/<script type="importmap">(.*?)<\/script>/s)[1]);
  assert.deepEqual(Object.keys(imports).sort(), ['@noble/secp256k1', '@trystero-p2p/core', 'common/', 'layersharedsession/', 'three', 'trystero']);
  for (const url of Object.values(imports)) assert.match(url, /^\.\/vendor\//);
  if (!existsSync(join(root, 'vendor'))) return; // not installed yet
  for (const [name, url] of Object.entries(imports)) {
    const path = join(root, url);
    assert.ok(existsSync(path), `${name}: ${url} missing (npm install)`);
  }
  // Every bare import in the vendored session modules is one the map knows.
  for (const dir of ['common', 'layersharedsession', 'trystero-core', 'trystero-nostr', 'noble-secp256k1']) {
    for (const f of readdirSync(join(root, 'vendor', dir))) {
      if (!/\.m?js$/.test(f)) continue;
      const src = readFileSync(join(root, 'vendor', dir, f), 'utf8');
      for (const m of src.matchAll(/(?:^|\n)\s*(?:import|export)[^'"\n;]*?from\s*['"]([^'"]+)['"]/g)) {
        if (m[1].startsWith('./')) assert.ok(existsSync(join(root, 'vendor', dir, m[1])), `${dir}/${f}: ${m[1]}`);
        else assert.ok(m[1] in imports || Object.keys(imports).some((k) => k.endsWith('/') && m[1].startsWith(k)), `${dir}/${f} imports ${m[1]}, which the import map lacks`);
      }
    }
  }
});

/** A JPEG's size, from its start-of-frame segment. */
function jpegSize(b) {
  for (let i = 2; i + 9 < b.length; i += 2 + b.readUInt16BE(i + 2)) {
    const marker = b[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
  }
  return null;
}

function packageDir(name) {
  return join(root, '..', 'node_modules', name);
}
