import { AlertTriangle, CheckCircle2, Users } from 'lucide-react';
import type { StaffIdentity } from '../types/capabilities';
export { TodayScreen } from '../features/today/TodayScreen';
export { TasksScreen } from '../features/tasks/TasksScreen';
export { ReportScreen } from '../features/reports/ReportScreen';

interface ScreenProps { identity: StaffIdentity; }

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
