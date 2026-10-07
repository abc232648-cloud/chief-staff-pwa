import { chiefApiClient } from './client';
import type { ApiResponse } from './types';

export interface AssignedSop {
  sop_id: string;
  version: string;
  title: string;
  purpose: string;
  steps: string[];
  warnings: string[];
  updated_at: string;
}

export interface AssignedSopOverview {
  sops: AssignedSop[];
  total: number;
  notice: string;
}

export function getAssignedSops(signal?: AbortSignal): Promise<ApiResponse<AssignedSopOverview>> {
  return chiefApiClient.get<AssignedSopOverview>('/api/farm/sops/assigned', signal);
}
