import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const hook = read('src/features/today/useFarmBrief.ts');
const screen = read('src/features/today/TodayScreen.tsx');
const fixtures = read('src/features/today/fixtures.ts');
const auth = read('src/auth/AuthContext.tsx');
const legacyScreens = read('src/screens/index.tsx');

test('Today production data comes from the verified Chief Farm brief endpoint', () => {
  assert.match(hook, /['"]\/api\/farm\/brief['"]/);
  assert.match(hook, /provenance:\s*response\.provenance/);
  assert.match(hook, /provenance:\s*'unavailable'/);
});

test('DEV Today fixture is isolated and labels itself non-authoritative', () => {
  assert.match(hook, /identity\.isSimulated/);
  assert.match(hook, /provenance:\s*'mock_isolated'/);
  assert.match(fixtures, /Development fixture only/);
  assert.match(fixtures, /not Chief Farm state/);
});

test('Today does not substitute invented production operational totals', () => {
  assert.doesNotMatch(screen + legacyScreens, /94%|99\.98%/);
  assert.match(screen, /data\.reporting\.length/);
  assert.match(screen, /data\.current_work\.length/);
  assert.match(screen, /data\.alerts\.length/);
  assert.match(screen, /No placeholder operational totals are being substituted/);
});

test('Today preserves backend truth caveat that observations are not full-day verified totals', () => {
  assert.match(screen, /Recorded observations are not automatically verified full-day totals/);
  assert.match(screen, /data\.notice/);
  assert.match(screen, /does not imply that no farm work exists/);
});

test('Farm 403 or pilot disablement is unavailable, not an invented unsupported-role decision', () => {
  assert.match(auth, /Chief Farm Staff access is currently unavailable or denied/);
  assert.match(auth, /No Staff role has been assumed/);
  assert.doesNotMatch(auth, /cause instanceof AuthApiError && cause\.status === 403[\s\S]{0,100}unsupported_role/);
});
