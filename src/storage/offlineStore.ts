import { isChiefStaffDevMode } from '../config/devMode';
import type { StaffIdentity } from '../types/capabilities';
import {
  decryptBytes,
  decryptPayload,
  encryptBytes,
  encryptPayload,
  generateStorageEncryptionKey,
  isUsableStorageKey,
  type EncryptedBinaryEnvelope,
  type EncryptedPayloadEnvelope
} from './security';

const DB_NAME = 'chief_staff_pwa';
const DB_VERSION = 2;
const QUEUE_STORE = 'queue';
const MEDIA_STORE = 'media';
const KEY_STORE = 'crypto_keys';

export type OfflineQueueKind = 'worker_report' | 'incident' | 'media_upload';
export type OfflineQueueStatus = 'queued' | 'syncing' | 'needs_attention';

export interface OfflineQueueRecord {
  id: string;
  namespace: string;
  ownerUserId: string;
  environment: 'prod' | 'dev';
  kind: OfflineQueueKind;
  payloadVersion: 1;
  payload: unknown;
  createdAt: number;
  updatedAt: number;
  attempts: number;
  status: OfflineQueueStatus;
  lastError: string | null;
}

export interface OfflineMediaRecord {
  id: string;
  namespace: string;
  ownerUserId: string;
  environment: 'prod' | 'dev';
  blob: Blob;
  mimeType: 'image/png';
  createdAt: number;
  purpose: 'task_photo';
  workId: string;
  sha256: string;
  bytes: number;
}

type StoredQueueRecord = Omit<OfflineQueueRecord, 'payload'> & {
  storageVersion: 2;
  encryptedPayload: EncryptedPayloadEnvelope;
};

type StoredMediaRecord = Omit<OfflineMediaRecord, 'blob'> & {
  storageVersion: 2;
  encryptedBlob: EncryptedBinaryEnvelope;
};

type QueueStorageRecord = OfflineQueueRecord | StoredQueueRecord;
type MediaStorageRecord = OfflineMediaRecord | StoredMediaRecord;

interface StorageKeyRecord {
  namespace: string;
  ownerUserId: string;
  environment: 'prod' | 'dev';
  key: CryptoKey;
  version: 1;
  createdAt: number;
}

export function storageNamespace(identity: StaffIdentity): string {
  const environment = isChiefStaffDevMode() ? 'dev' : 'prod';
  return `${environment}:${identity.userId}`;
}

function environmentFor(identity: StaffIdentity): 'prod' | 'dev' {
  return isChiefStaffDevMode() ? 'dev' : 'prod';
}

function isStoredQueue(record: QueueStorageRecord): record is StoredQueueRecord {
  return 'storageVersion' in record && record.storageVersion === 2 && 'encryptedPayload' in record;
}

function isStoredMedia(record: MediaStorageRecord): record is StoredMediaRecord {
  return 'storageVersion' in record && record.storageVersion === 2 && 'encryptedBlob' in record;
}

function queueContext(record: Pick<OfflineQueueRecord, 'id' | 'kind'>): string {
  return `queue:${record.id}:${record.kind}`;
}

function mediaContext(record: Pick<OfflineMediaRecord, 'id' | 'sha256' | 'bytes'>): string {
  return `media:${record.id}:${record.sha256}:${record.bytes}`;
}

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB is unavailable on this device.'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('Chief Staff local storage could not be opened.'));
    request.onblocked = () => reject(new Error('Chief Staff local storage upgrade is blocked by another open tab.'));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        const queue = db.createObjectStore(QUEUE_STORE, { keyPath: 'id' });
        queue.createIndex('namespace', 'namespace', { unique: false });
      }
      if (!db.objectStoreNames.contains(MEDIA_STORE)) {
        const media = db.createObjectStore(MEDIA_STORE, { keyPath: 'id' });
        media.createIndex('namespace', 'namespace', { unique: false });
      }
      if (!db.objectStoreNames.contains(KEY_STORE)) {
        db.createObjectStore(KEY_STORE, { keyPath: 'namespace' });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function txComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Local storage transaction failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Local storage transaction was aborted.'));
  });
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Local storage request failed.'));
  });
}

async function readNamespaceRecords(db: IDBDatabase, namespace: string): Promise<{ queue: QueueStorageRecord[]; media: MediaStorageRecord[] }> {
  const transaction = db.transaction([QUEUE_STORE, MEDIA_STORE], 'readonly');
  const queueRequest = transaction.objectStore(QUEUE_STORE).index('namespace').getAll(namespace);
  const mediaRequest = transaction.objectStore(MEDIA_STORE).index('namespace').getAll(namespace);
  const [queue, media] = await Promise.all([
    requestValue(queueRequest) as Promise<QueueStorageRecord[]>,
    requestValue(mediaRequest) as Promise<MediaStorageRecord[]>
  ]);
  await txComplete(transaction);
  return { queue, media };
}

function validateKeyRecord(record: StorageKeyRecord | undefined, identity: StaffIdentity, namespace: string, environment: 'prod' | 'dev'): CryptoKey | null {
  if (!record) return null;
  if (record.namespace !== namespace || record.ownerUserId !== identity.userId || record.environment !== environment || record.version !== 1 || !isUsableStorageKey(record.key)) {
    throw new Error('Offline encryption key ownership or format check failed.');
  }
  return record.key;
}

async function getOrCreateStorageKey(db: IDBDatabase, identity: StaffIdentity): Promise<CryptoKey> {
  const namespace = storageNamespace(identity);
  const environment = environmentFor(identity);
  let transaction = db.transaction(KEY_STORE, 'readonly');
  const existing = await requestValue(transaction.objectStore(KEY_STORE).get(namespace)) as StorageKeyRecord | undefined;
  await txComplete(transaction);
  const existingKey = validateKeyRecord(existing, identity, namespace, environment);
  if (existingKey) return existingKey;

  // Never generate a replacement key over ciphertext. If site/key storage was
  // partially cleared, preserve encrypted records and surface recovery failure.
  const records = await readNamespaceRecords(db, namespace);
  if (records.queue.some(isStoredQueue) || records.media.some(isStoredMedia)) {
    throw new Error('Offline encrypted data exists but its encryption key is unavailable. Data was preserved; clear local site data only if recovery is intentionally abandoned.');
  }

  const candidate = await generateStorageEncryptionKey();
  transaction = db.transaction(KEY_STORE, 'readwrite');
  const store = transaction.objectStore(KEY_STORE);
  const raced = await requestValue(store.get(namespace)) as StorageKeyRecord | undefined;
  if (raced) {
    const racedKey = validateKeyRecord(raced, identity, namespace, environment);
    await txComplete(transaction);
    if (!racedKey) throw new Error('Offline encryption key creation race failed.');
    return racedKey;
  }
  const record: StorageKeyRecord = { namespace, ownerUserId: identity.userId, environment, key: candidate, version: 1, createdAt: Date.now() };
  store.put(record);
  await txComplete(transaction);
  return candidate;
}

async function persistStoredQueue(db: IDBDatabase, record: StoredQueueRecord): Promise<void> {
  const transaction = db.transaction(QUEUE_STORE, 'readwrite');
  transaction.objectStore(QUEUE_STORE).put(record);
  await txComplete(transaction);
}

async function persistStoredMedia(db: IDBDatabase, record: StoredMediaRecord): Promise<void> {
  const transaction = db.transaction(MEDIA_STORE, 'readwrite');
  transaction.objectStore(MEDIA_STORE).put(record);
  await txComplete(transaction);
}

async function decryptOrMigrateQueue(db: IDBDatabase, identity: StaffIdentity, key: CryptoKey, record: QueueStorageRecord): Promise<OfflineQueueRecord> {
  if (isStoredQueue(record)) {
    const payload = await decryptPayload<unknown>(key, record.encryptedPayload, record.environment, record.ownerUserId, record.payloadVersion, queueContext(record));
    const { storageVersion: _storageVersion, encryptedPayload: _encryptedPayload, ...metadata } = record;
    return { ...metadata, payload };
  }
  const envelope = await encryptPayload(key, record.payload, record.environment, record.ownerUserId, record.payloadVersion, queueContext(record));
  const { payload, ...metadata } = record;
  const migrated: StoredQueueRecord = { ...metadata, storageVersion: 2, encryptedPayload: envelope };
  await persistStoredQueue(db, migrated);
  return { ...record, payload };
}

async function decryptOrMigrateMedia(db: IDBDatabase, identity: StaffIdentity, key: CryptoKey, record: MediaStorageRecord): Promise<OfflineMediaRecord> {
  if (isStoredMedia(record)) {
    const bytes = await decryptBytes(key, record.encryptedBlob, record.environment, record.ownerUserId, mediaContext(record));
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    const { storageVersion: _storageVersion, encryptedBlob: _encryptedBlob, ...metadata } = record;
    return { ...metadata, blob: new Blob([buffer], { type: record.mimeType }) };
  }
  const bytes = new Uint8Array(await record.blob.arrayBuffer());
  const envelope = await encryptBytes(key, bytes, record.environment, record.ownerUserId, mediaContext(record));
  const { blob, ...metadata } = record;
  const migrated: StoredMediaRecord = { ...metadata, storageVersion: 2, encryptedBlob: envelope };
  await persistStoredMedia(db, migrated);
  return { ...record, blob };
}

export async function enqueueOffline(identity: StaffIdentity, kind: OfflineQueueKind, payload: unknown, eventId: string): Promise<OfflineQueueRecord> {
  const environment = environmentFor(identity);
  const namespace = storageNamespace(identity);
  const now = Date.now();
  const record: OfflineQueueRecord = {
    id: `${namespace}:${eventId}`,
    namespace,
    ownerUserId: identity.userId,
    environment,
    kind,
    payloadVersion: 1,
    payload,
    createdAt: now,
    updatedAt: now,
    attempts: 0,
    status: 'queued',
    lastError: null
  };
  const db = await openDb();
  try {
    const key = await getOrCreateStorageKey(db, identity);
    const encryptedPayload = await encryptPayload(key, payload, environment, identity.userId, 1, queueContext(record));
    const { payload: _payload, ...metadata } = record;
    const stored: StoredQueueRecord = { ...metadata, storageVersion: 2, encryptedPayload };
    await persistStoredQueue(db, stored);
    return record;
  } finally { db.close(); }
}

export async function listOfflineQueue(identity: StaffIdentity): Promise<OfflineQueueRecord[]> {
  const namespace = storageNamespace(identity);
  const db = await openDb();
  try {
    const transaction = db.transaction(QUEUE_STORE, 'readonly');
    const records = await requestValue(transaction.objectStore(QUEUE_STORE).index('namespace').getAll(namespace)) as QueueStorageRecord[];
    await txComplete(transaction);
    const owned = records.filter(record => record.ownerUserId === identity.userId && record.namespace === namespace).sort((a, b) => a.createdAt - b.createdAt);
    if (!owned.length) return [];
    const key = await getOrCreateStorageKey(db, identity);
    const output: OfflineQueueRecord[] = [];
    for (const record of owned) output.push(await decryptOrMigrateQueue(db, identity, key, record));
    return output;
  } finally { db.close(); }
}

export async function updateOfflineQueue(identity: StaffIdentity, id: string, patch: Partial<Pick<OfflineQueueRecord, 'status' | 'attempts' | 'lastError'>>): Promise<void> {
  const namespace = storageNamespace(identity);
  const db = await openDb();
  try {
    const transaction = db.transaction(QUEUE_STORE, 'readwrite');
    const store = transaction.objectStore(QUEUE_STORE);
    const record = await requestValue(store.get(id)) as QueueStorageRecord | undefined;
    if (!record || record.namespace !== namespace || record.ownerUserId !== identity.userId) {
      transaction.abort();
      throw new Error('Offline record ownership check failed.');
    }
    store.put({ ...record, ...patch, updatedAt: Date.now() });
    await txComplete(transaction);
  } finally { db.close(); }
}

export async function removeOfflineQueue(identity: StaffIdentity, id: string): Promise<void> {
  const namespace = storageNamespace(identity);
  const db = await openDb();
  try {
    const transaction = db.transaction(QUEUE_STORE, 'readwrite');
    const store = transaction.objectStore(QUEUE_STORE);
    const record = await requestValue(store.get(id)) as QueueStorageRecord | undefined;
    if (!record || record.namespace !== namespace || record.ownerUserId !== identity.userId) {
      transaction.abort();
      throw new Error('Offline record ownership check failed.');
    }
    store.delete(id);
    await txComplete(transaction);
  } finally { db.close(); }
}

export async function saveOfflineMedia(identity: StaffIdentity, record: Omit<OfflineMediaRecord, 'namespace' | 'ownerUserId' | 'environment'>): Promise<OfflineMediaRecord> {
  const environment = environmentFor(identity);
  const full: OfflineMediaRecord = { ...record, namespace: storageNamespace(identity), ownerUserId: identity.userId, environment };
  const db = await openDb();
  try {
    const key = await getOrCreateStorageKey(db, identity);
    const bytes = new Uint8Array(await record.blob.arrayBuffer());
    const encryptedBlob = await encryptBytes(key, bytes, environment, identity.userId, mediaContext(full));
    const { blob: _blob, ...metadata } = full;
    const stored: StoredMediaRecord = { ...metadata, storageVersion: 2, encryptedBlob };
    await persistStoredMedia(db, stored);
    return full;
  } finally { db.close(); }
}

export async function getOfflineMedia(identity: StaffIdentity, id: string): Promise<OfflineMediaRecord> {
  const namespace = storageNamespace(identity);
  const db = await openDb();
  try {
    const transaction = db.transaction(MEDIA_STORE, 'readonly');
    const record = await requestValue(transaction.objectStore(MEDIA_STORE).get(id)) as MediaStorageRecord | undefined;
    await txComplete(transaction);
    if (!record || record.namespace !== namespace || record.ownerUserId !== identity.userId) {
      throw new Error('Offline media ownership check failed.');
    }
    const key = await getOrCreateStorageKey(db, identity);
    return decryptOrMigrateMedia(db, identity, key, record);
  } finally { db.close(); }
}

export async function removeOfflineMedia(identity: StaffIdentity, id: string): Promise<void> {
  const namespace = storageNamespace(identity);
  const db = await openDb();
  try {
    const transaction = db.transaction(MEDIA_STORE, 'readwrite');
    const store = transaction.objectStore(MEDIA_STORE);
    const record = await requestValue(store.get(id)) as MediaStorageRecord | undefined;
    if (!record || record.namespace !== namespace || record.ownerUserId !== identity.userId) {
      transaction.abort();
      throw new Error('Offline media ownership check failed.');
    }
    store.delete(id);
    await txComplete(transaction);
  } finally { db.close(); }
}

export async function removeOfflineQueueAndMedia(identity: StaffIdentity, queueId: string, mediaId: string): Promise<void> {
  const namespace = storageNamespace(identity);
  const db = await openDb();
  try {
    const transaction = db.transaction([QUEUE_STORE, MEDIA_STORE], 'readwrite');
    const queue = transaction.objectStore(QUEUE_STORE);
    const media = transaction.objectStore(MEDIA_STORE);
    const queueRecord = await requestValue(queue.get(queueId)) as QueueStorageRecord | undefined;
    const mediaRecord = await requestValue(media.get(mediaId)) as MediaStorageRecord | undefined;
    if (!queueRecord || queueRecord.namespace !== namespace || queueRecord.ownerUserId !== identity.userId
      || !mediaRecord || mediaRecord.namespace !== namespace || mediaRecord.ownerUserId !== identity.userId) {
      transaction.abort();
      throw new Error('Offline queue/media ownership check failed.');
    }
    queue.delete(queueId);
    media.delete(mediaId);
    await txComplete(transaction);
  } finally { db.close(); }
}
