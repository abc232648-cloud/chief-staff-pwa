import { AlertTriangle, Camera, CheckCircle2, ClipboardCheck, Clock3, FileWarning, ShieldAlert, Users } from 'lucide-react';
import type { StaffIdentity } from '../types/capabilities';

interface ScreenProps { identity: StaffIdentity; }

export function TodayScreen({ identity }: ScreenProps) {
  const isWorker = identity.role === 'worker';
  const isSupervisor = identity.role === 'supervisor';
  return (
    <div className="screen-stack">
      <section className="card hero">
        <div className="eyebrow">Today</div>
        <h1>{isWorker ? 'Your work for today' : isSupervisor ? 'Team operations' : 'Farm operations'}</h1>
        <p className="muted">Development fixture preview. No item on this screen is authoritative Chief state.</p>
        <div className="hero-grid">
          <div className="metric"><div className="metric-value">{isWorker ? '3' : isSupervisor ? '18' : '94%'}</div><div className="metric-label">{isWorker ? 'Assigned tasks' : isSupervisor ? 'Team tasks' : 'On schedule'}</div></div>
          <div className="metric"><div className="metric-value">{isWorker ? '1' : isSupervisor ? '3' : '2'}</div><div className="metric-label">{isWorker ? 'Queued report' : isSupervisor ? 'Need verification' : 'Escalations'}</div></div>
          <div className="metric"><div className="metric-value">0</div><div className="metric-label">Emergencies</div></div>
        </div>
      </section>

      {isWorker ? (
        <section className="card">
          <h2>Next task</h2>
          <div className="placeholder-row">
            <strong>Feed House 1</strong>
            <p className="muted" style={{ margin: '6px 0 10px' }}><Clock3 size={14} aria-hidden="true" /> Due 08:30 · Poultry area</p>
            <button className="primary-action" type="button"><ClipboardCheck size={18} /> Start task</button>
          </div>
        </section>
      ) : (
        <section className="card">
          <h2>{isSupervisor ? 'Needs attention' : 'Operational attention'}</h2>
          <div className="placeholder-list">
            <div className="placeholder-row"><strong>{isSupervisor ? '3 completions need verification' : 'Feed stock warning'}</strong><p className="muted" style={{ marginBottom: 0 }}>Fixture only — backend workflow not connected.</p></div>
            <div className="placeholder-row"><strong>{isSupervisor ? '2 workers awaiting check-in' : '1 supervisor escalation'}</strong><p className="muted" style={{ marginBottom: 0 }}>Fixture only — no Chief decision implied.</p></div>
          </div>
        </section>
      )}
    </div>
  );
}

export function TasksScreen({ identity }: ScreenProps) {
  return (
    <div className="screen-stack">
      <section className="card hero">
        <div className="eyebrow">Tasks</div>
        <h1>{identity.role === 'worker' ? 'My tasks' : identity.role === 'supervisor' ? 'Team tasks' : 'Farm task board'}</h1>
        <p className="muted">S6 will connect authoritative task lifecycle, evidence and verification states.</p>
      </section>
      <section className="card">
        <div className="placeholder-list">
          {['Feed House 1', 'Check water line', 'Inspect brooder temperature'].map((task, index) => (
            <div className="placeholder-row" key={task}>
              <strong>{task}</strong>
              <p className="muted" style={{ margin: '5px 0 0' }}>{index === 0 ? 'Due soon' : 'Scheduled today'} · DEV fixture</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function ReportScreen() {
  return (
    <div className="screen-stack">
      <section className="card hero">
        <div className="eyebrow">Report</div>
        <h1>Report from the field</h1>
        <p className="muted">S7/S10 will add durable report and emergency submission. Current controls are non-submitting UI fixtures.</p>
      </section>
      <section className="card">
        <div className="action-row">
          <button className="secondary-action" type="button"><Camera size={18} /> Observation</button>
          <button className="secondary-action" type="button"><FileWarning size={18} /> Problem</button>
        </div>
      </section>
      <section className="card" style={{ borderColor: 'rgba(244,63,94,.55)' }}>
        <div className="eyebrow" style={{ color: '#fb7185' }}>Emergency path</div>
        <h2 style={{ marginTop: 8 }}>Urgent farm incident</h2>
        <p className="muted">Staff reports evidence. Only Chief can create authoritative STOP/ASK routing.</p>
        <button className="critical-action" type="button"><ShieldAlert size={18} /> Report emergency</button>
      </section>
    </div>
  );
}

export function TeamScreen({ identity }: ScreenProps) {
  const worker = identity.role === 'worker';
  return (
    <div className="screen-stack">
      <section className="card hero">
        <div className="eyebrow">Team</div>
        <h1>{worker ? 'My shift' : identity.role === 'supervisor' ? 'My team' : 'Farm staff'}</h1>
        <p className="muted">{worker ? 'Workers see only their own shift context.' : 'Staff visibility remains scoped by backend capabilities when S3/S4 are connected.'}</p>
      </section>
      <section className="card">
        <div className="placeholder-row">
          <Users size={20} aria-hidden="true" />
          <strong style={{ marginLeft: 8 }}>{worker ? 'Shift details unavailable until Chief auth is connected' : 'Development team fixture'}</strong>
        </div>
      </section>
    </div>
  );
}

export function MoreScreen({ identity }: ScreenProps) {
  return (
    <div className="screen-stack">
      <section className="card hero">
        <div className="eyebrow">More</div>
        <h1>Device & account</h1>
        <p className="muted">Current identity: {identity.displayName} · {identity.role} · development fixture.</p>
      </section>
      <section className="card">
        <div className="placeholder-list">
          <div className="placeholder-row"><CheckCircle2 size={18} /> <strong>Chief-family secure shell enabled</strong></div>
          <div className="placeholder-row"><AlertTriangle size={18} /> <strong>Production authentication not connected yet</strong></div>
        </div>
      </section>
    </div>
  );
}
