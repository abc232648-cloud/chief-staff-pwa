import type { FarmBrief } from './types';

export const DEV_FARM_BRIEF: FarmBrief = {
  date: 'DEV-DATE',
  timezone: 'Africa/Lagos',
  generated_at: 'DEV-GENERATED-AT',
  farm_role: 'WORKER',
  scope: 'OWN_REPORTS_AND_ASSIGNED_WORK',
  metrics: [
    {
      location: 'Development Poultry House',
      entity_id: 'dev-flock-fixture',
      kind: 'mortality',
      quantity: '0',
      unit: 'birds',
      reports: 1,
      contains_estimates: false
    }
  ],
  last_report_received_at: null,
  reporting: [
    {
      id: 'dev-reporting-fixture',
      entity_id: 'dev-flock-fixture',
      kind: 'mortality',
      due_time: '09:00',
      assignee: 'dev-worker-fixture',
      location: 'Development Poultry House',
      status: 'AWAITING'
    }
  ],
  schedule_status: 'CONFIGURED',
  current_work: [
    {
      id: 'dev-work-fixture',
      kind: 'TASK',
      text: 'Development task fixture — inspect drinker line',
      state: 'OPEN',
      due_at: null,
      severity: 'NORMAL',
      overdue: false
    }
  ],
  current_balances: [],
  external_notifications: 'NOT_CONFIGURED',
  notice: 'Development fixture only. This is not Chief Farm state and must never be interpreted as a real farm observation.',
  alerts: []
};
