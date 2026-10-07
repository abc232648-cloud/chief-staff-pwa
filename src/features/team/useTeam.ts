import { useCallback, useEffect, useState } from 'react';
import { farmApi, type FarmStaffOverview } from '../../api/farm';
import { ChiefApiError, type DataProvenance } from '../../api/types';
import type { StaffIdentity } from '../../types/capabilities';
import { developmentTeamOverview } from './fixtures';

interface TeamState {
  data: FarmStaffOverview | null;
  provenance: DataProvenance;
  fetchedAt: number | null;
  error: ChiefApiError | null;
}

function unavailable(): TeamState {
  return { data: null, provenance: 'unavailable', fetchedAt: null, error: null };
}

export function useTeam(identity: StaffIdentity) {
  const [generation, setGeneration] = useState(0);
  const [state, setState] = useState<TeamState>(() => identity.isSimulated
    ? { data: developmentTeamOverview(identity.role), provenance: 'mock_isolated', fetchedAt: null, error: null }
    : unavailable());

  useEffect(() => {
    if (identity.isSimulated) {
      setState({ data: developmentTeamOverview(identity.role), provenance: 'mock_isolated', fetchedAt: null, error: null });
      return;
    }
    const controller = new AbortController();
    setState(unavailable());
    void farmApi.staff(controller.signal)
      .then(response => {
        if (controller.signal.aborted) return;
        setState({ data: response.data, provenance: response.provenance, fetchedAt: response.fetchedAt, error: null });
      })
      .catch(cause => {
        if (controller.signal.aborted) return;
        const error = cause instanceof ChiefApiError ? cause : new ChiefApiError({
          message: 'Chief Staff team state could not be interpreted.',
          origin: 'protocol', code: 'UNKNOWN_TEAM_ERROR', details: cause
        });
        setState({ data: null, provenance: 'unavailable', fetchedAt: null, error });
      });
    return () => controller.abort();
  }, [identity.isSimulated, identity.role, identity.userId, generation]);

  const refresh = useCallback(() => setGeneration(value => value + 1), []);
  return { ...state, refresh };
}
