import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = path => fs.readFileSync(path, 'utf8');
const sw = read('public/sw.js');
const manifest = read('public/manifest.webmanifest');
const register = read('src/pwa/register.ts');
const panel = read('src/features/pwa/PwaDevicePanel.tsx');
const html = read('index.html');
const vite = read('vite.config.ts');

test('S13 has an installable Staff-only manifest and build base', () => {
  const parsed = JSON.parse(manifest);
  assert.equal(parsed.name, 'CHIEF Staff Operations');
  assert.equal(parsed.display, 'standalone');
  assert.equal(parsed.theme_color, '#021209');
  assert.equal(parsed.id, '/staff/');
  assert.equal(parsed.start_url, '/staff/');
  assert.equal(parsed.scope, '/staff/');
  assert.ok(parsed.icons.every(icon => icon.src.startsWith('/staff/')));
  assert.match(vite, /base:\s*['"]\/staff\/['"]/);
  assert.match(html, /href="%BASE_URL%manifest\.webmanifest"/);
});

test('service worker bypasses API and anything outside Staff scope before cache logic', () => {
  const methodGuard = sw.indexOf("request.method !== 'GET'");
  const apiGuard = sw.indexOf("url.pathname.startsWith('/api/')");
  const scopeGuard = sw.indexOf("url.pathname.startsWith(`${SCOPE_PATH}/`)");
  const respondWith = sw.indexOf('event.respondWith');
  const cachePut = sw.indexOf('cache.put(request, copy)');
  assert.ok(methodGuard >= 0 && apiGuard >= 0 && scopeGuard > apiGuard && respondWith > scopeGuard && cachePut > scopeGuard);
});

test('Staff service worker registration is base-derived and Staff-scoped', () => {
  assert.match(register, /import\.meta\.env\.BASE_URL/);
  assert.match(register, /base !== ['"]\/staff\/['"]/);
  assert.match(register, /register\(`\$\{base\}sw\.js`, \{ scope: base \}\)/);
  assert.doesNotMatch(register, /register\(['"]\/sw\.js['"]/);
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
