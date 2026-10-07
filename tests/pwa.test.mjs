import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = path => fs.readFileSync(path, 'utf8');
const sw = read('public/sw.js');
const manifest = read('public/manifest.webmanifest');
const register = read('src/pwa/register.ts');
const panel = read('src/features/pwa/PwaDevicePanel.tsx');
const html = read('index.html');

test('S13 has an installable same-family manifest', () => {
  const parsed = JSON.parse(manifest);
  assert.equal(parsed.name, 'CHIEF Staff Operations');
  assert.equal(parsed.display, 'standalone');
  assert.equal(parsed.theme_color, '#021209');
  assert.match(html, /rel="manifest" href="\/manifest\.webmanifest"/);
});

test('service worker never intercepts API or non-GET mutations', () => {
  assert.match(sw, /request\.method !== 'GET'/);
  assert.match(sw, /url\.pathname\.startsWith\('\/api\/'\)/);
  assert.doesNotMatch(sw, /\/api\/.*cache\.put|cache\.put.*\/api\//s);
});

test('service worker update requires an explicit user activation message', () => {
  assert.match(sw, /CHIEF_STAFF_ACTIVATE_UPDATE/);
  assert.match(panel, /Apply available app update/);
  assert.match(register, /registration\.waiting/);
});

test('install UI is truthful about app shell and iOS guidance', () => {
  assert.match(panel, /does not make Chief API state, task authority, or synchronization available offline/);
  assert.match(panel, /Add to Home Screen/);
  assert.match(panel, /has not offered an install prompt/);
});

test('DEV build does not register production-style service worker', () => {
  assert.match(register, /isChiefStaffDevMode\(\)/);
});
