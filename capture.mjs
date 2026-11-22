// Captures the post-x video footage in headless Chromium via CDP.
// Scenes: typing (agent writes the game code) + gameplay (Neon Snake, steered
// toward the orb by reading window.__state and calling window.__steer).
// Node 22 stdlib only: child_process, fs, fetch, global WebSocket.
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const HOME = process.env.HOME;
const ENTRY = HOME + '/workspace/makefun/post-x-the-agent-builds-a-game-from-20261122-1709-entry/';
const CHROME = HOME + '/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const FRAMES = ENTRY + 'frames/';
fs.mkdirSync(FRAMES, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new',
  '--remote-debugging-port=9222',
  '--window-size=1080,1920',
  '--no-sandbox',
  '--hide-scrollbars',
  '--disable-gpu',
  '--user-data-dir=/tmp/postx-chrome-profile',
  'about:blank',
], { stdio: 'ignore' });

async function waitPort() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9222/json/version');
      if (r.ok) return;
    } catch (e) { /* not up yet */ }
    await sleep(200);
  }
  throw new Error('chrome debug port never came up');
}

let ws;
let nextId = 1;
const pending = new Map();
function cdp(method, params) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params: params || {} }));
  });
}
async function ev(expr) {
  const r = await cdp('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('evaluate failed: ' + JSON.stringify(r.exceptionDetails).slice(0, 200));
  return r.result.value;
}
async function shot(name) {
  const r = await cdp('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(FRAMES + name, Buffer.from(r.data, 'base64'));
}

function chooseMove(s) {
  const dirs = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
  const body = new Set(s.body.slice(0, -1).map((p) => p.x + ',' + p.y));
  let best = null;
  let bestScore = Infinity;
  for (const d of dirs) {
    if (d.x === -s.dir.x && d.y === -s.dir.y) continue;
    const nx = s.head.x + d.x;
    const ny = s.head.y + d.y;
    if (nx < 0 || nx >= s.cols || ny < 0 || ny >= s.rows) continue;
    if (body.has(nx + ',' + ny)) continue;
    const dist = Math.abs(nx - s.orb.x) + Math.abs(ny - s.orb.y);
    if (dist < bestScore) { bestScore = dist; best = d; }
  }
  return best;
}

async function recordFrames(prefix, seconds, steer) {
  const total = Math.round(seconds * 30);
  for (let i = 1; i <= total; i++) {
    const t0 = Date.now();
    if (steer) {
      try {
        const s = await ev('window.__state()');
        if (s && s.alive) {
          const m = chooseMove(s);
          if (m) await ev('window.__steer(' + m.x + ',' + m.y + ')');
        }
      } catch (e) { /* game not ready yet */ }
    }
    await shot(prefix + '-' + String(i).padStart(3, '0') + '.png');
    const spent = Date.now() - t0;
    if (spent < 33) await sleep(33 - spent);
  }
  console.log(prefix + ': ' + total + ' frames');
}

await waitPort();
const list = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const page = list.find((t) => t.type === 'page');
ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});
ws.onmessage = (msg) => {
  const data = JSON.parse(msg.data);
  if (data.id && pending.has(data.id)) {
    const p = pending.get(data.id);
    pending.delete(data.id);
    if (data.error) p.reject(new Error(JSON.stringify(data.error)));
    else p.resolve(data.result);
  }
};

await cdp('Page.enable');
await cdp('Runtime.enable');
await cdp('Emulation.setDeviceMetricsOverride', { width: 1080, height: 1920, deviceScaleFactor: 1, mobile: false });

await cdp('Page.navigate', { url: 'file://' + ENTRY + 'typing.html' });
await sleep(700);
await recordFrames('typing', 5.5, false);

await cdp('Page.navigate', { url: 'file://' + ENTRY + 'game.html' });
await sleep(900);
await recordFrames('game', 7, true);

ws.close();
chrome.kill();
console.log('capture done');
