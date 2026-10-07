import { useEffect, useState } from 'react';
import { chiefApiClient } from '../../api/client';
import { ChiefApiError, type ResourceState } from '../../api/types';
import type { StaffIdentity } from '../../types/capabilities';
import { DEV_FARM_BRIEF } from './fixtures';
import type { FarmBrief } from './types';

const unavailable = (): ResourceState<FarmBrief> => ({
  data: null,
  provenance: 'unavailable',
  fetchedAt: null,
  error: null
});

export function useFarmBrief(identity: StaffIdentity): ResourceState<FarmBrief> & { refresh: () => void } {
  const [generation, setGeneration] = useState(0);
  const [state, setState] = useState<ResourceState<FarmBrief>>(() =>
    identity.isSimulated
      ? { data: DEV_FARM_BRIEF, provenance: 'mock_isolated', fetchedAt: null, error: null }
      : unavailable()
  );

  useEffect(() => {
    if (identity.isSimulated) {
      setState({ data: DEV_FARM_BRIEF, provenance: 'mock_isolated', fetchedAt: null, error: null });
      return;
    }

    const controller = new AbortController();
    setState(unavailable());
    void chiefApiClient.get<FarmBrief>('/api/farm/brief', controller.signal)
      .then(response => {
        if (controller.signal.aborted) return;
        setState({
          data: response.data,
          provenance: response.provenance,
          fetchedAt: response.fetchedAt,
          error: null
        });
      })
      .catch(cause => {
        if (controller.signal.aborted) return;
        const error = cause instanceof ChiefApiError
          ? cause
          : new ChiefApiError({
              message: 'Farm brief could not be interpreted.',
              origin: 'protocol',
              code: 'UNKNOWN_FARM_BRIEF_ERROR',
              details: cause
            });
        setState({ data: null, provenance: 'unavailable', fetchedAt: null, error });
      });

    return () => controller.abort();
  }, [identity.isSimulated, identity.userId, generation]);

  return { ...state, refresh: () => setGeneration(value => value + 1) };
}
