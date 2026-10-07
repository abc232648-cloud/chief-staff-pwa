import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = path => fs.readFileSync(path, 'utf8');
const api = read('src/api/reports.ts');
const hook = read('src/features/reports/useWorkerReports.ts');
const screen = read('src/features/reports/ReportScreen.tsx');
const fixtures = read('src/features/reports/fixtures.ts');
const screens = read('src/screens/index.tsx');

test('worker reports use only the authoritative Chief report endpoint', () => {
  assert.match(api, /getWorkerReports[\s\S]*?['"]\/api\/farm\/worker-reports['"]/); assert.match(api, /submitWorkerReport[\s\S]*?['"]\/api\/farm\/worker-reports['"]/); assert.doesNotMatch(api + hook, /\/api\/farm\/journal|\/api\/farm\/health-records|\/api\/farm\/staff/);
});

test('Chief receipt is required before Staff calls a report received', () => {
  assert.match(hook, /\['RECEIVED', 'ALREADY_RECEIVED'\]\.includes\(receipt\.status\)/); assert.match(hook, /receipt\.evidence_status !== 'HUMAN_REPORTED'/); assert.match(hook, /!receipt\.report_id/); assert.match(hook, /UNCONFIRMED_REPORT_RECEIPT/); assert.match(screen, /This is a receipt, not verification/);
});

test('S12 queues only transport failures after durable persistence', () => {
  assert.match(hook, /error\.origin === 'transport'/); assert.match(hook, /enqueue\('worker_report', payload, payload\.event_id\)/); assert.match(hook, /outcome: 'queued'/); assert.match(screen, /Stored on this device/); assert.match(screen, /not “Received by Chief/); assert.match(screen, /No queue success is claimed unless durable device persistence completed/);
});

test('field-report endpoint does not smuggle incident or emergency categories', () => { assert.doesNotMatch(api, /\| 'INCIDENT'|\| 'EMERGENCY'/); assert.doesNotMatch(screen, /submitWorkerReport[\s\S]{0,300}EMERGENCY/); });

test('development report fixtures are isolated and submissions blocked', () => { assert.match(hook, /identity\.isSimulated/); assert.match(hook, /DEV_REPORT_SUBMISSION_BLOCKED/); assert.match(fixtures, /Development fixture only/); assert.match(screen, /Development report fixtures are read-only/); });

test('report form preserves human observation semantics and does not invent canonical entities', () => { assert.match(screen, /entity_id:\s*null/); assert.match(screen, /free-text location does not create a canonical Farm entity/i); assert.match(screen, /Describe only what you saw, counted, measured, or were told to record/); assert.match(screen, /human-reported evidence/); });

test('Report tab composes field reporting with separate incident surface', () => { assert.match(screens, /ReportScreen as FieldReportScreen/); assert.match(screens, /IncidentEmergencyPanel/); assert.match(screens, /<FieldReportScreen identity=\{identity\}/); assert.match(screens, /<IncidentEmergencyPanel identity=\{identity\}/); });
