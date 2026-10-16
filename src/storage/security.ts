/**
 * Authenticated Client-Side Payload Encryption Adapter (Phase 2 Unified Offline Security)
 *
 * Contract:
 * - Standard AES-GCM (256-bit) via Web Crypto API.
 * - Fresh random 12-byte IV generated for every ciphertext envelope.
 * - Authenticated Additional Data (AAD) cryptographically binds:
 *     `${environment}:${userId}:${payloadVersion}`
 * - Guarantees zero credential persistence (no passwords, session tokens, or keys saved to disk).
 * - Tampered ciphertext or scope mismatch fails closed.
 */

export interface EncryptedPayloadEnvelope {
  format: 'aes-gcm-v1';
  iv: string; // base64
  ciphertext: string; // base64
  version: 1;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}

function base64ToBytes(base64: string): Uint8Array {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

/**
 * Constructs the Additional Authenticated Data (AAD) buffer binding
 * the environment, user identity, and schema version to the encryption envelope.
 */
export function buildAdditionalAuthenticatedData(environment: string, userId: string, payloadVersion: number = 1): Uint8Array {
  return encoder.encode(`CHIEF_OFFLINE:${environment}:${userId}:v${payloadVersion}`);
}

/**
 * Derives or imports a non-extractable AES-GCM-256 CryptoKey bound to the current session.
 */
export async function getSessionEncryptionKey(secretMaterial: Uint8Array): Promise<CryptoKey> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Web Crypto API is unavailable in this environment.');
  }
  return crypto.subtle.importKey(
    'raw',
    secretMaterial as unknown as BufferSource,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts an arbitrary serializable payload with authenticated AES-GCM.
 */
export async function encryptPayload<T>(
  key: CryptoKey,
  payload: T,
  environment: string,
  userId: string,
  payloadVersion: number = 1
): Promise<EncryptedPayloadEnvelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aad = buildAdditionalAuthenticatedData(environment, userId, payloadVersion);
  const plaintext = encoder.encode(JSON.stringify(payload));

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource, additionalData: aad as unknown as BufferSource },
    key,
    plaintext as unknown as BufferSource
  );

  return {
    format: 'aes-gcm-v1',
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(cipherBuffer)),
    version: 1
  };
}

/**
 * Decrypts an authenticated AES-GCM envelope, verifying scope and integrity.
 */
export async function decryptPayload<T>(
  key: CryptoKey,
  envelope: EncryptedPayloadEnvelope,
  environment: string,
  userId: string,
  payloadVersion: number = 1
): Promise<T> {
  if (!envelope || envelope.format !== 'aes-gcm-v1' || envelope.version !== 1) {
    throw new Error('Unsupported or malformed encrypted payload envelope.');
  }

  const iv = base64ToBytes(envelope.iv);
  const ciphertext = base64ToBytes(envelope.ciphertext);
  const aad = buildAdditionalAuthenticatedData(environment, userId, payloadVersion);

  try {
    const plainBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource, additionalData: aad as unknown as BufferSource },
      key,
      ciphertext as unknown as BufferSource
    );
    const text = decoder.decode(plainBuffer);
    return JSON.parse(text) as T;
  } catch (error) {
    throw new Error('Decryption failed: corrupted ciphertext or authentication scope mismatch.');
  }
}
