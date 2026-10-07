import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const farm = read('src/api/farm.ts');
const hook = read('src/features/tasks/useTasks.ts');
const screen = read('src/features/tasks/TasksScreen.tsx');
const fixtures = read('src/features/tasks/fixtures.ts');
const screens = read('src/screens/index.tsx');

test('S6 reads and mutates only the authoritative Chief Farm task endpoint', () => {
  assert.match(farm, /getFarmTasks[\s\S]*?['"]\/api\/farm\/tasks['"]/);
  assert.match(farm, /mutateFarmTask[\s\S]*?['"]\/api\/farm\/tasks['"]/);
  assert.match(hook, /getFarmTasks/);
  assert.match(hook, /mutateFarmTask/);
  assert.doesNotMatch(hook, /current_work|farm\/brief/);
});

test('task actions use server-returned per-task capabilities instead of role guesses', () => {
  for (const capability of ['can_acknowledge','can_start','can_submit','can_verify','can_request_correction','can_escalate','can_cancel']) assert.match(screen, new RegExp(`task\\.capabilities\\.${capability}`));
  assert.doesNotMatch(screen, /identity\.role\s*===\s*['"]worker['"][\s\S]{0,160}(can_|ACKNOWLEDGE|START|SUBMIT)/);
  assert.doesNotMatch(screen, /identity\.role\s*===\s*['"]supervisor['"][\s\S]{0,160}(VERIFY|REQUEST_CORRECTION)/);
});

test('task mutations require Chief confirmation and never claim offline queueing in S6', () => {
  assert.match(screen, /not complete until Chief confirms the task event/i);
  assert.match(screen, /No local success is being substituted/i);
  assert.match(screen, /This screen changes task state only after Chief accepts the event/i);
  assert.doesNotMatch(hook + screen, /saved_locally|queued for chief|queueStorage|offline queue/i);
});

test('DEV task fixtures are isolated, explicitly non-authoritative, and read-only', () => {
  assert.match(hook, /identity\.isSimulated/);
  assert.match(hook, /DEV_TASK_MUTATION_BLOCKED/);
  assert.match(hook, /provenance:\s*'mock_isolated'/);
  assert.match(fixtures, /Development fixture only/);
  assert.match(fixtures, /No task, status, assignment, or action shown here is Chief state/);
  assert.match(screen, /Read-only development fixtures/);
});

test('server task lifecycle excludes completed_locally from the Staff API contract', () => {
  assert.doesNotMatch(farm, /COMPLETED_LOCALLY/);
  assert.match(farm, /AWAITING_VERIFICATION/);
  assert.match(farm, /NEEDS_CORRECTION/);
  assert.match(farm, /ESCALATED/);
});

test('Tasks tab composes authoritative task board with assigned SOP runbooks', () => {
  assert.match(screens, /TasksScreen as TaskBoardScreen/);
  assert.match(screens, /SopPanel/);
  assert.match(screens, /<TaskBoardScreen identity=\{identity\}/);
  assert.match(screens, /<SopPanel identity=\{identity\}/);
  assert.doesNotMatch(screens, /S6 will connect the Farm work ledger/);
  assert.doesNotMatch(screens, /Task workflow is not connected yet/);
});
