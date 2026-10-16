import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAdditionalAuthenticatedData,
  getSessionEncryptionKey,
  generateStorageEncryptionKey,
  encryptPayload,
  decryptPayload,
  encryptBytes,
  decryptBytes
} from '../src/storage/security.ts';

test('buildAdditionalAuthenticatedData binds environment, userId, version and optional record context', () => {
  const aad = buildAdditionalAuthenticatedData('prod', 'user-123', 1);
  assert.equal(new TextDecoder().decode(aad), 'CHIEF_OFFLINE:prod:user-123:v1');
  const scoped = buildAdditionalAuthenticatedData('prod', 'user-123', 1, 'queue:q1:worker_report');
  assert.equal(new TextDecoder().decode(scoped), 'CHIEF_OFFLINE:prod:user-123:v1:queue:q1:worker_report');
});

test('generated persistent storage key is AES-GCM and non-extractable', async () => {
  const key = await generateStorageEncryptionKey();
  assert.equal(key.type, 'secret');
  assert.equal(key.extractable, false);
  assert.equal(key.algorithm.name, 'AES-GCM');
  await assert.rejects(() => crypto.subtle.exportKey('raw', key));
});

test('AES-GCM encryption roundtrip preserves payload data', async () => {
  const rawKey = new Uint8Array(32);
  crypto.getRandomValues(rawKey);
  const key = await getSessionEncryptionKey(rawKey);
  const payload = { event_id: 'ev-991', category: 'WATER', location: 'Pump House', observed_at: '2026-01-01T08:00:00Z', summary: 'Water level checked' };
  const context = 'queue:q1:worker_report';
  const envelope = await encryptPayload(key, payload, 'prod', 'user-123', 1, context);
  assert.equal(envelope.format, 'aes-gcm-v1');
  assert.equal(envelope.version, 1);
  assert.ok(envelope.iv && envelope.ciphertext);
  assert.deepEqual(await decryptPayload(key, envelope, 'prod', 'user-123', 1, context), payload);
});

test('successive encryptions generate fresh random IVs and distinct ciphertexts', async () => {
  const rawKey = new Uint8Array(32); crypto.getRandomValues(rawKey);
  const key = await getSessionEncryptionKey(rawKey);
  const payload = { test: 'consistent data' };
  const env1 = await encryptPayload(key, payload, 'prod', 'user-123', 1);
  const env2 = await encryptPayload(key, payload, 'prod', 'user-123', 1);
  assert.notEqual(env1.iv, env2.iv);
  assert.notEqual(env1.ciphertext, env2.ciphertext);
});

test('tampered ciphertext and AAD context mismatches fail closed', async () => {
  const rawKey = new Uint8Array(32); crypto.getRandomValues(rawKey);
  const key = await getSessionEncryptionKey(rawKey);
  const envelope = await encryptPayload(key, { secret: 'data' }, 'prod', 'user-alice', 1, 'queue:q1:incident');
  const bytes = Uint8Array.from(atob(envelope.ciphertext), c => c.charCodeAt(0));
  bytes[0] ^= 0xff;
  const tampered = btoa(String.fromCharCode(...bytes));
  await assert.rejects(() => decryptPayload(key, { ...envelope, ciphertext: tampered }, 'prod', 'user-alice', 1, 'queue:q1:incident'), /Decryption failed/);
  await assert.rejects(() => decryptPayload(key, envelope, 'prod', 'user-bob', 1, 'queue:q1:incident'), /Decryption failed/);
  await assert.rejects(() => decryptPayload(key, envelope, 'dev', 'user-alice', 1, 'queue:q1:incident'), /Decryption failed/);
  await assert.rejects(() => decryptPayload(key, envelope, 'prod', 'user-alice', 1, 'queue:q2:incident'), /Decryption failed/);
});

test('binary encryption roundtrip preserves exact media bytes and binds record context', async () => {
  const key = await generateStorageEncryptionKey();
  const bytes = new Uint8Array([0, 1, 2, 127, 128, 254, 255]);
  const context = 'media:m1:deadbeef:7';
  const envelope = await encryptBytes(key, bytes, 'prod', 'user-123', context);
  assert.equal(envelope.format, 'aes-gcm-bytes-v1');
  assert.deepEqual(await decryptBytes(key, envelope, 'prod', 'user-123', context), bytes);
  await assert.rejects(() => decryptBytes(key, envelope, 'prod', 'user-123', 'media:m2:deadbeef:7'), /Decryption failed/);
});
