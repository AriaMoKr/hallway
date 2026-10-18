#!/usr/bin/env node
// Checks the hallway on a Meta Quest over adb: opens it in Quest Browser, enters VR (the headset
// made to act as worn, its proximity sensor given back at the end), times the session's frames
// while standing, walking the hall and facing the first open door, presses the control panel's
// settings and Exit VR through its handler, and puts the viewer's settings back. Writes a JSON
// report (and the headset's view, --screenshot) to perf/ and prints a summary. --help for usage.
// Adapted from vrlbry's tools/quest-perf.mjs.

import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs, promisify } from 'node:util';

const execFileP = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BROWSER = 'com.oculus.browser';
const SITE = 'https://ariamokr.github.io/hallway/';
const LOCAL_PORT = 8088;

const HELP = `Usage: node tools/quest-check.mjs [options]

Options:
  --url <url>      the hallway to check (default ${SITE})
  --local          check the dev server instead (npm start: http://localhost:${LOCAL_PORT}/, over adb reverse)
  --serial <id>    adb device serial, when several devices are connected
  --screenshot     also save the headset's view (both eyes) as a PNG
  --no-prox        leave the proximity sensor alone (the headset must then be worn to render)
  --out <dir>      where to write the report (default perf/)
  -h, --help       this help

Needs Node 22 or later (its WebSocket). The headset must be connected (USB or adb over Wi-Fi) with
USB debugging allowed for this PC.
Nobody needs to wear it: the check makes it act as worn and gives the sensor back at the end. The
panel is pressed through its handler, so pointing a controller and the sticks are not covered.`;

/** Meta's power manager broadcasts: act as if worn, and give the proximity sensor back. */
export const PROXIMITY = Object.freeze({
  worn: ['shell', 'am', 'broadcast', '-a', 'com.oculus.vrpowermanager.prox_close'],
  sensor: ['shell', 'am', 'broadcast', '-a', 'com.oculus.vrpowermanager.automation_disable'],
});

// ---------------------------------------------------------------------------------------------
// Parsing (exported for tests)

/** `adb devices` → [{ serial, state }]. */
export function parseAdbDevices(text) {
  return text
    .split('\n')
    .slice(1)
    .map((l) => l.trim().split(/\s+/))
    .filter(([serial, state]) => serial && state)
    .map(([serial, state]) => ({ serial, state }));
}

/** The DevTools socket names in /proc/net/unix, the browser's own first. */
export function devtoolsSockets(procNetUnix) {
  const names = new Set([...procNetUnix.matchAll(/@(\S*devtools_remote\S*)/g)].map((m) => m[1]));
  return [...names].sort((a, b) => (a === 'chrome_devtools_remote' ? -1 : b === 'chrome_devtools_remote' ? 1 : a.localeCompare(b)));
}

/**
 * Frame intervals [[phase, ms, drawCalls], …] → per phase { frames, fps, dropped, worstMs,
 * drawCalls }. A frame counts as dropped when its interval is over 1.5 frames at the session's rate.
 */
export function summarizeFrames(frames, rate) {
  const limit = (1000 / (rate || 72)) * 1.5;
  const out = {};
  for (const [phase, ms, calls] of frames) {
    const s = (out[phase] ||= { frames: 0, total: 0, dropped: 0, worstMs: 0, drawCalls: 0 });
    s.frames++;
    s.total += ms;
    if (ms > limit) s.dropped++;
    if (ms > s.worstMs) s.worstMs = ms;
    if (calls > s.drawCalls) s.drawCalls = calls;
  }
  for (const s of Object.values(out)) {
    s.fps = Math.round((1000 / (s.total / s.frames)) * 10) / 10;
    s.worstMs = Math.round(s.worstMs * 10) / 10;
    delete s.total;
  }
  return out;
}

/** The fields of one VrApi per-second log line ("FPS=90/90,…,GPU%=0.37,…") that matter here. */
export function parseVrApiLine(line) {
  const at = line.indexOf('FPS=');
  if (at < 0) return null;
  const f = {};
  for (const part of line.slice(at).trim().split(',')) {
    const eq = part.indexOf('=');
    if (eq > 0) f[part.slice(0, eq)] = part.slice(eq + 1);
  }
  const [fps, target] = (f.FPS || '').split('/').map(Number);
  const pct = (v) => (v == null ? null : Math.round(parseFloat(v) * 1000) / 10);
  return { fps, target, stale: Number(f.Stale) || 0, gpuPct: pct(f['GPU%']), cpuPct: pct(f['CPU%']), frameMs: parseFloat(f['CPU&GPU']) || null };
}

// ---------------------------------------------------------------------------------------------
// adb and DevTools

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function adbArgs(opts, args) {
  return opts.serial ? ['-s', opts.serial, ...args] : args;
}

async function adb(opts, ...args) {
  const { stdout } = await execFileP('adb', adbArgs(opts, args), { maxBuffer: 64 * 1024 * 1024, windowsHide: true });
  return stdout;
}

async function chooseDevice(opts) {
  const ready = parseAdbDevices(await adb({}, 'devices')).filter((d) => d.state === 'device');
  if (opts.serial) {
    if (!ready.some((d) => d.serial === opts.serial)) throw new Error(`adb device ${opts.serial} is not connected or not authorized`);
    return;
  }
  if (!ready.length) throw new Error('no adb device: connect the headset (USB, or adb over Wi-Fi), and allow USB debugging in it');
  if (ready.length > 1) throw new Error(`several devices are connected (${ready.map((d) => d.serial).join(', ')}): choose one with --serial`);
  opts.serial = ready[0].serial;
}

class Cdp {
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', () => reject(new Error(`cannot connect to ${url}`)), { once: true });
    });
    return new Cdp(ws);
  }

  constructor(ws) {
    this.ws = ws;
    this.seq = 0;
    this.pending = new Map();
    this.listeners = new Map();
    ws.addEventListener('message', ({ data }) => {
      const msg = JSON.parse(data);
      if (msg.id != null) {
        const p = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) p?.reject(new Error(msg.error.message));
        else p?.resolve(msg.result);
      } else {
        for (const fn of this.listeners.get(msg.method) || []) fn(msg.params);
      }
    });
  }

  send(method, params = {}) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(fn);
  }

  /** Evaluates an expression in the page (awaiting promises) and returns its JSON value. */
  async eval(expression, { userGesture = false } = {}) {
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text || 'evaluation failed');
    return r.result.value;
  }

  close() {
    this.ws.close();
  }
}

/** Polls the page every 150 ms until `expression` is truthy (its value), or null after `ms`. */
async function pollPage(cdp, expression, ms) {
  const until = Date.now() + ms;
  for (;;) {
    const v = await cdp.eval(expression).catch(() => null);
    if (v) return v;
    if (Date.now() >= until) return null;
    await sleep(150);
  }
}

/** Connects to the tab showing `url` that runs the hallway (window.__hallway), waiting up to `ms`. */
async function connectHallway(port, url, ms) {
  const until = Date.now() + ms;
  for (;;) {
    const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json(), () => []);
    for (const page of pages.filter((p) => p.type === 'page' && p.url.startsWith(url))) {
      const cdp = await Cdp.connect(`ws://127.0.0.1:${port}/devtools/page/${page.id}`).catch(() => null);
      if (cdp && (await cdp.eval('!!window.__hallway').catch(() => false))) return cdp;
      cdp?.close();
    }
    if (Date.now() >= until) throw new Error(`no hallway page at ${url} in Quest Browser`);
    await sleep(1000);
  }
}

// ---------------------------------------------------------------------------------------------
// In the page (strings evaluated over DevTools)

/** Records every XR frame's interval under the current phase (window.__check). */
const START_TIMING = `(() => {
  const h = __hallway, s = h.renderer.xr.getSession();
  window.__check = { phase: 'stand', frames: [], rate: s.frameRate ?? null, rates: s.supportedFrameRates ? [...s.supportedFrameRates] : null };
  let last = 0;
  const frame = (t) => {
    if (last) __check.frames.push([__check.phase, t - last, h.renderer.info.render.calls]);
    last = t;
    if (h.renderer.xr.isPresenting) s.requestAnimationFrame(frame);
  };
  s.requestAnimationFrame(frame);
  return true;
})()`;

/** Glides the viewer down the middle of the hall to its end and back, facing the way it goes. */
const WALK = `(() => {
  const h = __hallway, s = h.renderer.xr.getSession(), L = h.layout, head = new h.THREE.Vector3();
  __check.phase = 'walk';
  h.controls._turnAboutHead(-h.controls._headYaw());
  let z = -0.6, dir = -1, last = 0;
  const frame = (t) => {
    const dt = last ? (t - last) / 1000 : 0;
    last = t;
    z += dir * 1.4 * dt;
    if (dir < 0 && z < L.zEnd + 0.6) { dir = 1; h.controls._turnAboutHead(Math.PI); }
    if (dir > 0 && z > -0.8) { __check.phase = 'walked'; return; }
    h.camera.getWorldPosition(head);
    h.rig.position.x -= head.x;
    h.rig.position.z += z - head.z;
    s.requestAnimationFrame(frame);
  };
  s.requestAnimationFrame(frame);
  return true;
})()`;

/** Stands in front of the first open door, facing it: its portal fills the view. */
const FACE_DOOR = `(() => {
  const h = __hallway, d = h.layout.doors.find((d) => d.env), head = new h.THREE.Vector3();
  __check.phase = 'door';
  h.controls._turnAboutHead(-d.side * Math.PI / 2 - h.controls._headYaw());
  h.camera.getWorldPosition(head);
  h.rig.position.x += d.side * 0.6 - head.x;
  h.rig.position.z += d.z - head.z;
  return d.env.id;
})()`;

const PANEL_STATE = `({ panel: __hallway.hall.panel.state, move: __hallway.controls.move, turn: __hallway.controls.turn, saved: localStorage.getItem('hallway.nav') })`;

// ---------------------------------------------------------------------------------------------

async function check(opts) {
  const url = opts.local ? `http://localhost:${LOCAL_PORT}/` : opts.url || SITE;
  const report = { at: new Date().toISOString(), url, device: {}, steps: [], frames: null, vrApi: [], errors: [], warnings: [] };
  let port = null, prox = false, logcat = null;
  const step = (name, data) => {
    report.steps.push({ step: name, ...data });
    console.log(`  ${name}${data && Object.keys(data).length ? `: ${JSON.stringify(data)}` : ''}`);
  };
  try {
    await chooseDevice(opts);
    const pkg = await adb(opts, 'shell', 'dumpsys', 'package', BROWSER).catch(() => '');
    report.device = {
      serial: opts.serial,
      model: (await adb(opts, 'shell', 'getprop', 'ro.product.model')).trim(),
      build: (await adb(opts, 'shell', 'getprop', 'ro.build.display.id')).trim(),
      browser: pkg.match(/versionName=(\S+)/)?.[1] ?? null,
    };
    console.log(`${report.device.model}, Quest Browser ${report.device.browser}: ${url}`);
    if (opts.local) await adb(opts, 'reverse', `tcp:${LOCAL_PORT}`, `tcp:${LOCAL_PORT}`);
    await adb(opts, 'shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', url, BROWSER);
    await sleep(2500);
    const sockets = devtoolsSockets(await adb(opts, 'shell', 'cat', '/proc/net/unix'));
    if (!sockets.length) throw new Error('no DevTools socket on the headset: is Quest Browser running?');
    port = Number((await adb(opts, 'forward', 'tcp:0', `localabstract:${sockets[0]}`)).trim());
    const cdp = await connectHallway(port, url, 30000);
    await cdp.send('Runtime.enable');
    cdp.on('Runtime.exceptionThrown', (p) => report.errors.push(p.exceptionDetails?.exception?.description || p.exceptionDetails?.text));
    cdp.on('Runtime.consoleAPICalled', (p) => {
      const text = p.args.map((a) => a.value ?? a.description).join(' ');
      if (p.type === 'error') report.errors.push(text);
      else if (p.type === 'warning') report.warnings.push(text);
    });
    // The site as it is now, not a cached copy.
    await cdp.send('Page.reload', { ignoreCache: true });
    if (!(await pollPage(cdp, '!!window.__hallway && window.__hallway.fade.value === 0', 20000))) throw new Error('the hallway did not finish loading');
    const savedNav = await cdp.eval("localStorage.getItem('hallway.nav')");
    step('loaded', { panel: await cdp.eval('__hallway.hall.panel.state') });

    if (!opts['no-prox']) {
      await adb(opts, ...PROXIMITY.worn);
      prox = true;
    }
    logcat = spawn('adb', adbArgs(opts, ['logcat', '-v', 'epoch', '-T', '1', '-s', 'VrApi:I']), { windowsHide: true });
    let buf = '';
    logcat.stdout.on('data', (d) => {
      buf += d;
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const l of lines) {
        const v = parseVrApiLine(l);
        if (v) report.vrApi.push(v);
      }
    });
    logcat.on('error', () => {});

    await cdp.eval('__hallway.enterVR()', { userGesture: true }).catch((e) => report.errors.push(`enterVR: ${e.message}`));
    if (!(await pollPage(cdp, '__hallway.renderer.xr.isPresenting', 10000))) throw new Error('VR did not start');
    step('entered VR', { panel: await cdp.eval('__hallway.hall.panel.state') });
    await cdp.eval(START_TIMING);
    await sleep(4000);
    await cdp.eval(WALK);
    await pollPage(cdp, "__check.phase === 'walked'", 40000);
    step('walked the hall');
    step('facing the door', { door: await cdp.eval(FACE_DOOR) });
    await sleep(4000);
    if (opts.screenshot) {
      const { stdout } = await execFileP('adb', adbArgs(opts, ['exec-out', 'screencap', '-p']), { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024, windowsHide: true });
      report.screenshot = path.join(opts.outDir, `quest-check-${stamp(report.at)}.png`);
      fs.mkdirSync(opts.outDir, { recursive: true });
      fs.writeFileSync(report.screenshot, stdout);
    }
    await cdp.eval("(__check.phase = 'panel', true)");
    for (const id of ['move:teleport', 'turn:smooth', 'move:smooth', 'turn:snap']) {
      await cdp.eval(`(__hallway.controls.onPanel(${JSON.stringify(id)}), true)`);
      await sleep(600);
      step(`panel ${id}`, await cdp.eval(PANEL_STATE));
    }
    const frames = await cdp.eval('__check.frames');
    const rate = await cdp.eval('__check.rate');
    report.frameRate = { session: rate, supported: await cdp.eval('__check.rates') };
    report.frames = summarizeFrames(frames, rate);
    await cdp.eval('(__hallway.controls.onPanel("vr"), true)');
    step('panel vr (Exit VR)', { exited: !!(await pollPage(cdp, '!__hallway.renderer.xr.isPresenting', 5000)) });
    await cdp.eval(`(() => {
      const v = ${JSON.stringify(savedNav)};
      if (v == null) localStorage.removeItem('hallway.nav'); else localStorage.setItem('hallway.nav', v);
      return true;
    })()`);
    cdp.close();
  } catch (err) {
    report.errors.push(`check: ${err.message}`);
  } finally {
    logcat?.kill();
    if (prox) await adb(opts, ...PROXIMITY.sensor).catch(() => {});
    if (port) await adb(opts, 'forward', '--remove', `tcp:${port}`).catch(() => {});
  }
  return report;
}

function stamp(iso) {
  return iso.replace(/[:.]/g, '-').slice(0, 19);
}

function printSummary(report) {
  if (report.frames) {
    console.log(`\nSession at ${report.frameRate.session ?? '?'} Hz (supported: ${report.frameRate.supported?.join(', ') ?? '?'})`);
    console.table(report.frames);
  }
  const v = report.vrApi;
  if (v.length) {
    const avg = (k) => Math.round((v.reduce((s, x) => s + (x[k] ?? 0), 0) / v.length) * 10) / 10;
    console.log(`VrApi, ${v.length} s: ${avg('fps')} fps, ${v.reduce((s, x) => s + x.stale, 0)} stale, GPU ${avg('gpuPct')} %, CPU ${avg('cpuPct')} %, CPU&GPU ${avg('frameMs')} ms`);
  }
  if (report.warnings.length) console.log(`Warnings:\n  ${report.warnings.join('\n  ')}`);
  console.log(report.errors.length ? `Errors:\n  ${report.errors.join('\n  ')}` : 'No errors.');
}

async function main() {
  const { values: opts } = parseArgs({
    options: {
      url: { type: 'string' },
      local: { type: 'boolean', default: false },
      serial: { type: 'string' },
      screenshot: { type: 'boolean', default: false },
      'no-prox': { type: 'boolean', default: false },
      out: { type: 'string', default: path.join(ROOT, 'perf') },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (opts.help) {
    console.log(HELP);
    return;
  }
  opts.outDir = path.resolve(opts.out);
  const report = await check(opts);
  fs.mkdirSync(opts.outDir, { recursive: true });
  const file = path.join(opts.outDir, `quest-check-${stamp(report.at)}.json`);
  fs.writeFileSync(file, JSON.stringify(report, null, 2));
  printSummary(report);
  console.log(`Report: ${path.relative(process.cwd(), file)}`);
  process.exitCode = report.errors.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}
