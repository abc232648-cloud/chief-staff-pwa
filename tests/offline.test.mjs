import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const store = read('src/storage/offlineStore.ts');
const queue = read('src/offline/OfflineQueueContext.tsx');
const panel = read('src/features/offline/OfflineQueuePanel.tsx');
const media = read('src/api/media.ts');
const taskPhoto = read('src/features/tasks/TaskPhotoEvidence.tsx');
const taskScreen = read('src/features/tasks/TasksScreen.tsx');

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

test('queued replay uses exact persisted report and incident payloads and validates Chief receipt', () => {
  assert.match(queue, /submitWorkerReport\(record\.payload as WorkerReportPayload\)/);
  assert.match(queue, /mutateIncident\(record\.payload as IncidentMutation\)/);
  assert.match(queue, /UNCONFIRMED_QUEUED_REPORT/);
  assert.match(queue, /UNCONFIRMED_QUEUED_INCIDENT/);
});

test('media adapter uses the authoritative Chief photo contract', () => {
  assert.match(media, /post<FarmPhotoReceipt>\('\/api\/farm\/photos'/);
  assert.match(media, /get<FarmPhotoMetadata\[]>\(`\/api\/farm\/photos\?work_id=/);
  assert.match(media, /crypto\.subtle\.digest\('SHA-256'/);
  assert.match(media, /blobToBase64/);
});

test('queued media revalidates device bytes and independently reconciles Chief metadata before deletion', () => {
  assert.match(queue, /getOfflineMedia\(identity, payload\.media_id\)/);
  assert.match(queue, /blobSha256\(media\.blob\)/);
  assert.match(queue, /uploadFarmPhoto/);
  assert.match(queue, /getFarmPhotos\(payload\.work_id\)/);
  assert.match(queue, /photoMetadataMatches\(receipt\.record, payload\)/);
  assert.match(queue, /photoMetadataMatches\(authoritative, payload\)/);
  assert.match(queue, /removeOfflineQueueAndMedia\(identity, record\.id, result\.mediaId\)/);
  assert.match(store, /db\.transaction\(\[QUEUE_STORE, MEDIA_STORE\], 'readwrite'\)/);
  assert.doesNotMatch(queue, /MEDIA_REPLAY_UNSUPPORTED/);
});

test('missing authoritative listing stays retryable while integrity or metadata conflicts need attention', () => {
  assert.match(queue, /MEDIA_RECONCILIATION_PENDING/);
  assert.match(queue, /MEDIA_RECONCILIATION_CONFLICT/);
  assert.match(queue, /QUEUED_MEDIA_INTEGRITY_CONFLICT/);
  assert.match(queue, /error\.origin === 'transport' \|\| error\.code === 'MEDIA_RECONCILIATION_PENDING'/);
  assert.match(queue, /retryable \? 'queued' : 'needs_attention'/);
});

test('task photo capture is shown only for Chief tasks requiring PHOTO and normalises evidence before queueing', () => {
  assert.match(taskPhoto, /task\.evidence_required\.includes\('PHOTO'\)/);
  assert.match(taskPhoto, /createImageBitmap\(snapshot\)/);
  assert.match(taskPhoto, /file\.arrayBuffer\(\)/);
  assert.match(taskPhoto, /canvas\.toBlob/);
  assert.match(taskPhoto, /'image\/png'/);
  assert.match(taskPhoto, /enqueueMedia\(task\.task_id, png\)/);
  assert.match(taskPhoto, /CHIEF_MAX_BYTES = 2 \* 1024 \* 1024/);
  assert.match(taskScreen, /<TaskPhotoEvidence task=\{task\} simulated=\{simulated\} \/>/);
});

test('transport failures remain retryable while non-transport ambiguity needs attention', () => {
  assert.match(queue, /error\.origin === 'transport'/);
  assert.match(queue, /retryable \? 'queued' : 'needs_attention'/);
});

test('UI distinguishes device queue from Chief receipt and explains authoritative photo reconciliation', () => {
  assert.match(panel, /Device persistence is not Chief receipt/);
  assert.match(panel, /No local-save success is being claimed/);
  assert.match(panel, /Task state-changing commands remain live-only/);
  assert.match(panel, /exact photo ID, work ID, SHA-256 and byte count/);
});
