import type { ReactNode } from 'react';
import type { StaffCapability } from '../types/capabilities';
import { useAuth } from './AuthContext';

export function CapabilityGate({
  capability,
  children,
  fallback = null
}: {
  capability: StaffCapability;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { hasCapability } = useAuth();
  return hasCapability(capability) ? <>{children}</> : <>{fallback}</>;
}
