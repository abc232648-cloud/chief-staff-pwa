import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const farm = read('src/api/farm.ts');
const hook = read('src/features/team/useTeam.ts');
const screen = read('src/features/team/TeamScreen.tsx');
const fixtures = read('src/features/team/fixtures.ts');
const screens = read('src/screens/index.tsx');

test('S8 Team uses the existing authenticated Chief Farm staff endpoint', () => {
  assert.match(farm, /staff\(signal\?: AbortSignal\)[\s\S]*?['"]\/api\/farm\/staff['"]/);
  assert.match(hook, /farmApi\.staff/);
  assert.doesNotMatch(hook, /\/api\/team|\/api\/staff-directory/);
});

test('team scope is backend supplied rather than reconstructed from frontend role guesses', () => {
  assert.match(farm, /scope:\s*'FARM_DIRECTORY' \| 'SUPERVISED_TASK_ASSIGNMENTS' \| 'SELF'/);
  assert.match(screen, /team\.scope_source/);
  assert.match(screen, /team\.scope/);
  assert.doesNotMatch(screen, /identity\.role\s*===\s*['"]supervisor['"][\s\S]{0,180}filter\(/);
  assert.doesNotMatch(screen, /supervisor_id\s*===\s*identity/);
});

test('attendance is explicitly not connected and never inferred from task activity', () => {
  assert.match(farm, /attendance_status:\s*'NOT_CONNECTED'/);
  assert.match(farm, /attendance_available:\s*false/);
  assert.match(screen, /Attendance/);
  assert.match(screen, /Not connected/);
  assert.match(screen, /does not infer whether someone is physically on site from task activity/);
  assert.doesNotMatch(screen + hook, /attendance[^\n]{0,60}(present|absent|checked.?in|on.?site)/i);
  assert.doesNotMatch(screen + hook, /(present|absent|checked.?in|on.?site)[^\n]{0,60}attendance/i);
});

test('Supervisor verification remains on authoritative Tasks surface', () => {
  assert.match(screen, /verification_count/);
  assert.match(screen, /Open task verification/);
  assert.match(screen, /to="\/tasks"/);
  assert.match(screen, /does not duplicate task state/);
  assert.doesNotMatch(screen, /mutateFarmTask|VERIFY'|REQUEST_CORRECTION/);
});

test('DEV team fixtures are isolated and clearly non-authoritative', () => {
  assert.match(hook, /identity\.isSimulated/);
  assert.match(hook, /provenance:\s*'mock_isolated'/);
  assert.match(fixtures, /Development fixture only/);
  assert.match(fixtures, /No organizational relationship shown here is Chief state/);
  assert.match(fixtures, /Attendance is not connected/);
});

test('legacy Team placeholder is replaced by the scoped S8 feature', () => {
  assert.match(screens, /export \{ TeamScreen \} from ['"]\.\.\/features\/team\/TeamScreen['"]/);
  assert.doesNotMatch(screens, /S8\/S9 will connect/);
  assert.doesNotMatch(screens, /Team data is not connected yet/);
});
