import { chiefApiClient } from './client';
import type { ApiResponse } from './types';

/** Existing Chief Farm routes verified before S6. */
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

export interface FarmTaskCapabilities {
  can_acknowledge: boolean;
  can_start: boolean;
  can_submit: boolean;
  can_verify: boolean;
  can_request_correction: boolean;
  can_escalate: boolean;
  can_reassign: boolean;
  can_cancel: boolean;
}

export type FarmTaskStatus =
  | 'ASSIGNED'
  | 'ACKNOWLEDGED'
  | 'IN_PROGRESS'
  | 'AWAITING_VERIFICATION'
  | 'NEEDS_CORRECTION'
  | 'ESCALATED'
  | 'VERIFIED'
  | 'CANCELLED';

export interface FarmTask {
  task_id: string;
  title: string;
  instructions: string;
  location: string;
  entity_id: string | null;
  assigned_to: string;
  supervisor_id: string | null;
  due_at: string;
  priority: 'ROUTINE' | 'HIGH' | 'URGENT';
  evidence_required: Array<'NONE' | 'NOTE' | 'PHOTO' | 'MEASUREMENT' | 'CHECKLIST'>;
  sop_ref: string | null;
  status: FarmTaskStatus;
  revision: string;
  created_at: string;
  updated_at: string;
  last_actor_id: string;
  submission_note: string | null;
  verification_note: string | null;
  correction_note: string | null;
  escalation_reason: string | null;
  capabilities: FarmTaskCapabilities;
}

export interface FarmTaskOverview {
  tasks: FarmTask[];
  total: number;
  next_offset: number | null;
  farm_role: 'OWNER' | 'GENERAL_MANAGER' | 'SUPERVISOR' | 'WORKER';
  can_create: boolean;
  notice: string;
}

export type FarmTaskMutation =
  | { event_id: string; operation: 'ACKNOWLEDGE' | 'START'; task_id: string; expected_revision: string }
  | { event_id: string; operation: 'SUBMIT' | 'VERIFY' | 'REQUEST_CORRECTION'; task_id: string; expected_revision: string; note: string }
  | { event_id: string; operation: 'ESCALATE' | 'CANCEL'; task_id: string; expected_revision: string; reason: string };

export interface FarmTaskMutationResult {
  status: 'RECORDED' | 'ALREADY_RECORDED';
  revision: string;
}

export function getFarmTasks(signal?: AbortSignal): Promise<ApiResponse<FarmTaskOverview>> {
  return chiefApiClient.get<FarmTaskOverview>('/api/farm/tasks', signal);
}

export function mutateFarmTask(command: FarmTaskMutation, signal?: AbortSignal): Promise<ApiResponse<FarmTaskMutationResult>> {
  return chiefApiClient.post<FarmTaskMutationResult>('/api/farm/tasks', command, signal);
}
