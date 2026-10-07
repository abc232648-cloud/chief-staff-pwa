import { chiefApiClient } from './client';
import type { ApiResponse } from './types';

export type IncidentKind = 'INCIDENT' | 'EMERGENCY';
export type IncidentSeverity = 'IMPORTANT' | 'URGENT' | 'CRITICAL';

export interface IncidentCreatePayload {
  event_id: string;
  operation: 'CREATE';
  kind: IncidentKind;
  category: string;
  location: string;
  observed_at: string;
  summary: string;
  severity: IncidentSeverity;
  immediate_risk: boolean;
}

export interface IncidentEscalatePayload {
  event_id: string;
  operation: 'ESCALATE';
  incident_id: string;
  expected_revision: string;
  reason: string;
}

export type IncidentMutation = IncidentCreatePayload | IncidentEscalatePayload;

export interface IncidentReceipt {
  status: 'RECEIVED' | 'ALREADY_RECEIVED' | 'RECORDED' | 'ALREADY_RECORDED';
  incident_id: string;
  received_at: string;
  revision: string;
}

export interface IncidentRecord {
  incident_id: string;
  kind: IncidentKind;
  category: string;
  location: string;
  observed_at: string;
  summary: string;
  severity: IncidentSeverity;
  immediate_risk: boolean;
  status: string;
  revision: string;
  actor_id: string;
  received_at: string;
  can_escalate: boolean;
}

export interface IncidentOverview {
  incidents: IncidentRecord[];
  total: number;
  next_offset: number | null;
  notice: string;
}

export function getIncidents(signal?: AbortSignal): Promise<ApiResponse<IncidentOverview>> {
  return chiefApiClient.get<IncidentOverview>('/api/farm/incidents', signal);
}

export function mutateIncident(command: IncidentMutation, signal?: AbortSignal): Promise<ApiResponse<IncidentReceipt>> {
  return chiefApiClient.post<IncidentReceipt>('/api/farm/incidents', command, signal);
}
