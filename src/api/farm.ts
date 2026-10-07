import { chiefApiClient } from './client';

/**
 * Thin adapters for Chief Farm endpoints that already exist today.
 * Response bodies remain `unknown` until each workflow batch inspects and freezes
 * the exact backend contract. This avoids inventing client-side domain schemas.
 */
export const farmApi = {
  setup(signal?: AbortSignal) {
    return chiefApiClient.get<unknown>('/api/farm/setup', signal);
  },
  staff(signal?: AbortSignal) {
    return chiefApiClient.get<unknown>('/api/farm/staff', signal);
  },
  journal(signal?: AbortSignal) {
    return chiefApiClient.get<unknown>('/api/farm/journal', signal);
  },
  labour(signal?: AbortSignal) {
    return chiefApiClient.get<unknown>('/api/farm/labour', signal);
  },
  planning(signal?: AbortSignal) {
    return chiefApiClient.get<unknown>('/api/farm/planning', signal);
  },
  brief(signal?: AbortSignal) {
    return chiefApiClient.get<unknown>('/api/farm/brief', signal);
  },
  units(signal?: AbortSignal) {
    return chiefApiClient.get<unknown>('/api/farm/units', signal);
  },
  physicalCounts(signal?: AbortSignal) {
    return chiefApiClient.get<unknown>('/api/farm/physical-counts', signal);
  },
  photos(workId?: string, signal?: AbortSignal) {
    const query = workId ? `?work_id=${encodeURIComponent(workId)}` : '';
    return chiefApiClient.get<unknown>(`/api/farm/photos${query}`, signal);
  }
};
