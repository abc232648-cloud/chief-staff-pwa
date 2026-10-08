import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { mutateIncident, type IncidentMutation } from '../api/incidents';
import { blobSha256, blobToBase64, getFarmPhotos, uploadFarmPhoto } from '../api/media';
import { submitWorkerReport, type WorkerReportPayload } from '../api/reports';
import { ChiefApiError } from '../api/types';
import { useAuth, type AuthenticatedStaffIdentity } from '../auth/AuthContext';
import {
  enqueueOffline,
  getOfflineMedia,
  listOfflineQueue,
  removeOfflineMedia,
  removeOfflineQueue,
  removeOfflineQueueAndMedia,
  saveOfflineMedia,
  updateOfflineQueue,
  type OfflineQueueKind,
  type OfflineQueueRecord
} from '../storage/offlineStore';

interface QueuedMediaPayload {
  event_id: string;
  work_id: string;
  media_id: string;
  sha256: string;
  bytes: number;
}

interface ReplayResult {
  mediaId?: string;
}

interface OfflineQueueValue {
  records: OfflineQueueRecord[];
  storageError: string | null;
  syncing: boolean;
  enqueue: (kind: OfflineQueueKind, payload: unknown, eventId: string) => Promise<OfflineQueueRecord | null>;
  enqueueMedia: (workId: string, png: Blob) => Promise<OfflineQueueRecord | null>;
  refresh: () => Promise<void>;
  syncNow: () => Promise<void>;
}

const OfflineQueueContext = createContext<OfflineQueueValue | null>(null);

function queuedMediaPayload(value: unknown): QueuedMediaPayload {
  if (!value || typeof value !== 'object') {
    throw new ChiefApiError({ message: 'Queued media payload is invalid.', origin: 'protocol', code: 'INVALID_QUEUED_MEDIA' });
  }
  const payload = value as Partial<QueuedMediaPayload>;
  if (!payload.event_id || !payload.work_id || !payload.media_id || !payload.sha256 || typeof payload.bytes !== 'number') {
    throw new ChiefApiError({ message: 'Queued media payload is incomplete.', origin: 'protocol', code: 'INVALID_QUEUED_MEDIA' });
  }
  return payload as QueuedMediaPayload;
}

function photoMetadataMatches(value: { id: string; work_id: string; sha256: string; bytes: number }, payload: QueuedMediaPayload): boolean {
  return value.id === payload.event_id
    && value.work_id === payload.work_id
    && value.sha256 === payload.sha256
    && value.bytes === payload.bytes;
}

async function replay(record: OfflineQueueRecord, identity: AuthenticatedStaffIdentity): Promise<ReplayResult> {
  if (record.kind === 'worker_report') {
    const response = await submitWorkerReport(record.payload as WorkerReportPayload);
    const receipt = response.data;
    if (!['RECEIVED', 'ALREADY_RECEIVED'].includes(receipt.status) || receipt.evidence_status !== 'HUMAN_REPORTED' || !receipt.report_id) {
      throw new ChiefApiError({ message: 'Chief did not confirm a valid queued report receipt.', origin: 'protocol', code: 'UNCONFIRMED_QUEUED_REPORT', details: receipt });
    }
    return {};
  }
  if (record.kind === 'incident') {
    const response = await mutateIncident(record.payload as IncidentMutation);
    const receipt = response.data;
    if (!['RECEIVED', 'ALREADY_RECEIVED', 'RECORDED', 'ALREADY_RECORDED'].includes(receipt.status) || !receipt.incident_id || !receipt.revision) {
      throw new ChiefApiError({ message: 'Chief did not confirm a valid queued incident receipt.', origin: 'protocol', code: 'UNCONFIRMED_QUEUED_INCIDENT', details: receipt });
    }
    return {};
  }

  const payload = queuedMediaPayload(record.payload);
  const media = await getOfflineMedia(identity, payload.media_id);
  if (media.workId !== payload.work_id || media.sha256 !== payload.sha256 || media.bytes !== payload.bytes || media.mimeType !== 'image/png') {
    throw new ChiefApiError({ message: 'Queued media metadata conflicts with its persisted device record.', origin: 'protocol', code: 'QUEUED_MEDIA_METADATA_CONFLICT' });
  }
  const digest = await blobSha256(media.blob);
  if (digest !== payload.sha256 || media.blob.size !== payload.bytes) {
    throw new ChiefApiError({ message: 'Queued media bytes no longer match the persisted integrity metadata.', origin: 'protocol', code: 'QUEUED_MEDIA_INTEGRITY_CONFLICT' });
  }

  const response = await uploadFarmPhoto({
    event_id: payload.event_id,
    work_id: payload.work_id,
    image_base64: await blobToBase64(media.blob)
  });
  const receipt = response.data;
  if (!['RECORDED', 'ALREADY_RECORDED'].includes(receipt.status) || !photoMetadataMatches(receipt.record, payload)) {
    throw new ChiefApiError({ message: 'Chief photo receipt does not match the queued media evidence.', origin: 'protocol', code: 'UNCONFIRMED_QUEUED_MEDIA', details: receipt });
  }

  const listing = (await getFarmPhotos(payload.work_id)).data;
  const authoritative = listing.find(item => item.id === payload.event_id);
  if (!authoritative) {
    throw new ChiefApiError({ message: 'Chief accepted the photo but its authoritative listing has not reconciled yet.', origin: 'protocol', code: 'MEDIA_RECONCILIATION_PENDING' });
  }
  if (!photoMetadataMatches(authoritative, payload)) {
    throw new ChiefApiError({ message: 'Chief authoritative photo metadata conflicts with the queued media evidence.', origin: 'protocol', code: 'MEDIA_RECONCILIATION_CONFLICT', details: authoritative });
  }
  return { mediaId: payload.media_id };
}

function mediaEventId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `photo_${Date.now()}_${Math.random().toString(36).slice(2, 14)}`;
}

export function OfflineQueueProvider({ children }: { children: ReactNode }) {
  const { identity } = useAuth();
  const [records, setRecords] = useState<OfflineQueueRecord[]>([]);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    if (!identity || identity.isSimulated) {
      setRecords([]);
      setStorageError(null);
      return;
    }
    try {
      setRecords(await listOfflineQueue(identity));
      setStorageError(null);
    } catch (cause) {
      setRecords([]);
      setStorageError(cause instanceof Error ? cause.message : 'Local queue could not be read.');
    }
  }, [identity]);

  useEffect(() => { void refresh(); }, [refresh]);

  const enqueue = useCallback(async (kind: OfflineQueueKind, payload: unknown, eventId: string) => {
    if (!identity || identity.isSimulated) return null;
    try {
      const record = await enqueueOffline(identity, kind, payload, eventId);
      await refresh();
      return record;
    } catch (cause) {
      setStorageError(cause instanceof Error ? cause.message : 'Local persistence failed.');
      return null;
    }
  }, [identity, refresh]);

  const enqueueMedia = useCallback(async (workId: string, png: Blob) => {
    if (!identity || identity.isSimulated) return null;
    if (png.type !== 'image/png' || png.size <= 0 || png.size > 2 * 1024 * 1024) {
      setStorageError('Photo evidence must be a non-empty PNG no larger than 2 MiB after device conversion.');
      return null;
    }
    const eventId = mediaEventId();
    const mediaId = eventId;
    let persisted = false;
    try {
      const sha256 = await blobSha256(png);
      await saveOfflineMedia(identity, {
        id: mediaId,
        blob: png,
        mimeType: 'image/png',
        createdAt: Date.now(),
        purpose: 'task_photo',
        workId,
        sha256,
        bytes: png.size
      });
      persisted = true;
      const record = await enqueueOffline(identity, 'media_upload', {
        event_id: eventId,
        work_id: workId,
        media_id: mediaId,
        sha256,
        bytes: png.size
      } satisfies QueuedMediaPayload, eventId);
      await refresh();
      return record;
    } catch (cause) {
      if (persisted) {
        try { await removeOfflineMedia(identity, mediaId); } catch { /* preserve original storage error */ }
      }
      setStorageError(cause instanceof Error ? cause.message : 'Photo evidence could not be durably queued.');
      return null;
    }
  }, [identity, refresh]);

  const syncNow = useCallback(async () => {
    if (!identity || identity.isSimulated || typeof navigator === 'undefined' || !navigator.onLine || syncing) return;
    setSyncing(true);
    try {
      const current = await listOfflineQueue(identity);
      for (const record of current) {
        if (record.status === 'needs_attention') continue;
        await updateOfflineQueue(identity, record.id, { status: 'syncing', attempts: record.attempts + 1, lastError: null });
        try {
          const result = await replay(record, identity);
          if (result.mediaId) await removeOfflineQueueAndMedia(identity, record.id, result.mediaId);
          else await removeOfflineQueue(identity, record.id);
        } catch (cause) {
          const error = cause instanceof ChiefApiError ? cause : new ChiefApiError({ message: 'Queued operation replay failed.', origin: 'protocol', code: 'UNKNOWN_QUEUE_REPLAY_ERROR', details: cause });
          const retryable = error.origin === 'transport' || error.code === 'MEDIA_RECONCILIATION_PENDING';
          await updateOfflineQueue(identity, record.id, { status: retryable ? 'queued' : 'needs_attention', lastError: error.message });
          if (retryable) break;
        }
      }
      await refresh();
    } catch (cause) {
      setStorageError(cause instanceof Error ? cause.message : 'Queue synchronization failed.');
    } finally {
      setSyncing(false);
    }
  }, [identity, refresh, syncing]);

  useEffect(() => {
    const online = () => { void syncNow(); };
    window.addEventListener('online', online);
    return () => window.removeEventListener('online', online);
  }, [syncNow]);

  const value = useMemo<OfflineQueueValue>(() => ({ records, storageError, syncing, enqueue, enqueueMedia, refresh, syncNow }), [records, storageError, syncing, enqueue, enqueueMedia, refresh, syncNow]);
  return <OfflineQueueContext.Provider value={value}>{children}</OfflineQueueContext.Provider>;
}

export function useOfflineQueue(): OfflineQueueValue {
  const value = useContext(OfflineQueueContext);
  if (!value) throw new Error('useOfflineQueue must be used within OfflineQueueProvider');
  return value;
}
