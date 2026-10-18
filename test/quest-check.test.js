import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAdbDevices, devtoolsSockets, summarizeFrames, parseVrApiLine } from '../tools/quest-check.mjs';

test('adb devices: serials and states (adb on Windows prints CRLF)', () => {
  const out = 'List of devices attached\r\n192.168.1.20:5555\tdevice product:eureka model:Quest_3\r\n2G0YC1ZF\tunauthorized\r\n\r\n';
  assert.deepEqual(parseAdbDevices(out.replace(/\r/g, '')), [
    { serial: '192.168.1.20:5555', state: 'device' },
    { serial: '2G0YC1ZF', state: 'unauthorized' },
  ]);
  assert.deepEqual(parseAdbDevices('List of devices attached\n\n'), []);
});

test('DevTools sockets, the browser\'s own first', () => {
  const unix = [
    '0000000000000000: 00000002 00000000 00010000 0001 01 12345 @webview_devtools_remote_123',
    '0000000000000000: 00000002 00000000 00010000 0001 01 12346 @chrome_devtools_remote',
    '0000000000000000: 00000002 00000000 00010000 0001 01 12347 @chrome_devtools_remote',
    '0000000000000000: 00000002 00000000 00010000 0001 01 12348 @other_socket',
  ].join('\n');
  assert.deepEqual(devtoolsSockets(unix), ['chrome_devtools_remote', 'webview_devtools_remote_123']);
});

test('frames per phase: fps, drops over 1.5 frames, worst gap, most draw calls', () => {
  const at90 = 1000 / 90;
  const frames = [
    ...Array.from({ length: 89 }, () => ['stand', at90, 20]),
    ['stand', at90 * 2, 20],
    ['walk', at90, 30],
    ['walk', at90, 32],
  ];
  const s = summarizeFrames(frames, 90);
  assert.equal(s.stand.frames, 90);
  assert.equal(s.stand.dropped, 1);
  assert.equal(s.stand.worstMs, Math.round(at90 * 20) / 10);
  assert.ok(Math.abs(s.stand.fps - 89) < 0.1);
  assert.deepEqual({ ...s.walk, fps: Math.round(s.walk.fps) }, { frames: 2, dropped: 0, worstMs: 11.1, drawCalls: 32, fps: 90 });
});

test('a VrApi line', () => {
  const line = '1792362300.123 VrApi: FPS=91/90,Prd=24ms,Tear=0,Early=0,Stale=2,Stale2/5/10/max=1/0/0/2,CPU&GPU=5.54ms,GPU%=0.37,CPU%=0.16(W0.18),Temp=35.0C/0.0C';
  assert.deepEqual(parseVrApiLine(line), { fps: 91, target: 90, stale: 2, gpuPct: 37, cpuPct: 16, frameMs: 5.54 });
  assert.equal(parseVrApiLine('VrApi: something else'), null);
});
