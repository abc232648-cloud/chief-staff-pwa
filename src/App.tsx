import { useMemo, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppHeader } from './components/AppHeader';
import { BottomNav } from './components/BottomNav';
import { isChiefStaffDevMode } from './config/devMode';
import { MoreScreen, ReportScreen, TasksScreen, TeamScreen, TodayScreen } from './screens';
import { DEV_ROLE_CAPABILITIES, type StaffIdentity, type StaffRole } from './types/capabilities';

function buildDevIdentity(role: StaffRole): StaffIdentity {
  return {
    userId: `dev-${role}-fixture`,
    staffNumber: `DEV-${role.toUpperCase()}`,
    displayName: role === 'worker' ? 'Development Worker' : role === 'supervisor' ? 'Development Supervisor' : 'Development Manager',
    role,
    capabilities: DEV_ROLE_CAPABILITIES[role],
    farmId: 'dev-farm-fixture',
    assignedAreaIds: role === 'worker' ? ['dev-area-poultry-1'] : ['dev-area-poultry-1', 'dev-area-poultry-2'],
    supervisorId: role === 'worker' ? 'dev-supervisor-fixture' : undefined,
    isSimulated: true
  };
}

function ProductionAuthBoundary() {
  return (
    <main className="production-lock">
      <section className="card">
        <div className="eyebrow">CHIEF Staff</div>
        <h1>Authentication required</h1>
        <p className="muted">
          Production staff authentication is not connected yet. No development identity or operational fixture is substituted in production.
        </p>
        <div className="placeholder-row">
          S3 will connect Chief-issued identity, session handling, organizational scope and backend-enforced capabilities.
        </div>
      </section>
    </main>
  );
}

export default function App() {
  const isDevMode = isChiefStaffDevMode();
  const [devRole, setDevRole] = useState<StaffRole>('worker');
  const identity = useMemo(() => buildDevIdentity(devRole), [devRole]);

  if (!isDevMode) return <ProductionAuthBoundary />;

  return (
    <div className="app-shell">
      <AppHeader identity={identity} isDevMode={isDevMode} onDevRoleChange={setDevRole} />
      <main className="app-content">
        <Routes>
          <Route path="/" element={<TodayScreen identity={identity} />} />
          <Route path="/tasks" element={<TasksScreen identity={identity} />} />
          <Route path="/report" element={<ReportScreen />} />
          <Route path="/team" element={<TeamScreen identity={identity} />} />
          <Route path="/more" element={<MoreScreen identity={identity} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  );
}
