import { ShieldCheck, UserRound } from 'lucide-react';
import type { StaffIdentity, StaffRole } from '../types/capabilities';

interface AppHeaderProps {
  identity: StaffIdentity;
  isDevMode: boolean;
  onDevRoleChange: (role: StaffRole) => void;
}

const ROLES: StaffRole[] = ['worker', 'supervisor', 'manager'];

export function AppHeader({ identity, isDevMode, onDevRoleChange }: AppHeaderProps) {
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
          <div className="role-pill" title="Current development role">
            <UserRound size={14} aria-hidden="true" /> {identity.role}
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
                  onClick={() => onDevRoleChange(role)}
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
