import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { mutateIncident, type IncidentMutation } from '../api/incidents';
import { submitWorkerReport, type WorkerReportPayload } from '../api/reports';
import { ChiefApiError } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import {
  enqueueOffline,
  listOfflineQueue,
  removeOfflineQueue,
  updateOfflineQueue,
  type OfflineQueueKind,
  type OfflineQueueRecord
} from '../storage/offlineStore';

interface OfflineQueueValue {
  records: OfflineQueueRecord[];
  storageError: string | null;
  syncing: boolean;
  enqueue: (kind: OfflineQueueKind, payload: unknown, eventId: string) => Promise<OfflineQueueRecord | null>;
  refresh: () => Promise<void>;
  syncNow: () => Promise<void>;
}

const OfflineQueueContext = createContext<OfflineQueueValue | null>(null);

async function replay(record: OfflineQueueRecord): Promise<void> {
  if (record.kind === 'worker_report') {
    const response = await submitWorkerReport(record.payload as WorkerReportPayload);
    const receipt = response.data;
    if (!['RECEIVED', 'ALREADY_RECEIVED'].includes(receipt.status) || receipt.evidence_status !== 'HUMAN_REPORTED' || !receipt.report_id) {
      throw new ChiefApiError({ message: 'Chief did not confirm a valid queued report receipt.', origin: 'protocol', code: 'UNCONFIRMED_QUEUED_REPORT', details: receipt });
    }
    return;
  }
  if (record.kind === 'incident') {
    const response = await mutateIncident(record.payload as IncidentMutation);
    const receipt = response.data;
    if (!['RECEIVED', 'ALREADY_RECEIVED', 'RECORDED', 'ALREADY_RECORDED'].includes(receipt.status) || !receipt.incident_id || !receipt.revision) {
      throw new ChiefApiError({ message: 'Chief did not confirm a valid queued incident receipt.', origin: 'protocol', code: 'UNCONFIRMED_QUEUED_INCIDENT', details: receipt });
    }
    return;
  }
  throw new ChiefApiError({ message: 'Queued media needs the Chief media-upload adapter before it can synchronize.', origin: 'client', code: 'MEDIA_REPLAY_UNSUPPORTED' });
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

  const syncNow = useCallback(async () => {
    if (!identity || identity.isSimulated || typeof navigator === 'undefined' || !navigator.onLine || syncing) return;
    setSyncing(true);
    try {
      const current = await listOfflineQueue(identity);
      for (const record of current) {
        if (record.status === 'needs_attention') continue;
        await updateOfflineQueue(identity, record.id, { status: 'syncing', attempts: record.attempts + 1, lastError: null });
        try {
          await replay(record);
          await removeOfflineQueue(identity, record.id);
        } catch (cause) {
          const error = cause instanceof ChiefApiError ? cause : new ChiefApiError({ message: 'Queued operation replay failed.', origin: 'protocol', code: 'UNKNOWN_QUEUE_REPLAY_ERROR', details: cause });
          const retryable = error.origin === 'transport';
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

  const value = useMemo<OfflineQueueValue>(() => ({ records, storageError, syncing, enqueue, refresh, syncNow }), [records, storageError, syncing, enqueue, refresh, syncNow]);
  return <OfflineQueueContext.Provider value={value}>{children}</OfflineQueueContext.Provider>;
}

export function useOfflineQueue(): OfflineQueueValue {
  const value = useContext(OfflineQueueContext);
  if (!value) throw new Error('useOfflineQueue must be used within OfflineQueueProvider');
  return value;
}
