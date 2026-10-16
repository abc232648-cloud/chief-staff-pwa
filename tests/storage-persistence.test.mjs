import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectPersistence, requestPersistence } from '../src/storage/persistence.ts';

test('inspection reports persistent storage without requesting it', async () => {
  let requests = 0;
  const storage = { persisted: async () => true, persist: async () => { requests++; return true; } };
  assert.deepEqual(await inspectPersistence(storage), { state: 'persistent', canRequest: false });
  assert.deepEqual(await requestPersistence(storage), { state: 'persistent', canRequest: false });
  assert.equal(requests, 0);
});

test('best-effort inspection does not invoke a permission request', async () => {
  let requests = 0;
  const storage = { persisted: async () => false, persist: async () => { requests++; return false; } };
  assert.deepEqual(await inspectPersistence(storage), { state: 'best-effort', canRequest: true });
  assert.equal(requests, 0);
});

test('unsupported browsers do not claim protection or offer an unusable request', async () => {
  assert.deepEqual(await inspectPersistence({}), { state: 'unsupported', canRequest: false });
  assert.deepEqual(await requestPersistence({}), { state: 'unsupported', canRequest: false });
  assert.deepEqual(await inspectPersistence({ persisted: async () => false }), { state: 'best-effort', canRequest: false });
});

test('explicit request is followed by a fresh browser observation', async () => {
  let granted = false;
  let reads = 0;
  const storage = { persisted: async () => { reads++; return granted; }, persist: async () => { granted = true; return true; } };
  assert.deepEqual(await requestPersistence(storage), { state: 'persistent', canRequest: false });
  assert.equal(reads, 2);
});

test('denied request keeps the best-effort warning', async () => {
  const storage = { persisted: async () => false, persist: async () => false };
  assert.deepEqual(await requestPersistence(storage), { state: 'best-effort', canRequest: true });
});

test('request result alone cannot manufacture persistent status', async () => {
  const storage = { persisted: async () => false, persist: async () => true };
  assert.equal((await requestPersistence(storage)).state, 'best-effort');
});

test('browser query or request failure remains unknown without exposing error detail', async () => {
  const fail = async () => { throw new Error('private browser detail'); };
  let requested = false;
  assert.deepEqual(await requestPersistence({ persisted: fail, persist: async () => { requested = true; } }), { state: 'unknown', canRequest: false });
  assert.equal(requested, false);
  assert.deepEqual(await requestPersistence({ persisted: async () => false, persist: fail }), { state: 'unknown', canRequest: false });
});

test('malformed browser observation fails closed', async () => {
  assert.deepEqual(await inspectPersistence({ persisted: async () => 'true' }), { state: 'unknown', canRequest: false });
});
