import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardList, Droplets, Eye, PackageSearch, RefreshCw, Send, Smartphone, Utensils, Wrench } from 'lucide-react';
import type { WorkerReportBasis, WorkerReportCategory, WorkerReportPayload, WorkerReportSeverity } from '../../api/reports';
import type { StaffIdentity } from '../../types/capabilities';
import { reportEventId, useWorkerReports } from './useWorkerReports';
import './reports.css';

const categories: Array<{ value: Exclude<WorkerReportCategory, 'TASK_EVIDENCE'>; label: string; icon: typeof Eye }> = [
  { value: 'OBSERVATION', label: 'Observation', icon: Eye }, { value: 'MORTALITY', label: 'Mortality', icon: AlertTriangle }, { value: 'FEED', label: 'Feed', icon: Utensils }, { value: 'WATER', label: 'Water', icon: Droplets }, { value: 'EQUIPMENT', label: 'Equipment', icon: Wrench }, { value: 'INVENTORY', label: 'Inventory', icon: PackageSearch }
];
interface Draft { eventId: string; category: Exclude<WorkerReportCategory, 'TASK_EVIDENCE'>; location: string; observedLocal: string; summary: string; severity: WorkerReportSeverity; hasQuantity: boolean; quantity: string; unit: string; basis: WorkerReportBasis; }
function localDateTimeValue() { const date = new Date(); const offset = date.getTimezoneOffset() * 60000; return new Date(date.getTime() - offset).toISOString().slice(0, 16); }
function newDraft(): Draft { return { eventId: reportEventId(), category: 'OBSERVATION', location: '', observedLocal: localDateTimeValue(), summary: '', severity: 'ROUTINE', hasQuantity: false, quantity: '', unit: '', basis: 'MEASURED' }; }
function categoryLabel(value: WorkerReportCategory) { return value.toLowerCase().replaceAll('_', ' '); }
function formatWhen(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }); }

export function ReportScreen({ identity }: { identity: StaffIdentity }) {
  const reports = useWorkerReports(identity);
  const [draft, setDraft] = useState<Draft>(() => newDraft());
  const mortality = draft.category === 'MORTALITY';
  const payload = useMemo<WorkerReportPayload | null>(() => {
    const observed = new Date(draft.observedLocal);
    if (!draft.location.trim() || !draft.summary.trim() || Number.isNaN(observed.getTime())) return null;
    const quantityEnabled = mortality || draft.hasQuantity;
    if (quantityEnabled && !draft.quantity.trim()) return null;
    const unit = mortality ? 'birds' : draft.unit.trim(); const basis: WorkerReportBasis = mortality ? 'COUNTED' : draft.basis;
    if (quantityEnabled && !unit) return null;
    return { event_id: draft.eventId, category: draft.category, task_id: null, entity_id: null, location: draft.location.trim(), observed_at: observed.toISOString(), summary: draft.summary.trim(), quantity: quantityEnabled ? draft.quantity.trim() : null, unit: quantityEnabled ? unit : null, basis: quantityEnabled ? basis : null, severity: draft.severity };
  }, [draft, mortality]);

  const submit = async () => { if (!payload) return; const result = await reports.submit(payload); if (result) setDraft(newDraft()); };

  return (
    <div className="screen-stack reports-screen">
      <section className="card hero"><div className="eyebrow">Report</div><h1>Report from the field</h1><p className="muted">Record what you observed. Chief stores this as human-reported evidence; receiving it does not automatically verify it or change Farm balances.</p><div className={`provenance-chip ${reports.provenance}`}>{reports.provenance === 'live' ? 'LIVE CHIEF REPORT HISTORY' : reports.provenance === 'mock_isolated' ? 'DEVELOPMENT FIXTURE' : 'CHIEF REPORT HISTORY UNAVAILABLE'}</div></section>

      {reports.lastReceipt && <section className="card report-receipt" role="status"><div className="row-title"><CheckCircle2 size={19} /><strong>Received by Chief</strong></div><p className="muted small-text">Report ID <span className="mono-inline">{reports.lastReceipt.report_id}</span> · {formatWhen(reports.lastReceipt.received_at)}</p><p className="muted small-text" style={{ marginBottom: 0 }}>Evidence status: human reported. This is a receipt, not verification.</p></section>}
      {reports.lastQueuedId && <section className="card report-receipt" role="status"><div className="row-title"><Smartphone size={19} /><strong>Stored on this device</strong></div><p className="muted small-text" style={{ marginBottom: 0 }}>Chief has not received this report yet. The exact event is durably queued under your authenticated identity and will remain distinct from a Chief receipt.</p></section>}
      {reports.submissionError && <section className="card report-error" role="alert"><div className="row-title"><AlertTriangle size={19} /><strong>Chief did not confirm receipt</strong></div><p className="muted small-text">{reports.submissionError.message}</p><p className="muted small-text" style={{ marginBottom: 0 }}>Your draft remains with the same submission ID for safe retry. No queue success is claimed unless durable device persistence completed.</p></section>}

      <section className="card report-form-card"><div className="section-heading"><ClipboardList size={19} /><strong>New field report</strong></div>
        <fieldset className="report-fieldset" disabled={reports.submitting || identity.isSimulated}><legend>What are you reporting?</legend>
          <div className="report-category-grid">{categories.map(item => { const Icon = item.icon; const active = draft.category === item.value; return <button key={item.value} type="button" className={`report-category ${active ? 'active' : ''}`} aria-pressed={active} onClick={() => setDraft(value => ({ ...value, category: item.value, hasQuantity: item.value === 'MORTALITY' ? true : value.hasQuantity, unit: item.value === 'MORTALITY' ? 'birds' : value.unit, basis: item.value === 'MORTALITY' ? 'COUNTED' : value.basis }))}><Icon size={20} /> {item.label}</button>; })}</div>
          <label className="report-label">Location<input value={draft.location} maxLength={120} autoComplete="off" placeholder="e.g. House 1" onChange={event => setDraft(value => ({ ...value, location: event.target.value }))} /><span>Use the location you actually observed. A free-text location does not create a canonical Farm entity.</span></label>
          <label className="report-label">When did you observe it?<input type="datetime-local" value={draft.observedLocal} onChange={event => setDraft(value => ({ ...value, observedLocal: event.target.value }))} /></label>
          <label className="report-label">What did you observe?<textarea value={draft.summary} maxLength={2000} rows={4} placeholder="Describe only what you saw, counted, measured, or were told to record." onChange={event => setDraft(value => ({ ...value, summary: event.target.value }))} /></label>
          <div className="report-label">Severity<div className="severity-row" role="group" aria-label="Report severity">{(['ROUTINE', 'IMPORTANT', 'URGENT'] as WorkerReportSeverity[]).map(severity => <button key={severity} type="button" className={`severity-button severity-${severity.toLowerCase()} ${draft.severity === severity ? 'active' : ''}`} aria-pressed={draft.severity === severity} onClick={() => setDraft(value => ({ ...value, severity }))}>{severity.toLowerCase()}</button>)}</div></div>
          {!mortality && <button type="button" className="quantity-toggle" aria-pressed={draft.hasQuantity} onClick={() => setDraft(value => ({ ...value, hasQuantity: !value.hasQuantity }))}>{draft.hasQuantity ? 'Remove quantity' : 'Add a measured / counted quantity'}</button>}
          {(mortality || draft.hasQuantity) && <div className="quantity-grid"><label className="report-label">Quantity<input inputMode="decimal" value={draft.quantity} placeholder={mortality ? '0' : 'e.g. 2.5'} onChange={event => setDraft(value => ({ ...value, quantity: event.target.value }))} /></label><label className="report-label">Unit<input value={mortality ? 'birds' : draft.unit} readOnly={mortality} maxLength={40} placeholder="kg, bags, litres…" onChange={event => setDraft(value => ({ ...value, unit: event.target.value }))} /></label><label className="report-label">Basis<select value={mortality ? 'COUNTED' : draft.basis} disabled={mortality} onChange={event => setDraft(value => ({ ...value, basis: event.target.value as WorkerReportBasis }))}><option value="MEASURED">Measured</option><option value="COUNTED">Counted</option><option value="ESTIMATED">Estimated</option></select></label></div>}
        </fieldset>
        {identity.isSimulated ? <div className="fixture-lock">Development report fixtures are read-only. No report can reach Chief from this simulated identity.</div> : <button type="button" className="primary-action report-submit" disabled={!payload || reports.submitting} onClick={() => void submit()}><Send size={19} /> {reports.submitting ? 'Sending to Chief…' : 'Send report to Chief'}</button>}
        <p className="muted small-text report-boundary">On transport failure, the exact report is queued only if IndexedDB persistence completes. “Stored on this device” is not “Received by Chief.”</p>
      </section>

      <section className="card"><div className="section-heading"><RefreshCw size={18} /><strong>Recent reports in your Chief scope</strong></div>{reports.data ? <><p className="muted small-text">{reports.data.notice}</p><div className="report-history">{reports.data.reports.length === 0 ? <p className="muted small-text">No worker reports are visible in your current authenticated scope.</p> : reports.data.reports.slice(0, 10).map(record => <article className="report-history-item" key={record.payload.event_id}><div className="report-history-top"><strong>{categoryLabel(record.payload.category)}</strong><span>{record.payload.severity.toLowerCase()}</span></div><div>{record.payload.location}</div><p>{record.payload.summary}</p><div className="report-history-meta">{reports.provenance === 'mock_isolated' ? 'Development fixture' : 'Human reported · received by Chief'} · {formatWhen(record.received_at)}</div></article>)}</div><button type="button" className="secondary-action" onClick={reports.refresh}><RefreshCw size={17} /> Refresh history</button></> : <p className="muted small-text">{reports.error?.message ?? 'Chief report history is unavailable.'}</p>}</section>
    </div>
  );
}
