import { watchSession } from './sessionActivity';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { setStaffApiCsrfProvider } from '../api/client';
import { isChiefStaffDevMode } from '../config/devMode';
import {
  ROLE_PRESENTATION_CAPABILITIES,
  hasCapability as identityHasCapability,
  type StaffCapability,
  type StaffIdentity,
  type StaffRole
} from '../types/capabilities';
import { AuthApiError, authApi, type BackendPrincipal, type FarmSetupOverview } from './authApi';

export type AuthStatus =
  | 'checking'
  | 'unauthenticated'
  | 'authenticated'
  | 'backend_unavailable'
  | 'unsupported_role';

export interface AuthenticatedStaffIdentity extends StaffIdentity {
  backendRole: string;
  farmRole: 'GENERAL_MANAGER' | 'SUPERVISOR' | 'WORKER';
  sessionId: string;
  domains: readonly string[];
}

interface AuthContextValue {
  status: AuthStatus;
  identity: AuthenticatedStaffIdentity | null;
  error: string | null;
  isDevMode: boolean;
  devRole: StaffRole;
  setDevRole: (role: StaffRole) => void;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<boolean>;
  reauthenticate: (password: string) => Promise<boolean>;
  refresh: () => Promise<void>;
  hasCapability: (capability: StaffCapability) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function buildDevIdentity(role: StaffRole): AuthenticatedStaffIdentity {
  const farmRole = role === 'manager' ? 'GENERAL_MANAGER' : role === 'supervisor' ? 'SUPERVISOR' : 'WORKER';
  return {
    userId: `dev-${role}-fixture`,
    staffNumber: `DEV-${role.toUpperCase()}`,
    displayName: role === 'worker' ? 'Development Worker' : role === 'supervisor' ? 'Development Supervisor' : 'Development Manager',
    role,
    capabilities: ROLE_PRESENTATION_CAPABILITIES[role],
    farmId: 'dev-farm-fixture',
    assignedAreaIds: role === 'worker' ? ['dev-area-poultry-1'] : ['dev-area-poultry-1', 'dev-area-poultry-2'],
    supervisorId: role === 'worker' ? 'dev-supervisor-fixture' : undefined,
    isSimulated: true,
    backendRole: role === 'manager' ? 'Manager' : 'Worker',
    farmRole,
    sessionId: `dev-session-${role}`,
    domains: ['farming']
  };
}

function principalCanUseStaff(principal: BackendPrincipal): boolean {
  return principal.role !== 'Owner'
    && principal.role !== 'Administrator'
    && principal.domains.some(domain => domain === 'farming' || domain === '*');
}

function mapProductionIdentity(
  principal: BackendPrincipal,
  farm: FarmSetupOverview
): AuthenticatedStaffIdentity | null {
  if (!principalCanUseStaff(principal)) return null;
  if (farm.farm_role === 'OWNER') return null;

  const role: StaffRole =
    farm.farm_role === 'GENERAL_MANAGER'
      ? 'manager'
      : farm.farm_role === 'SUPERVISOR'
        ? 'supervisor'
        : 'worker';

  return {
    userId: principal.id,
    displayName: principal.id,
    role,
    capabilities: ROLE_PRESENTATION_CAPABILITIES[role],
    assignedAreaIds: [],
    isSimulated: false,
    backendRole: principal.role,
    farmRole: farm.farm_role,
    sessionId: principal.session_id,
    domains: principal.domains
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const isDevMode = isChiefStaffDevMode();
  const [devRole, setDevRoleState] = useState<StaffRole>('worker');
  const [status, setStatus] = useState<AuthStatus>(isDevMode ? 'authenticated' : 'checking');
  const [identity, setIdentity] = useState<AuthenticatedStaffIdentity | null>(() =>
    isDevMode ? buildDevIdentity('worker') : null
  );
  const [csrf, setCsrf] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isDevMode) {
      setStaffApiCsrfProvider(null);
      return;
    }
    setStaffApiCsrfProvider(() => csrf);
    return () => setStaffApiCsrfProvider(null);
  }, [csrf, isDevMode]);

  const refresh = useCallback(async () => {
    if (isDevMode) {
      setIdentity(buildDevIdentity(devRole));
      setCsrf(null);
      setStatus('authenticated');
      setError(null);
      return;
    }

    setStatus('checking');
    setError(null);
    try {
      const session = await authApi.session();
      if (!principalCanUseStaff(session.principal)) {
        setIdentity(null);
        setCsrf(null);
        setStatus('unsupported_role');
        setError('This authenticated Chief identity is not assigned to the Staff Farm surface.');
        return;
      }

      const farm = await authApi.farmSetup();
      const mapped = mapProductionIdentity(session.principal, farm);
      if (!mapped) {
        setIdentity(null);
        setCsrf(null);
        setStatus('unsupported_role');
        setError('This authenticated Chief identity does not resolve to a supported Worker, Supervisor or General Manager Farm role.');
        return;
      }
      setIdentity(mapped);
      setCsrf(session.csrf);
      setStatus('authenticated');
    } catch (cause) {
      setIdentity(null);
      setCsrf(null);
      if (cause instanceof AuthApiError && cause.status === 401) {
        setStatus('unauthenticated');
        setError(null);
      } else {
        setStatus('backend_unavailable');
        setError(cause instanceof AuthApiError && cause.status === 403
          ? 'Chief Farm Staff access is currently unavailable or denied. No Staff role has been assumed.'
          : 'Chief Staff authentication or Farm role information is currently unavailable.');
      }
    }
  }, [devRole, isDevMode]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (isDevMode || status !== 'authenticated' || !csrf) return;
    const expired = (cause: unknown) => {
      if (cause instanceof AuthApiError && cause.status === 401) {
        setIdentity(null); setCsrf(null); setStatus('unauthenticated');
        setError('Chief session expired. Sign in again.');
      }
    };
    return watchSession(
      () => authApi.activity(csrf).catch(expired),
      () => authApi.session().then(session => {
        if (session.principal.id !== identity?.userId || session.principal.role !== identity?.backendRole
            || session.principal.session_id !== identity?.sessionId
            || JSON.stringify(session.principal.domains) !== JSON.stringify(identity?.domains)) {
          return refresh();
        }
        setCsrf(session.csrf);
      }).catch(expired)
    );
  }, [csrf, identity, isDevMode, refresh, status]);

  const setDevRole = useCallback((role: StaffRole) => {
    if (!isDevMode) return;
    setDevRoleState(role);
  }, [isDevMode]);

  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    if (isDevMode) return false;
    setStatus('checking');
    setError(null);
    try {
      await authApi.login(username, password);
      await refresh();
      return true;
    } catch (cause) {
      setIdentity(null);
      setCsrf(null);
      setStatus(cause instanceof AuthApiError && cause.status >= 500 ? 'backend_unavailable' : 'unauthenticated');
      setError(cause instanceof AuthApiError && cause.status === 401 ? 'Invalid username or password.' : 'Chief sign-in could not be completed.');
      return false;
    }
  }, [isDevMode, refresh]);

  const logout = useCallback(async (): Promise<boolean> => {
    if (isDevMode || !csrf) return false;
    try {
      await authApi.logout(csrf);
      setIdentity(null);
      setCsrf(null);
      setError(null);
      setStatus('unauthenticated');
      return true;
    } catch {
      setError('Chief logout could not be confirmed. The authenticated session remains active.');
      return false;
    }
  }, [csrf, isDevMode]);

  const reauthenticate = useCallback(async (password: string): Promise<boolean> => {
    if (isDevMode || !csrf) return false;
    try {
      const result = await authApi.reauthenticate(password, csrf);
      setCsrf(result.csrf);
      setError(null);
      return true;
    } catch {
      setError('Chief reauthentication failed. No authority was changed.');
      return false;
    }
  }, [csrf, isDevMode]);

  const value = useMemo<AuthContextValue>(() => ({
    status,
    identity,
    error,
    isDevMode,
    devRole,
    setDevRole,
    login,
    logout,
    reauthenticate,
    refresh,
    hasCapability: capability => identityHasCapability(identity, capability)
  }), [status, identity, error, isDevMode, devRole, setDevRole, login, logout, reauthenticate, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
