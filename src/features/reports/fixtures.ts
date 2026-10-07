import type { WorkerReportOverview } from '../../api/reports';

export const developmentReportOverview: WorkerReportOverview = {
  reports: [
    {
      version: 1,
      payload: {
        event_id: 'dev-report-0001',
        category: 'OBSERVATION',
        task_id: null,
        entity_id: null,
        location: 'Development House 1',
        observed_at: '2026-10-07T07:15:00Z',
        summary: 'Development fixture observation for layout testing only.',
        quantity: null,
        unit: null,
        basis: null,
        severity: 'ROUTINE'
      },
      actor_id: 'dev-worker-0001',
      session_id: 'dev-session-0001',
      received_at: '2026-10-07T07:16:00Z',
      evidence_status: 'HUMAN_REPORTED'
    }
  ],
  total: 1,
  next_offset: null,
  notice: 'Development fixture only. No report shown here was received by Chief.'
};
