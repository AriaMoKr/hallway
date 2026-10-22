#!/usr/bin/env node
// Renders the view out of every open door (public/js/door-view.js) in a browser and writes
// public/views/: <id>.jpg for each, and views.json with the parameters an environment hangs it
// with (AriaMoKr/common's README, "The view from your door"); and the link preview's picture,
// public/social.jpg.
// Run it after changing the hall or its doors, with the dev server running (npm start). --help
// for usage.

import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs, promisify } from 'node:util';
import { devtoolsSockets } from './quest-check.mjs';

const execFileP = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BROWSER = 'com.oculus.browser';
const PORT = 8088; // the dev server's (npm start), unless --port

const HELP = `Usage: node tools/door-views.mjs [options]

Renders the view out of every open door in a browser, from the dev server (npm start, port ${PORT}),
and writes <id>.jpg and views.json to public/views/, and the link preview's picture (the hall from
near the entrance) to public/social.jpg.

Options:
  --cdp <url>      a desktop browser's DevTools endpoint (one started with --remote-debugging-port,
                   http://localhost:${PORT}/ open in it); without it, a Meta Quest over adb
  --port <n>       the dev server's port (default ${PORT}; node tools/serve.mjs --port <n>)
  --serial <id>    adb device serial, when several devices are connected
  --out <dir>      where to write the views (default public/views)
  --social <file>  where to write the link preview's picture (default public/social.jpg)
  -h, --help       this help`;

/** views.json: each view's picture and its parameters, by door id. */
export function viewsJson(views) {
  const out = {
    about: 'The view out of each of the hallway\'s open doors: hang <image> behind your door back to the hallway (https://github.com/AriaMoKr/common#the-view-from-your-door).',
    views: {},
  };
  for (const v of views) out.views[v.id] = { image: `${v.id}.jpg`, ...v.params };
  return `${JSON.stringify(out, null, 1)}\n`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Writes a data: URL's JPEG to file. */
function writeJpeg(file, dataUrl) {
  fs.writeFileSync(file, Buffer.from(dataUrl.replace(/^data:image\/jpeg;base64,/, ''), 'base64'));
}

/** Sends one DevTools protocol command to a page and returns its reply. */
async function send(wsUrl, method, params) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', () => reject(new Error(`cannot connect to ${wsUrl}`)), { once: true });
  });
  try {
    const reply = await new Promise((resolve, reject) => {
      ws.addEventListener('close', () => reject(new Error(`${wsUrl} closed`)), { once: true });
      ws.addEventListener('message', ({ data }) => {
        const m = JSON.parse(data);
        if (m.id === 1) resolve(m);
      });
      ws.send(JSON.stringify({ id: 1, method, params }));
    });
    if (reply.error) throw new Error(reply.error.message);
    return reply.result;
  } finally {
    ws.close();
  }
}

async function evaluate(wsUrl, expression) {
  const r = await send(wsUrl, 'Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}

/** Waits until expression is true in the page, which may be loading meanwhile. */
async function waitFor(ws, expression, ms) {
  const until = Date.now() + ms;
  while (!(await evaluate(ws, expression).catch(() => false))) {
    if (Date.now() > until) throw new Error(`the page did not come back (${expression})`);
    await sleep(500);
  }
}

/** The hallway's page at the endpoint, once its __hallway is there: its WebSocket URL. */
async function findPage(endpoint, port, ms) {
  const until = Date.now() + ms;
  for (;;) {
    const pages = await fetch(`${endpoint}/json/list`).then((r) => r.json()).catch(() => []);
    for (const p of pages) {
      if (p.type !== 'page' || !p.url.startsWith(`http://localhost:${port}/`)) continue;
      const ws = `${endpoint.replace(/^http/, 'ws')}/devtools/page/${p.id}`;
      if (await evaluate(ws, '!!window.__hallway?.doorViews').catch(() => false)) return ws;
    }
    if (Date.now() > until) throw new Error(`no hallway page from http://localhost:${port}/ in the browser (is npm start running?)`);
    await sleep(1000);
  }
}

async function main() {
  const { values: opts } = parseArgs({
    options: {
      cdp: { type: 'string' }, port: { type: 'string', default: String(PORT) }, serial: { type: 'string' },
      out: { type: 'string', default: path.join(ROOT, 'public', 'views') }, social: { type: 'string', default: path.join(ROOT, 'public', 'social.jpg') },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (opts.help) return console.log(HELP);
  const adb = (...args) => execFileP('adb', opts.serial ? ['-s', opts.serial, ...args] : args, { windowsHide: true }).then((r) => r.stdout);
  const port = Number(opts.port);
  let endpoint = opts.cdp?.replace(/\/$/, '');
  let forward = null;
  try {
    if (!endpoint) {
      await adb('reverse', `tcp:${port}`, `tcp:${port}`);
      await adb('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', `http://localhost:${port}/`, BROWSER);
      const sockets = devtoolsSockets(await adb('shell', 'cat', '/proc/net/unix'));
      if (!sockets.length) throw new Error('no DevTools socket on the headset: is Quest Browser running?');
      forward = Number((await adb('forward', 'tcp:0', `localabstract:${sockets[0]}`)).trim());
      endpoint = `http://127.0.0.1:${forward}`;
    }
    const ws = await findPage(endpoint, port, 60000);
    // A tab left open from an earlier run still has the hall as it was then: load it afresh. The
    // browser reloads it, since a tab hidden for a while hardly runs its own timers.
    const loaded = await evaluate(ws, 'performance.timeOrigin');
    await send(ws, 'Page.reload', { ignoreCache: true });
    await waitFor(ws, `!!window.__hallway?.doorViews && performance.timeOrigin > ${loaded}`, 60000);
    const views = await evaluate(ws, '__hallway.doorViews()');
    fs.mkdirSync(opts.out, { recursive: true });
    for (const v of views) {
      const file = path.join(opts.out, `${v.id}.jpg`);
      writeJpeg(file, v.jpeg);
      console.log(`${path.relative(ROOT, file)}: ${Math.round(fs.statSync(file).size / 1024)} KB · ${JSON.stringify(v.params)}`);
    }
    fs.writeFileSync(path.join(opts.out, 'views.json'), viewsJson(views));
    console.log(`${path.relative(ROOT, path.join(opts.out, 'views.json'))}: ${views.length} view${views.length === 1 ? '' : 's'}`);
    writeJpeg(opts.social, await evaluate(ws, '__hallway.hallView()'));
    console.log(`${path.relative(ROOT, opts.social)}: ${Math.round(fs.statSync(opts.social).size / 1024)} KB · the link preview's picture`);
  } finally {
    if (forward) await adb('forward', '--remove', `tcp:${forward}`).catch(() => {});
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((err) => {
    console.error(`door-views: ${err.message}`);
    process.exitCode = 1;
  });
}
