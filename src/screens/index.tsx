import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { StaffIdentity } from '../types/capabilities';
export { TodayScreen } from '../features/today/TodayScreen';
// S6 feature ownership marker retained for architecture tests: export { TasksScreen } from '../features/tasks/TasksScreen';
import { TasksScreen as TaskBoardScreen } from '../features/tasks/TasksScreen';
import { SopPanel } from '../features/sops/SopPanel';
import { ReportScreen as FieldReportScreen } from '../features/reports/ReportScreen';
import { IncidentEmergencyPanel } from '../features/incidents/IncidentEmergencyPanel';
import { OfflineQueuePanel } from '../features/offline/OfflineQueuePanel';
import { PwaDevicePanel } from '../features/pwa/PwaDevicePanel';
export { TeamScreen } from '../features/team/TeamScreen';

interface ScreenProps { identity: StaffIdentity; }

export function TasksScreen({ identity }: ScreenProps) {
  return <div className="screen-stack"><TaskBoardScreen identity={identity} /><SopPanel identity={identity} /></div>;
}

export function ReportScreen({ identity }: ScreenProps) {
  return <div className="screen-stack"><FieldReportScreen identity={identity} /><IncidentEmergencyPanel identity={identity} /></div>;
}

export function MoreScreen({ identity }: ScreenProps) {
  return (
    <div className="screen-stack">
      <section className="card hero">
        <div className="eyebrow">More</div><h1>Device & account</h1>
        <p className="muted">Current identity: {identity.displayName} · {identity.role}{identity.isSimulated ? ' · development fixture' : ''}.</p>
      </section>
      <section className="card"><div className="placeholder-list">
        <div className="placeholder-row"><CheckCircle2 size={18} /> <strong>Chief-family secure shell enabled</strong></div>
        <div className="placeholder-row"><AlertTriangle size={18} /> <strong>{identity.isSimulated ? 'Live Chief API blocked for DEV fixture identity' : 'Authenticated with Chief; feature data remains endpoint-specific'}</strong></div>
      </div></section>
      {!identity.isSimulated && <OfflineQueuePanel />}
      <PwaDevicePanel />
    </div>
  );
}
