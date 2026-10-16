import { chiefApiClient } from './client';
import type { ApiResponse } from './types';

export type WorkerReportCategory =
  | 'OBSERVATION'
  | 'MORTALITY'
  | 'FEED'
  | 'WATER'
  | 'EQUIPMENT'
  | 'INVENTORY'
  | 'TASK_EVIDENCE'
  | 'SANITATION'
  | 'DISPOSAL'
  | 'VACCINE_STORAGE'
  | 'SAFETY';

export type WorkerReportSeverity = 'ROUTINE' | 'IMPORTANT' | 'URGENT';
export type WorkerReportBasis = 'MEASURED' | 'ESTIMATED' | 'COUNTED';

export interface WorkerReportPayload {
  event_id: string;
  category: WorkerReportCategory;
  task_id: string | null;
  entity_id: string | null;
  location: string;
  observed_at: string;
  summary: string;
  quantity: string | null;
  unit: string | null;
  basis: WorkerReportBasis | null;
  severity: WorkerReportSeverity;
}

export interface WorkerReportRecord {
  version: 1;
  payload: WorkerReportPayload;
  actor_id: string;
  session_id: string;
  received_at: string;
  evidence_status: 'HUMAN_REPORTED';
}

export interface WorkerReportOverview {
  reports: WorkerReportRecord[];
  total: number;
  next_offset: number | null;
  notice: string;
}

export interface WorkerReportReceipt {
  status: 'RECEIVED' | 'ALREADY_RECEIVED';
  report_id: string;
  received_at: string;
  evidence_status: 'HUMAN_REPORTED';
}

export function getWorkerReports(signal?: AbortSignal, category?: WorkerReportCategory): Promise<ApiResponse<WorkerReportOverview>> {
  const path = category ? `/api/farm/worker-reports?category=${encodeURIComponent(category)}` : '/api/farm/worker-reports';
  return chiefApiClient.get<WorkerReportOverview>(path, signal);
}

export function submitWorkerReport(payload: WorkerReportPayload, signal?: AbortSignal): Promise<ApiResponse<WorkerReportReceipt>> {
  return chiefApiClient.post<WorkerReportReceipt>('/api/farm/worker-reports', payload, signal);
}
