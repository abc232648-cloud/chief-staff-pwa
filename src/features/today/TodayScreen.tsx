import { AlertTriangle, ClipboardCheck, RefreshCw } from 'lucide-react';
import type { StaffIdentity } from '../../types/capabilities';
import { useFarmBrief } from './useFarmBrief';
import type { ReportingStatus } from './types';

const reportingLabel: Record<ReportingStatus, string> = {
  REPORTED: 'Reported',
  REPORTED_LATE: 'Reported late',
  TIMEZONE_REVIEW_REQUIRED: 'Clock change: deadline needs review',
  MISSING: 'Missing',
  AWAITING: 'Awaiting'
};

function provenanceLabel(provenance: 'live' | 'cached' | 'mock_isolated' | 'unavailable') {
  if (provenance === 'live') return 'LIVE CHIEF DATA';
  if (provenance === 'mock_isolated') return 'DEVELOPMENT FIXTURE';
  if (provenance === 'cached') return 'CACHED CHIEF DATA';
  return 'CHIEF DATA UNAVAILABLE';
}

export function TodayScreen({ identity }: { identity: StaffIdentity }) {
  const brief = useFarmBrief(identity);
  const data = brief.data;
  const title = identity.role === 'worker'
    ? 'Your work for today'
    : identity.role === 'supervisor'
      ? 'Team operations'
      : 'Farm operations';

  if (!data) {
    return (
      <div className="screen-stack">
        <section className="card hero">
          <div className="eyebrow">Today</div>
          <h1>{title}</h1>
          <div className="provenance-chip unavailable">CHIEF DATA UNAVAILABLE</div>
          <p className="muted">
            {brief.error
              ? brief.error.message
              : 'Loading the authenticated Chief Farm brief. No placeholder operational totals are being substituted.'}
          </p>
          {brief.error && (
            <button className="secondary-action" type="button" onClick={brief.refresh}>
              <RefreshCw size={18} aria-hidden="true" /> Retry Chief
            </button>
          )}
        </section>
      </div>
    );
  }

  const missingReports = data.reporting.filter(item => item.status === 'MISSING').length;
  const awaitingReports = data.reporting.filter(item => item.status === 'AWAITING').length;
  const openWork = data.current_work.length;

  return (
    <div className="screen-stack">
      <section className="card hero">
        <div className="eyebrow">Today</div>
        <div className={`provenance-chip ${brief.provenance}`}>{provenanceLabel(brief.provenance)}</div>
        <h1>{title}</h1>
        <p className="muted">
          {brief.provenance === 'mock_isolated'
            ? 'Development preview only. No item below is authoritative Chief Farm state.'
            : `${data.date} · ${data.timezone} · Scope: ${data.scope === 'FARM' ? 'Farm' : 'My reports & assigned work'}`}
        </p>
        <div className="hero-grid">
          <div className="metric">
            <div className="metric-value">{data.reporting.length}</div>
            <div className="metric-label">Reporting requirements</div>
          </div>
          <div className="metric">
            <div className="metric-value">{openWork}</div>
            <div className="metric-label">Open work items</div>
          </div>
          <div className="metric">
            <div className="metric-value">{data.alerts.length}</div>
            <div className="metric-label">Current alerts</div>
          </div>
        </div>
      </section>

      {(missingReports > 0 || data.alerts.length > 0) && (
        <section className="card attention-card">
          <div className="eyebrow warning-eyebrow">Needs attention</div>
          <div className="placeholder-list">
            {data.alerts.slice(0, 5).map(alert => (
              <div className="placeholder-row" key={`${alert.type}:${alert.id}`}>
                <div className="row-title"><AlertTriangle size={17} aria-hidden="true" /> <strong>{alert.text}</strong></div>
                <div className="muted small-text">{alert.type.replaceAll('_', ' ')}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card">
        <div className="section-heading-row">
          <div>
            <div className="eyebrow">Reporting</div>
            <h2>Required today</h2>
          </div>
          <span className="status-pill">{missingReports} missing · {awaitingReports} awaiting</span>
        </div>
        {data.reporting.length === 0 ? (
          <p className="muted">No reporting requirements were returned for this authenticated scope. This does not imply that no farm work exists.</p>
        ) : (
          <div className="placeholder-list">
            {data.reporting.map(item => (
              <div className="placeholder-row" key={item.id}>
                <div className="row-title">
                  <strong>{item.location}</strong>
                  <span className={`report-status ${item.status.toLowerCase()}`}>{reportingLabel[item.status]}</span>
                </div>
                <p className="muted small-text" style={{ marginBottom: 0 }}>
                  {item.kind.replaceAll('_', ' ')} · Due {item.due_time} Lagos
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <div className="eyebrow">Current work</div>
        <h2>{identity.role === 'worker' ? 'Assigned to you' : 'Open operational work'}</h2>
        {data.current_work.length === 0 ? (
          <p className="muted">Chief returned no open work in this authenticated scope.</p>
        ) : (
          <div className="placeholder-list">
            {data.current_work.slice(0, 8).map(item => (
              <div className="placeholder-row" key={item.id}>
                <div className="row-title"><ClipboardCheck size={17} aria-hidden="true" /> <strong>{item.text}</strong></div>
                <p className="muted small-text" style={{ marginBottom: 0 }}>
                  {item.kind} · {item.state}{item.overdue ? ' · OVERDUE' : ''}{item.due_at ? ` · Due ${item.due_at}` : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {data.metrics.length > 0 && (
        <section className="card">
          <div className="eyebrow">Recorded observations</div>
          <h2>Today's submitted quantities</h2>
          <p className="muted small-text">Recorded observations are not automatically verified full-day totals.</p>
          <div className="placeholder-list">
            {data.metrics.slice(0, 8).map((metric, index) => (
              <div className="placeholder-row" key={`${metric.entity_id ?? metric.location}:${metric.kind}:${index}`}>
                <div className="row-title"><strong>{metric.location}</strong><span>{metric.quantity} {metric.unit}</span></div>
                <p className="muted small-text" style={{ marginBottom: 0 }}>
                  {metric.kind.replaceAll('_', ' ')} · {metric.reports} report{metric.reports === 1 ? '' : 's'}{metric.contains_estimates ? ' · contains estimates' : ''}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card truth-note">
        <strong>Chief data note</strong>
        <p className="muted small-text" style={{ marginBottom: 0 }}>{data.notice}</p>
      </section>
    </div>
  );
}
