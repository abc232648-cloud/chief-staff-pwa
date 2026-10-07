import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { StaffIdentity } from '../types/capabilities';
export { TodayScreen } from '../features/today/TodayScreen';
export { TasksScreen } from '../features/tasks/TasksScreen';
export { ReportScreen } from '../features/reports/ReportScreen';
export { TeamScreen } from '../features/team/TeamScreen';

interface ScreenProps { identity: StaffIdentity; }

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
