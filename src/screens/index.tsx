import { AlertTriangle, Camera, CheckCircle2, FileWarning, ShieldAlert, Users } from 'lucide-react';
import type { StaffIdentity } from '../types/capabilities';
export { TodayScreen } from '../features/today/TodayScreen';

interface ScreenProps { identity: StaffIdentity; }

export function TasksScreen({ identity }: ScreenProps) {
  return (
    <div className="screen-stack">
      <section className="card hero">
        <div className="eyebrow">Tasks</div>
        <h1>{identity.role === 'worker' ? 'My tasks' : identity.role === 'supervisor' ? 'Team tasks' : 'Farm task board'}</h1>
        <p className="muted">S6 will connect the Farm work ledger and exact task lifecycle. No placeholder task totals are shown in production.</p>
      </section>
      {identity.isSimulated ? (
        <section className="card">
          <div className="provenance-chip mock_isolated">DEVELOPMENT FIXTURE</div>
          <div className="placeholder-list">
            {['Development task — feed round', 'Development task — check water line', 'Development task — inspect brooder'].map(task => (
              <div className="placeholder-row" key={task}>
                <strong>{task}</strong>
                <p className="muted" style={{ margin: '5px 0 0' }}>Fixture only · not Chief task state</p>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="card"><p className="muted" style={{ marginBottom: 0 }}>Task workflow is not connected yet. Nothing is being inferred from the Today brief.</p></section>
      )}
    </div>
  );
}

export function ReportScreen() {
  return (
    <div className="screen-stack">
      <section className="card hero">
        <div className="eyebrow">Report</div>
        <h1>Report from the field</h1>
        <p className="muted">S7/S10 will add durable report and emergency submission. Current controls do not submit anything.</p>
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
        <p className="muted">{worker ? 'Workers see only their own shift context.' : 'S8/S9 will connect the backend Farm staff ledger with role-scoped visibility.'}</p>
      </section>
      <section className="card">
        <div className="placeholder-row">
          <Users size={20} aria-hidden="true" />
          <strong style={{ marginLeft: 8 }}>{identity.isSimulated ? 'Development team fixture not expanded yet' : 'Team data is not connected yet; no synthetic staff list is shown.'}</strong>
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
        <p className="muted">Current identity: {identity.displayName} · {identity.role}{identity.isSimulated ? ' · development fixture' : ''}.</p>
      </section>
      <section className="card">
        <div className="placeholder-list">
          <div className="placeholder-row"><CheckCircle2 size={18} /> <strong>Chief-family secure shell enabled</strong></div>
          <div className="placeholder-row"><AlertTriangle size={18} /> <strong>{identity.isSimulated ? 'Live Chief API blocked for DEV fixture identity' : 'Authenticated with Chief; feature data remains endpoint-specific'}</strong></div>
        </div>
      </section>
    </div>
  );
}
