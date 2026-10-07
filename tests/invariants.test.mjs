import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');

const app = read('src/App.tsx');
const devMode = read('src/config/devMode.ts');
const capabilities = read('src/types/capabilities.ts');
const tokens = read('src/design/tokens.ts');
const css = read('src/index.css');
const nav = read('src/components/BottomNav.tsx');
const screens = read('src/screens/index.tsx');
const architecture = read('ARCHITECTURE.md');
const auth = read('src/auth/AuthContext.tsx');
const authApi = read('src/auth/authApi.ts');
const login = read('src/auth/LoginScreen.tsx');
const apiClient = read('src/api/client.ts');
const apiTypes = read('src/api/types.ts');
const farmApi = read('src/api/farm.ts');

test('DEV fixtures are build-time gated only', () => {
  assert.match(devMode, /VITE_CHIEF_STAFF_DEV_MODE\s*===\s*['"]true['"]/);
  assert.doesNotMatch(devMode, /location\.search|URLSearchParams|localStorage|sessionStorage/);
  assert.match(auth, /if \(isDevMode\)/);
});

test('production auth uses existing Chief same-origin cookie and CSRF contract', () => {
  assert.match(authApi, /['"]\/api\/auth\/login['"]/);
  assert.match(authApi, /['"]\/api\/auth\/session['"]/);
  assert.match(authApi, /['"]\/api\/auth\/logout['"]/);
  assert.match(authApi, /['"]\/api\/auth\/activity['"]/);
  assert.match(authApi, /['"]\/api\/farm\/setup['"]/);
  assert.match(authApi, /credentials:\s*['"]include['"]/);
  assert.match(authApi, /X-Chief-CSRF/);
  assert.doesNotMatch(auth + authApi, /localStorage|sessionStorage|indexedDB/);
});

test('Owner and Administrator are not silently converted into Staff Manager', () => {
  assert.match(auth, /principal\.role === 'Owner' \|\| principal\.role === 'Administrator'/);
  assert.match(app, /Owner\/Administrator identities should use Owner Mobile/);
});

test('Farm role drives production Staff role', () => {
  assert.match(auth, /farm\.farm_role === 'GENERAL_MANAGER'/);
  assert.match(auth, /farm\.farm_role === 'SUPERVISOR'/);
  assert.match(auth, /'manager'/);
  assert.match(auth, /'supervisor'/);
  assert.match(auth, /'worker'/);
});

test('login form never claims browser credential persistence', () => {
  assert.match(login, /Passwords and session cookies are not stored by this PWA/);
  assert.match(login, /autoComplete="current-password"/);
  assert.doesNotMatch(login, /localStorage|sessionStorage/);
});

test('general Chief API client is same-origin, no-store, cookie-authenticated and CSRF-gated', () => {
  assert.match(apiClient, /path\.startsWith\(['"]\/api\/['"]\)/);
  assert.match(apiClient, /credentials:\s*['"]include['"]/);
  assert.match(apiClient, /cache:\s*['"]no-store['"]/);
  assert.match(apiClient, /X-Chief-CSRF/);
  assert.match(apiClient, /CSRF_REQUIRED/);
  assert.doesNotMatch(apiClient, /Authorization|Bearer/);
});

test('DEV fixture sessions cannot use the live Chief API client', () => {
  assert.match(apiClient, /isChiefStaffDevMode\(\)/);
  assert.match(apiClient, /DEV_LIVE_API_BLOCKED/);
});

test('API provenance and errors distinguish live, Chief, transport, client and protocol states', () => {
  assert.match(apiTypes, /'live' \| 'cached' \| 'mock_isolated' \| 'unavailable'/);
  assert.match(apiTypes, /'chief' \| 'transport' \| 'client' \| 'protocol'/);
  assert.match(apiClient, /origin:\s*'chief'/);
  assert.match(apiClient, /origin:\s*'transport'/);
  assert.match(apiClient, /origin:\s*'client'/);
  assert.match(apiClient, /origin:\s*'protocol'/);
  assert.match(apiClient, /provenance:\s*'live'/);
});

test('API mutations have no automatic retry loop and require CSRF at request time', () => {
  assert.doesNotMatch(apiClient, /maxRetries|retryCount|while\s*\(true\)/);
  assert.match(apiClient, /mutation\s*=\s*!\['GET', 'HEAD'\]\.includes\(method\)/);
  assert.match(auth, /setStaffApiCsrfProvider\(\(\) => csrf\)/);
});

test('Farm adapter contains only backend routes verified to exist today', () => {
  for (const path of [
    '/api/farm/setup',
    '/api/farm/staff',
    '/api/farm/journal',
    '/api/farm/labour',
    '/api/farm/planning',
    '/api/farm/brief',
    '/api/farm/units',
    '/api/farm/physical-counts',
    '/api/farm/photos'
  ]) assert.ok(farmApi.includes(path), `${path} missing`);
  assert.doesNotMatch(farmApi, /\/api\/tasks|\/api\/team|\/api\/incidents|\/api\/emergencies/);
});

test('Worker Supervisor Manager roles and presentation capabilities are explicit', () => {
  assert.match(capabilities, /'worker' \| 'supervisor' \| 'manager'/);
  assert.match(capabilities, /Presentation capability projection/);
  for (const capability of [
    'tasks.complete.own',
    'tasks.verify.scoped',
    'operations.read.farm',
    'operations.escalate.owner'
  ]) assert.ok(capabilities.includes(capability), `${capability} missing`);
});

test('Chief-family design tokens match Owner Mobile visual DNA', () => {
  for (const token of ['#021209', '#041a10', '#34d399', '#f59e0b', '#f43f5e']) {
    assert.ok(tokens.includes(token) || css.includes(token), `${token} missing`);
  }
  assert.match(css, /min-height:\s*48px/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /focus-visible/);
});

test('Staff navigation is the frozen five-tab operational model', () => {
  for (const label of ['Today', 'Tasks', 'Report', 'Team', 'More']) assert.ok(nav.includes(label));
  assert.doesNotMatch(nav, /Agents|Inbox|Owner/);
});

test('Emergency UI states reporting boundary rather than inventing STOP', () => {
  assert.match(screens, /Report emergency/);
  assert.match(screens, /Only Chief can create authoritative STOP\/ASK routing/);
});

test('architecture keeps Staff separate from Owner authority and Chief remains authoritative', () => {
  assert.match(architecture, /separate operational client from Owner Mobile/);
  assert.match(architecture, /Chief remains authoritative/);
  assert.match(architecture, /STOP cannot be overridden/);
  assert.match(architecture, /ASK cannot silently become AUTO/);
});
