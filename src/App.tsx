import { Navigate, Route, Routes } from 'react-router-dom';
import { AppHeader } from './components/AppHeader';
import { BottomNav } from './components/BottomNav';
import { LoginScreen } from './auth/LoginScreen';
import { useAuth } from './auth/AuthContext';
import { MoreScreen, ReportScreen, TasksScreen, TeamScreen, TodayScreen } from './screens';

function StatusBoundary({ title, message, retry }: { title: string; message: string; retry?: () => void }) {
  return (
    <main className="production-lock">
      <section className="card">
        <div className="eyebrow">CHIEF Staff</div>
        <h1>{title}</h1>
        <p className="muted">{message}</p>
        {retry && <button className="secondary-action" type="button" onClick={retry}>Retry Chief</button>}
      </section>
    </main>
  );
}

export default function App() {
  const { status, identity, error, refresh } = useAuth();

  if (status === 'checking') {
    return <StatusBoundary title="Checking Chief session" message="Confirming authenticated identity and Farm role…" />;
  }

  if (status === 'unauthenticated') return <LoginScreen />;

  if (status === 'backend_unavailable') {
    return (
      <StatusBoundary
        title="Chief unavailable"
        message={error || 'Staff authentication or Farm role information could not be confirmed.'}
        retry={() => void refresh()}
      />
    );
  }

  if (status === 'unsupported_role') {
    return (
      <StatusBoundary
        title="Staff access unavailable"
        message={error || 'This Chief identity is not assigned to a supported Staff Farm role. Owner/Administrator identities should use Owner Mobile.'}
        retry={() => void refresh()}
      />
    );
  }

  if (!identity) {
    return <StatusBoundary title="Identity unavailable" message="No authenticated Staff identity is available. No role has been assumed." />;
  }

  return (
    <div className="app-shell">
      <AppHeader />
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
