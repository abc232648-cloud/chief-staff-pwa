import { AlertTriangle, CloudOff, RefreshCw, Smartphone } from 'lucide-react';
import { useOfflineQueue } from '../../offline/OfflineQueueContext';
import './offline.css';

export function OfflineQueuePanel() {
  const { records, storageError, syncing, refresh, syncNow } = useOfflineQueue();
  return (
    <section className="card offline-panel">
      <div className="offline-heading"><div><div className="eyebrow">Offline</div><h2>Device queue</h2></div><Smartphone size={23} /></div>
      <p className="muted small-text">Device persistence is not Chief receipt. Queued records stay bound to the authenticated user and environment that created them.</p>
      <div className="offline-actions">
        <button type="button" className="secondary-action" onClick={() => void refresh()}><RefreshCw size={17} /> Refresh device</button>
        <button type="button" className="primary-action" disabled={syncing || records.length === 0 || !navigator.onLine} onClick={() => void syncNow()}>{syncing ? 'Synchronizing…' : 'Send queued to Chief'}</button>
      </div>
      {storageError && <div className="offline-error" role="alert"><AlertTriangle size={17} /><span>{storageError} No local-save success is being claimed.</span></div>}
      {records.length === 0 ? <div className="offline-empty"><CloudOff size={18} /><span>No queued records for this authenticated identity.</span></div> : (
        <div className="offline-list">{records.map(record => (
          <article key={record.id} className={`offline-record ${record.status}`}>
            <div><strong>{record.kind.replaceAll('_', ' ')}</strong><span>{record.status.replaceAll('_', ' ')}</span></div>
            <small>Stored {new Date(record.createdAt).toLocaleString()} · attempts {record.attempts}</small>
            {record.lastError && <p>{record.lastError}</p>}
          </article>
        ))}</div>
      )}
      <p className="muted tiny-text">Task state-changing commands remain live-only because their expected Chief revision may change while the device is offline. Queued photos are deleted only after Chief’s independent work-photo listing confirms the exact photo ID, work ID, SHA-256 and byte count.</p>
    </section>
  );
}
