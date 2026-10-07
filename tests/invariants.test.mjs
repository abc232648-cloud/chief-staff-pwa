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
