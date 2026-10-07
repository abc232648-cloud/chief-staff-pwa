import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, BookOpenCheck, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { getAssignedSops, type AssignedSopOverview } from '../../api/sops';
import { ChiefApiError, type DataProvenance } from '../../api/types';
import type { StaffIdentity } from '../../types/capabilities';
import { hasCapability } from '../../types/capabilities';
import './sops.css';

const DEV_SOPS: AssignedSopOverview = {
  sops: [{
    sop_id: 'dev-sop-water-check',
    version: 'DEV-1',
    title: 'Development fixture — poultry water-line inspection',
    purpose: 'Layout fixture only. This is not an instruction issued by Chief.',
    steps: ['Fixture step: inspect tank level.', 'Fixture step: walk the line.', 'Fixture step: record any visible leak.'],
    warnings: ['Development fixture only — do not treat this text as an operational SOP.'],
    updated_at: '2026-10-07T00:00:00Z'
  }],
  total: 1,
  notice: 'Development fixture only. No SOP shown here is Chief-assigned guidance.'
};

export function SopPanel({ identity }: { identity: StaffIdentity }) {
  const [data, setData] = useState<AssignedSopOverview | null>(() => identity.isSimulated ? DEV_SOPS : null);
  const [provenance, setProvenance] = useState<DataProvenance>(() => identity.isSimulated ? 'mock_isolated' : 'unavailable');
  const [error, setError] = useState<ChiefApiError | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const allowed = hasCapability(identity, 'sops.read.assigned');

  const refresh = useCallback(async () => {
    if (!allowed) {
      setData(null);
      setProvenance('unavailable');
      return;
    }
    if (identity.isSimulated) {
      setData(DEV_SOPS);
      setProvenance('mock_isolated');
      setError(null);
      return;
    }
    setError(null);
    try {
      const response = await getAssignedSops();
      setData(response.data);
      setProvenance(response.provenance);
    } catch (cause) {
      setData(null);
      setProvenance('unavailable');
      setError(cause instanceof ChiefApiError ? cause : new ChiefApiError({ message: 'Assigned SOP data could not be interpreted.', origin: 'protocol', code: 'UNKNOWN_SOP_ERROR', details: cause }));
    }
  }, [allowed, identity.isSimulated]);

  useEffect(() => { void refresh(); }, [refresh, identity.userId]);

  if (!allowed) return null;

  return (
    <section className="card sop-panel">
      <div className="sop-heading">
        <div><div className="eyebrow">SOP / runbook</div><h2>Assigned field procedures</h2></div>
        <BookOpenCheck size={24} aria-hidden="true" />
      </div>
      <div className={`provenance-chip ${provenance}`}>{provenance === 'live' ? 'LIVE CHIEF SOP DATA' : provenance === 'mock_isolated' ? 'DEVELOPMENT FIXTURE' : 'CHIEF SOP DATA UNAVAILABLE'}</div>
      <p className="muted small-text">Use only the version Chief assigned to your authenticated scope. A displayed SOP does not grant additional task or policy authority.</p>

      {!data ? (
        <div className="sop-unavailable">
          <AlertTriangle size={18} /><div><strong>Assigned procedures unavailable</strong><span>{error?.message ?? 'Chief did not return assigned SOP content.'}</span></div>
          <button type="button" className="secondary-action" onClick={() => void refresh()}><RefreshCw size={17} /> Retry</button>
        </div>
      ) : (
        <>
          <p className="muted tiny-text">{data.notice}</p>
          <div className="sop-list">
            {data.sops.length === 0 ? <p className="muted small-text">No SOPs were returned in your current Chief scope.</p> : data.sops.map(sop => {
              const open = openId === sop.sop_id;
              return (
                <article className="sop-item" key={`${sop.sop_id}:${sop.version}`}>
                  <button type="button" className="sop-toggle" aria-expanded={open} onClick={() => setOpenId(open ? null : sop.sop_id)}>
                    <span><strong>{sop.title}</strong><small>{sop.sop_id} · version {sop.version}</small></span>
                    {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                  {open && (
                    <div className="sop-body">
                      <p>{sop.purpose}</p>
                      {sop.warnings.length > 0 && <div className="sop-warnings">{sop.warnings.map((warning, index) => <div key={index}><AlertTriangle size={15} /> {warning}</div>)}</div>}
                      <ol>{sop.steps.map((step, index) => <li key={index}>{step}</li>)}</ol>
                      <small>Version {sop.version} · updated {sop.updated_at}</small>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
