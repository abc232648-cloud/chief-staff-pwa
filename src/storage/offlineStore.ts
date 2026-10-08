import { isChiefStaffDevMode } from '../config/devMode';
import type { StaffIdentity } from '../types/capabilities';

const DB_NAME = 'chief_staff_pwa';
const DB_VERSION = 1;
const QUEUE_STORE = 'queue';
const MEDIA_STORE = 'media';

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

export function storageNamespace(identity: StaffIdentity): string {
  const environment = isChiefStaffDevMode() ? 'dev' : 'prod';
  return `${environment}:${identity.userId}`;
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

export async function enqueueOffline(identity: StaffIdentity, kind: OfflineQueueKind, payload: unknown, eventId: string): Promise<OfflineQueueRecord> {
  const environment = isChiefStaffDevMode() ? 'dev' : 'prod';
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
    const transaction = db.transaction(QUEUE_STORE, 'readwrite');
    transaction.objectStore(QUEUE_STORE).put(record);
    await txComplete(transaction);
    return record;
  } finally { db.close(); }
}

export async function listOfflineQueue(identity: StaffIdentity): Promise<OfflineQueueRecord[]> {
  const namespace = storageNamespace(identity);
  const db = await openDb();
  try {
    const transaction = db.transaction(QUEUE_STORE, 'readonly');
    const records = await requestValue(transaction.objectStore(QUEUE_STORE).index('namespace').getAll(namespace)) as OfflineQueueRecord[];
    await txComplete(transaction);
    return records.filter(record => record.ownerUserId === identity.userId && record.namespace === namespace).sort((a, b) => a.createdAt - b.createdAt);
  } finally { db.close(); }
}

export async function updateOfflineQueue(identity: StaffIdentity, id: string, patch: Partial<Pick<OfflineQueueRecord, 'status' | 'attempts' | 'lastError'>>): Promise<void> {
  const namespace = storageNamespace(identity);
  const db = await openDb();
  try {
    const transaction = db.transaction(QUEUE_STORE, 'readwrite');
    const store = transaction.objectStore(QUEUE_STORE);
    const record = await requestValue(store.get(id)) as OfflineQueueRecord | undefined;
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
    const record = await requestValue(store.get(id)) as OfflineQueueRecord | undefined;
    if (!record || record.namespace !== namespace || record.ownerUserId !== identity.userId) {
      transaction.abort();
      throw new Error('Offline record ownership check failed.');
    }
    store.delete(id);
    await txComplete(transaction);
  } finally { db.close(); }
}

export async function saveOfflineMedia(identity: StaffIdentity, record: Omit<OfflineMediaRecord, 'namespace' | 'ownerUserId' | 'environment'>): Promise<OfflineMediaRecord> {
  const environment = isChiefStaffDevMode() ? 'dev' : 'prod';
  const full: OfflineMediaRecord = { ...record, namespace: storageNamespace(identity), ownerUserId: identity.userId, environment };
  const db = await openDb();
  try {
    const transaction = db.transaction(MEDIA_STORE, 'readwrite');
    transaction.objectStore(MEDIA_STORE).put(full);
    await txComplete(transaction);
    return full;
  } finally { db.close(); }
}

export async function getOfflineMedia(identity: StaffIdentity, id: string): Promise<OfflineMediaRecord> {
  const namespace = storageNamespace(identity);
  const db = await openDb();
  try {
    const transaction = db.transaction(MEDIA_STORE, 'readonly');
    const record = await requestValue(transaction.objectStore(MEDIA_STORE).get(id)) as OfflineMediaRecord | undefined;
    await txComplete(transaction);
    if (!record || record.namespace !== namespace || record.ownerUserId !== identity.userId) {
      throw new Error('Offline media ownership check failed.');
    }
    return record;
  } finally { db.close(); }
}

export async function removeOfflineMedia(identity: StaffIdentity, id: string): Promise<void> {
  const namespace = storageNamespace(identity);
  const db = await openDb();
  try {
    const transaction = db.transaction(MEDIA_STORE, 'readwrite');
    const store = transaction.objectStore(MEDIA_STORE);
    const record = await requestValue(store.get(id)) as OfflineMediaRecord | undefined;
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
    const queueRecord = await requestValue(queue.get(queueId)) as OfflineQueueRecord | undefined;
    const mediaRecord = await requestValue(media.get(mediaId)) as OfflineMediaRecord | undefined;
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
