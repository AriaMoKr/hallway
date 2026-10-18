// Copies the browser modules the page imports from node_modules into public/vendor/, so public/ is
// the whole site: served as it is by tools/serve.mjs and published as it is to GitHub Pages.
// Runs after `npm install` (postinstall). IWER (a devDependency, for ?xr=emulate) is copied when
// installed and skipped otherwise.
import { copyFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'vendor');

const FILES = [
  // three.module.js imports three.core.js.
  { from: 'three/build/three.module.js', to: 'three/build/three.module.js' },
  { from: 'three/build/three.core.js', to: 'three/build/three.core.js' },
  { from: 'three/LICENSE', to: 'three/LICENSE' },
  { from: 'iwer/build/iwer.module.js', to: 'iwer/iwer.module.js', optional: true },
];

rmSync(out, { recursive: true, force: true });
for (const f of FILES) {
  const src = join(root, 'node_modules', f.from);
  if (!existsSync(src)) {
    if (f.optional) continue;
    throw new Error(`vendor: ${f.from} is missing; run npm install`);
  }
  const dest = join(out, f.to);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
}
console.log(`vendor: copied into ${out}`);
