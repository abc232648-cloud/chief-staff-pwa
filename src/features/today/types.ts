export type FarmBriefRole = 'OWNER' | 'GENERAL_MANAGER' | 'SUPERVISOR' | 'WORKER';
export type ReportingStatus = 'REPORTED' | 'REPORTED_LATE' | 'MISSING' | 'AWAITING' | 'TIMEZONE_REVIEW_REQUIRED';

export interface FarmBriefMetric {
  location: string;
  entity_id: string | null;
  kind: string;
  quantity: string;
  unit: string;
  reports: number;
  contains_estimates: boolean;
}

export interface FarmReportingCheck {
  id: string;
  entity_id: string;
  kind: string;
  due_time: string;
  assignee: string;
  location: string;
  status: ReportingStatus;
}

export interface FarmCurrentWork {
  id: string;
  kind: string;
  text: string;
  state: string;
  due_at: string | null;
  severity: string;
  overdue: boolean;
}

export interface FarmBriefAlert {
  id: string;
  type: string;
  text: string;
}

export interface FarmBrief {
  date: string;
  timezone: string;
  generated_at: string;
  farm_role: FarmBriefRole;
  scope: 'FARM' | 'OWN_REPORTS_AND_ASSIGNED_WORK';
  metrics: FarmBriefMetric[];
  last_report_received_at: string | null;
  reporting: FarmReportingCheck[];
  schedule_status: 'CONFIGURED' | 'NOT_CONFIGURED';
  current_work: FarmCurrentWork[];
  current_balances: unknown[];
  external_notifications: string;
  notice: string;
  alerts: FarmBriefAlert[];
  finance?: unknown;
}
