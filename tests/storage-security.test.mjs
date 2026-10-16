import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAdditionalAuthenticatedData,
  getSessionEncryptionKey,
  encryptPayload,
  decryptPayload
} from '../src/storage/security.ts';

test('buildAdditionalAuthenticatedData binds environment, userId, and version', () => {
  const aad = buildAdditionalAuthenticatedData('prod', 'user-123', 1);
  const text = new TextDecoder().decode(aad);
  assert.equal(text, 'CHIEF_OFFLINE:prod:user-123:v1');
});

test('AES-GCM encryption roundtrip preserves payload data', async () => {
  const rawKey = new Uint8Array(32);
  crypto.getRandomValues(rawKey);
  const key = await getSessionEncryptionKey(rawKey);

  const payload = {
    event_id: 'ev-991',
    category: 'WATER',
    location: 'Pump House',
    observed_at: '2026-01-01T08:00:00Z',
    summary: 'Water level checked'
  };

  const envelope = await encryptPayload(key, payload, 'prod', 'user-123', 1);
  assert.equal(envelope.format, 'aes-gcm-v1');
  assert.equal(envelope.version, 1);
  assert.ok(envelope.iv && envelope.iv.length > 0);
  assert.ok(envelope.ciphertext && envelope.ciphertext.length > 0);

  const decrypted = await decryptPayload(key, envelope, 'prod', 'user-123', 1);
  assert.deepEqual(decrypted, payload);
});

test('successive encryptions generate fresh random IVs and distinct ciphertexts', async () => {
  const rawKey = new Uint8Array(32);
  crypto.getRandomValues(rawKey);
  const key = await getSessionEncryptionKey(rawKey);

  const payload = { test: 'consistent data' };
  const env1 = await encryptPayload(key, payload, 'prod', 'user-123', 1);
  const env2 = await encryptPayload(key, payload, 'prod', 'user-123', 1);

  assert.notEqual(env1.iv, env2.iv);
  assert.notEqual(env1.ciphertext, env2.ciphertext);
});

test('tampered ciphertext fails closed during decryption', async () => {
  const rawKey = new Uint8Array(32);
  crypto.getRandomValues(rawKey);
  const key = await getSessionEncryptionKey(rawKey);

  const envelope = await encryptPayload(key, { secret: 'data' }, 'prod', 'user-123', 1);

  // Tamper ciphertext bytes
  const bytes = Uint8Array.from(atob(envelope.ciphertext), c => c.charCodeAt(0));
  bytes[0] ^= 0xff;
  const tampered = btoa(String.fromCharCode(...bytes));

  await assert.rejects(
    () => decryptPayload(key, { ...envelope, ciphertext: tampered }, 'prod', 'user-123', 1),
    /Decryption failed/
  );
});

test('user identity or environment AAD mismatch fails closed', async () => {
  const rawKey = new Uint8Array(32);
  crypto.getRandomValues(rawKey);
  const key = await getSessionEncryptionKey(rawKey);

  const envelope = await encryptPayload(key, { secret: 'data' }, 'prod', 'user-alice', 1);

  // User B cannot decrypt even with the same key
  await assert.rejects(
    () => decryptPayload(key, envelope, 'prod', 'user-bob', 1),
    /Decryption failed/
  );

  // Environment mismatch fails closed
  await assert.rejects(
    () => decryptPayload(key, envelope, 'dev', 'user-alice', 1),
    /Decryption failed/
  );
});
