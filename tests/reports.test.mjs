import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const api = read('src/api/reports.ts');
const hook = read('src/features/reports/useWorkerReports.ts');
const screen = read('src/features/reports/ReportScreen.tsx');
const fixtures = read('src/features/reports/fixtures.ts');
const screens = read('src/screens/index.tsx');

test('S7 worker reports use only the authoritative Chief report endpoint', () => {
  assert.match(api, /getWorkerReports[\s\S]*?['"]\/api\/farm\/worker-reports['"]/);
  assert.match(api, /submitWorkerReport[\s\S]*?['"]\/api\/farm\/worker-reports['"]/);
  assert.doesNotMatch(api + hook, /\/api\/farm\/journal|\/api\/farm\/health-records|\/api\/farm\/staff/);
});

test('Chief receipt is required before Staff calls a report received', () => {
  assert.match(hook, /\['RECEIVED', 'ALREADY_RECEIVED'\]\.includes\(receipt\.status\)/);
  assert.match(hook, /receipt\.evidence_status !== 'HUMAN_REPORTED'/);
  assert.match(hook, /!receipt\.report_id/);
  assert.match(hook, /UNCONFIRMED_REPORT_RECEIPT/);
  assert.match(screen, /This is a receipt, not verification/);
  assert.match(screen, /Chief did not confirm receipt/);
});

test('failed submission retains the same draft id and does not claim queueing', () => {
  assert.match(screen, /eventId:\s*reportEventId\(\)/);
  assert.match(screen, /event_id:\s*draft\.eventId/);
  assert.match(screen, /if \(receipt\) setDraft\(newDraft\(\)\)/);
  assert.match(screen, /same submission ID for safe retry/);
  assert.match(screen, /It is not being called queued or received/);
  assert.match(screen, /No offline queue exists yet in S7/);
  assert.doesNotMatch(hook + screen, /saved_locally|queued for chief|queueStorage|indexedDB/i);
});

test('S7 does not expose incident or emergency as normal worker-report categories', () => {
  assert.doesNotMatch(api, /\| 'INCIDENT'|\| 'EMERGENCY'/);
  assert.match(screen, /Emergency workflow is not connected in S7/);
  assert.match(screen, /Emergency submission unavailable in this build/);
  assert.match(screen, /disabled><ShieldAlert/);
  assert.doesNotMatch(screen, /submitWorkerReport[\s\S]{0,300}EMERGENCY/);
});

test('development report fixtures are isolated and submissions blocked', () => {
  assert.match(hook, /identity\.isSimulated/);
  assert.match(hook, /DEV_REPORT_SUBMISSION_BLOCKED/);
  assert.match(hook, /provenance:\s*'mock_isolated'/);
  assert.match(fixtures, /Development fixture only/);
  assert.match(fixtures, /No report shown here was received by Chief/);
  assert.match(screen, /Development report fixtures are read-only/);
});

test('report form preserves human observation semantics and does not invent canonical entities', () => {
  assert.match(screen, /entity_id:\s*null/);
  assert.match(screen, /free-text location does not create a canonical Farm entity/i);
  assert.match(screen, /Describe only what you saw, counted, measured, or were told to record/);
  assert.match(screen, /human-reported evidence/);
  assert.match(screen, /does not automatically verify it or change Farm balances/);
});

test('legacy Report placeholder is replaced by the S7 feature', () => {
  assert.match(screens, /export \{ ReportScreen \} from ['"]\.\.\/features\/reports\/ReportScreen['"]/);
  assert.doesNotMatch(screens, /S7\/S10 will add durable report/);
});
