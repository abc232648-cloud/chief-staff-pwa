import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, Send, ShieldAlert } from 'lucide-react';
import {
  getIncidents,
  mutateIncident,
  type IncidentCreatePayload,
  type IncidentOverview,
  type IncidentReceipt,
  type IncidentSeverity
} from '../../api/incidents';
import { ChiefApiError } from '../../api/types';
import type { StaffIdentity } from '../../types/capabilities';
import { hasCapability } from '../../types/capabilities';
import './incidents.css';

function eventId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `incident_${Date.now()}_${Math.random().toString(36).slice(2, 14)}`;
}

function localDateTimeValue() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

interface Draft {
  eventId: string;
  kind: 'INCIDENT' | 'EMERGENCY';
  category: string;
  location: string;
  observedLocal: string;
  summary: string;
  severity: IncidentSeverity;
  immediateRisk: boolean;
}

function freshDraft(kind: Draft['kind'] = 'INCIDENT'): Draft {
  return {
    eventId: eventId(),
    kind,
    category: '',
    location: '',
    observedLocal: localDateTimeValue(),
    summary: '',
    severity: kind === 'EMERGENCY' ? 'CRITICAL' : 'IMPORTANT',
    immediateRisk: kind === 'EMERGENCY'
  };
}

export function IncidentEmergencyPanel({ identity }: { identity: StaffIdentity }) {
  const [draft, setDraft] = useState<Draft>(() => freshDraft());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ChiefApiError | null>(null);
  const [receipt, setReceipt] = useState<IncidentReceipt | null>(null);
  const [overview, setOverview] = useState<IncidentOverview | null>(null);
  const [loading, setLoading] = useState(false);

  const canCreateIncident = hasCapability(identity, 'incidents.create');
  const canCreateEmergency = hasCapability(identity, 'emergencies.create');
  const canReview = hasCapability(identity, 'incidents.classify.scoped') || hasCapability(identity, 'incidents.manage.farm');

  const refresh = useCallback(async () => {
    if (identity.isSimulated || !canReview) {
      setOverview(null);
      return;
    }
    setLoading(true);
    try {
      const response = await getIncidents();
      setOverview(response.data);
    } catch {
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }, [canReview, identity.isSimulated]);

  useEffect(() => { void refresh(); }, [refresh]);

  const payload = useMemo<IncidentCreatePayload | null>(() => {
    const observed = new Date(draft.observedLocal);
    if (!draft.category.trim() || !draft.location.trim() || !draft.summary.trim() || Number.isNaN(observed.getTime())) return null;
    if (draft.kind === 'INCIDENT' && !canCreateIncident) return null;
    if (draft.kind === 'EMERGENCY' && !canCreateEmergency) return null;
    return {
      event_id: draft.eventId,
      operation: 'CREATE',
      kind: draft.kind,
      category: draft.category.trim(),
      location: draft.location.trim(),
      observed_at: observed.toISOString(),
      summary: draft.summary.trim(),
      severity: draft.kind === 'EMERGENCY' ? 'CRITICAL' : draft.severity,
      immediate_risk: draft.kind === 'EMERGENCY' ? true : draft.immediateRisk
    };
  }, [canCreateEmergency, canCreateIncident, draft]);

  const submit = async () => {
    if (!payload || identity.isSimulated) return;
    setSubmitting(true);
    setError(null);
    setReceipt(null);
    try {
      const response = await mutateIncident(payload);
      const result = response.data;
      if (!['RECEIVED', 'ALREADY_RECEIVED', 'RECORDED', 'ALREADY_RECORDED'].includes(result.status) || !result.incident_id || !result.revision) {
        throw new ChiefApiError({
          message: 'Chief response did not confirm a valid incident receipt.',
          origin: 'protocol',
          code: 'UNCONFIRMED_INCIDENT_RECEIPT',
          details: result
        });
      }
      setReceipt(result);
      setDraft(freshDraft(draft.kind));
      void refresh();
    } catch (cause) {
      setError(cause instanceof ChiefApiError ? cause : new ChiefApiError({
        message: 'Incident submission failed before Chief confirmed receipt.',
        origin: 'protocol',
        code: 'UNKNOWN_INCIDENT_SUBMISSION_ERROR',
        details: cause
      }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="card incident-panel" aria-labelledby="incident-heading">
      <div className="incident-heading-row">
        <div>
          <div className="eyebrow critical-text">Incident & emergency</div>
          <h2 id="incident-heading">Escalate field risk to Chief</h2>
        </div>
        <ShieldAlert size={24} aria-hidden="true" />
      </div>
      <p className="muted small-text">This surface reports evidence to Chief. It does not create a STOP, bypass policy, or prove that anyone has received an external notification.</p>

      {receipt && (
        <div className="incident-receipt" role="status">
          <CheckCircle2 size={18} aria-hidden="true" />
          <div><strong>Received by Chief</strong><span>Incident {receipt.incident_id}. Receipt confirmed; downstream routing is not inferred by this PWA.</span></div>
        </div>
      )}

      {error && (
        <div className="incident-error" role="alert">
          <AlertTriangle size={18} aria-hidden="true" />
          <div><strong>Chief did not confirm receipt</strong><span>{error.message} The same event ID remains in this draft for safe retry.</span></div>
        </div>
      )}

      <div className="incident-kind" role="group" aria-label="Incident type">
        <button type="button" aria-pressed={draft.kind === 'INCIDENT'} disabled={!canCreateIncident || submitting} onClick={() => setDraft(freshDraft('INCIDENT'))}>Incident</button>
        <button type="button" className="emergency-choice" aria-pressed={draft.kind === 'EMERGENCY'} disabled={!canCreateEmergency || submitting} onClick={() => setDraft(freshDraft('EMERGENCY'))}><ShieldAlert size={17} /> Emergency</button>
      </div>

      {identity.isSimulated ? (
        <div className="fixture-lock">Development identities cannot submit incidents or emergencies to Chief.</div>
      ) : (
        <fieldset className="incident-form" disabled={submitting}>
          <label>Category<input value={draft.category} maxLength={80} placeholder="e.g. water outage, injury, disease concern" onChange={event => setDraft(value => ({ ...value, category: event.target.value }))} /></label>
          <label>Location<input value={draft.location} maxLength={120} placeholder="Where did this happen?" onChange={event => setDraft(value => ({ ...value, location: event.target.value }))} /><span>Free text does not create a canonical Farm entity.</span></label>
          <label>Observed at<input type="datetime-local" value={draft.observedLocal} onChange={event => setDraft(value => ({ ...value, observedLocal: event.target.value }))} /></label>
          <label>What happened?<textarea rows={4} maxLength={2400} value={draft.summary} placeholder="State only what you observed or were directly told." onChange={event => setDraft(value => ({ ...value, summary: event.target.value }))} /></label>
          {draft.kind === 'INCIDENT' && (
            <>
              <label>Severity<select value={draft.severity} onChange={event => setDraft(value => ({ ...value, severity: event.target.value as IncidentSeverity }))}><option value="IMPORTANT">Important</option><option value="URGENT">Urgent</option><option value="CRITICAL">Critical</option></select></label>
              <label className="incident-check"><input type="checkbox" checked={draft.immediateRisk} onChange={event => setDraft(value => ({ ...value, immediateRisk: event.target.checked }))} /> Immediate safety/operational risk is still present</label>
            </>
          )}
        </fieldset>
      )}

      {!identity.isSimulated && (
        <button type="button" className={draft.kind === 'EMERGENCY' ? 'critical-action incident-submit' : 'primary-action incident-submit'} disabled={!payload || submitting} onClick={() => void submit()}>
          <Send size={18} aria-hidden="true" /> {submitting ? 'Sending to Chief…' : draft.kind === 'EMERGENCY' ? 'Report emergency to Chief' : 'Report incident to Chief'}
        </button>
      )}

      <p className="muted tiny-text incident-boundary">Until S12 durable offline queueing is installed, a network failure is not called queued or delivered. Keep this screen open and retry when connectivity returns.</p>

      {canReview && (
        <div className="incident-review">
          <div className="section-heading"><strong>Incidents in your Chief scope</strong><button type="button" className="icon-button" onClick={() => void refresh()} disabled={loading} aria-label="Refresh incidents"><RefreshCw size={17} /></button></div>
          {overview ? (
            <>
              <p className="muted tiny-text">{overview.notice}</p>
              {overview.incidents.length === 0 ? <p className="muted small-text">Chief returned no incidents in your current scope.</p> : overview.incidents.slice(0, 8).map(item => (
                <article className={`incident-item ${item.kind === 'EMERGENCY' ? 'emergency' : ''}`} key={item.incident_id}>
                  <div><strong>{item.category}</strong><span>{item.kind.toLowerCase()} · {item.severity.toLowerCase()}</span></div>
                  <p>{item.summary}</p>
                  <small>{item.location} · {item.status}</small>
                </article>
              ))}
            </>
          ) : <p className="muted small-text">{loading ? 'Loading Chief incident state…' : 'Chief incident state is unavailable. No local incident state is substituted.'}</p>}
        </div>
      )}
    </section>
  );
}
