import { LogOut, ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import type { StaffRole } from '../types/capabilities';

const ROLES: StaffRole[] = ['worker', 'supervisor', 'manager'];

export function AppHeader() {
  const { identity, isDevMode, setDevRole, logout } = useAuth();
  if (!identity) return null;

  return (
    <>
      {isDevMode && (
        <div className="dev-banner" role="status">
          DEVELOPMENT / SIMULATION — role and operational content are fixtures, not Chief state.
        </div>
      )}
      <header className="chief-header">
        <div className="chief-header-inner">
          <div className="brand-lockup">
            <div className="brand-mark" aria-hidden="true">C</div>
            <div>
              <div className="brand-title">CHIEF Staff</div>
              <div className="brand-subtitle">Field Operations</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="role-pill" title="Current Staff role">
              <UserRound size={14} aria-hidden="true" /> {identity.role}
            </div>
            {!isDevMode && (
              <button className="icon-action" type="button" aria-label="Sign out of Chief" onClick={() => void logout()}>
                <LogOut size={17} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
        {isDevMode && (
          <div className="chief-header-inner" style={{ minHeight: 'auto', paddingTop: 0 }}>
            <div className="role-switcher" aria-label="Development role preview">
              {ROLES.map(role => (
                <button
                  key={role}
                  type="button"
                  aria-pressed={identity.role === role}
                  onClick={() => setDevRole(role)}
                >
                  {role}
                </button>
              ))}
            </div>
            <span className="status-pill"><ShieldCheck size={14} aria-hidden="true" /> DEV fixture</span>
          </div>
        )}
      </header>
    </>
  );
}
