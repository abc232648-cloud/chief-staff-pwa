/**
 * Authenticated offline payload encryption primitives.
 *
 * AES-GCM provides confidentiality/integrity for queue/media values at rest.
 * The storage layer persists a non-extractable CryptoKey so records survive a
 * browser restart. That protects against casual/raw IndexedDB disclosure, not
 * against trusted same-origin JavaScript, XSS, a compromised browser profile,
 * or deletion of site data. No password/session credential is used as keying
 * material and no extractable raw key bytes are persisted.
 */

export interface EncryptedPayloadEnvelope {
  format: 'aes-gcm-v1';
  iv: string;
  ciphertext: string;
  version: 1;
}

export interface EncryptedBinaryEnvelope {
  format: 'aes-gcm-bytes-v1';
  iv: string;
  ciphertext: string;
  version: 1;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function base64ToBytes(base64: string): Uint8Array {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function assertWebCrypto(): void {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Web Crypto API is unavailable in this environment.');
  }
}

export function buildAdditionalAuthenticatedData(
  environment: string,
  userId: string,
  payloadVersion: number = 1,
  context: string = ''
): Uint8Array {
  const base = `CHIEF_OFFLINE:${environment}:${userId}:v${payloadVersion}`;
  return encoder.encode(context ? `${base}:${context}` : base);
}

/** Import caller-provided bytes as a non-extractable session key (test/adapter use). */
export async function getSessionEncryptionKey(secretMaterial: Uint8Array): Promise<CryptoKey> {
  assertWebCrypto();
  return crypto.subtle.importKey(
    'raw',
    secretMaterial as unknown as BufferSource,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/** Generate the non-extractable key persisted by the offline storage layer. */
export async function generateStorageEncryptionKey(): Promise<CryptoKey> {
  assertWebCrypto();
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export function isUsableStorageKey(value: unknown): value is CryptoKey {
  if (typeof CryptoKey === 'undefined' || !(value instanceof CryptoKey)) return false;
  return value.type === 'secret'
    && value.extractable === false
    && value.algorithm.name === 'AES-GCM'
    && value.usages.includes('encrypt')
    && value.usages.includes('decrypt');
}

export async function encryptPayload<T>(
  key: CryptoKey,
  payload: T,
  environment: string,
  userId: string,
  payloadVersion: number = 1,
  context: string = ''
): Promise<EncryptedPayloadEnvelope> {
  assertWebCrypto();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aad = buildAdditionalAuthenticatedData(environment, userId, payloadVersion, context);
  const plaintext = encoder.encode(JSON.stringify(payload));
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource, additionalData: aad as unknown as BufferSource },
    key,
    plaintext as unknown as BufferSource
  );
  return { format: 'aes-gcm-v1', iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(cipherBuffer)), version: 1 };
}

export async function decryptPayload<T>(
  key: CryptoKey,
  envelope: EncryptedPayloadEnvelope,
  environment: string,
  userId: string,
  payloadVersion: number = 1,
  context: string = ''
): Promise<T> {
  assertWebCrypto();
  if (!envelope || envelope.format !== 'aes-gcm-v1' || envelope.version !== 1) {
    throw new Error('Unsupported or malformed encrypted payload envelope.');
  }
  const iv = base64ToBytes(envelope.iv);
  const ciphertext = base64ToBytes(envelope.ciphertext);
  const aad = buildAdditionalAuthenticatedData(environment, userId, payloadVersion, context);
  try {
    const plainBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource, additionalData: aad as unknown as BufferSource },
      key,
      ciphertext as unknown as BufferSource
    );
    return JSON.parse(decoder.decode(plainBuffer)) as T;
  } catch {
    throw new Error('Decryption failed: corrupted ciphertext or authentication scope mismatch.');
  }
}

export async function encryptBytes(
  key: CryptoKey,
  bytes: Uint8Array,
  environment: string,
  userId: string,
  context: string
): Promise<EncryptedBinaryEnvelope> {
  assertWebCrypto();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aad = buildAdditionalAuthenticatedData(environment, userId, 1, context);
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource, additionalData: aad as unknown as BufferSource },
    key,
    bytes as unknown as BufferSource
  );
  return { format: 'aes-gcm-bytes-v1', iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(cipherBuffer)), version: 1 };
}

export async function decryptBytes(
  key: CryptoKey,
  envelope: EncryptedBinaryEnvelope,
  environment: string,
  userId: string,
  context: string
): Promise<Uint8Array> {
  assertWebCrypto();
  if (!envelope || envelope.format !== 'aes-gcm-bytes-v1' || envelope.version !== 1) {
    throw new Error('Unsupported or malformed encrypted binary envelope.');
  }
  const iv = base64ToBytes(envelope.iv);
  const ciphertext = base64ToBytes(envelope.ciphertext);
  const aad = buildAdditionalAuthenticatedData(environment, userId, 1, context);
  try {
    const plainBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource, additionalData: aad as unknown as BufferSource },
      key,
      ciphertext as unknown as BufferSource
    );
    return new Uint8Array(plainBuffer);
  } catch {
    throw new Error('Decryption failed: corrupted binary ciphertext or authentication scope mismatch.');
  }
}
