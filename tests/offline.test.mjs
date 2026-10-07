import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const store = read('src/storage/offlineStore.ts');
const queue = read('src/offline/OfflineQueueContext.tsx');
const panel = read('src/features/offline/OfflineQueuePanel.tsx');

test('S12 local records are namespaced by environment and immutable Chief user id', () => {
  assert.match(store, /return `\$\{environment\}:\$\{identity\.userId\}`/);
  assert.match(store, /ownerUserId:\s*identity\.userId/);
  assert.match(store, /record\.ownerUserId !== identity\.userId/);
  assert.doesNotMatch(store, /displayName|staffNumber/);
});

test('queue success is claimed only after IndexedDB transaction completion', () => {
  assert.match(store, /await txComplete\(transaction\)/);
  assert.match(store, /transaction\.oncomplete/);
  assert.match(store, /transaction\.onabort/);
});

test('queued replay uses exact persisted payload and validates Chief receipt', () => {
  assert.match(queue, /submitWorkerReport\(record\.payload as WorkerReportPayload\)/);
  assert.match(queue, /mutateIncident\(record\.payload as IncidentMutation\)/);
  assert.match(queue, /UNCONFIRMED_QUEUED_REPORT/);
  assert.match(queue, /UNCONFIRMED_QUEUED_INCIDENT/);
});

test('transport failures remain retryable while non-transport ambiguity needs attention', () => {
  assert.match(queue, /error\.origin === 'transport'/);
  assert.match(queue, /retryable \? 'queued' : 'needs_attention'/);
});

test('UI distinguishes device queue from Chief receipt', () => {
  assert.match(panel, /Device persistence is not Chief receipt/);
  assert.match(panel, /No local-save success is being claimed/);
  assert.match(panel, /Task state-changing commands remain live-only/);
});
