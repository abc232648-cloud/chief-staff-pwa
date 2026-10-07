import type { FarmStaffOverview } from '../../api/farm';
import type { StaffRole } from '../../types/capabilities';

export function developmentTeamOverview(role: StaffRole): FarmStaffOverview {
  const worker = {
    user_id: 'dev-worker-0001',
    username: 'Development Worker',
    chief_role: 'Worker',
    farm_role: 'WORKER' as const,
    enabled: true as const,
    assigned_task_count: 2,
    active_task_count: 1,
    awaiting_verification_count: role === 'supervisor' ? 1 : 0,
    needs_correction_count: 0,
    escalated_task_count: 0,
    overdue_task_count: 0,
    attendance_status: 'NOT_CONNECTED' as const
  };

  const members = role === 'worker'
    ? [worker]
    : role === 'supervisor'
      ? [worker]
      : [
          worker,
          {
            ...worker,
            user_id: 'dev-worker-0002',
            username: 'Development Worker 2',
            assigned_task_count: 1,
            active_task_count: 1,
            awaiting_verification_count: 0,
            escalated_task_count: 1
          }
        ];

  return {
    items: [],
    can_manage: false,
    assignees: [],
    team: {
      farm_role: role === 'manager' ? 'GENERAL_MANAGER' : role === 'supervisor' ? 'SUPERVISOR' : 'WORKER',
      scope: role === 'manager' ? 'FARM_DIRECTORY' : role === 'supervisor' ? 'SUPERVISED_TASK_ASSIGNMENTS' : 'SELF',
      scope_source: 'Development fixture only. No organizational relationship shown here is Chief state.',
      members,
      member_count: members.length,
      verification_task_ids: role === 'supervisor' ? ['dev-task-verify-0001'] : [],
      verification_count: role === 'supervisor' ? 1 : 0,
      attendance_available: false,
      notice: 'Development fixture only. Attendance is not connected and no physical presence is inferred.'
    },
    timezone: 'Africa/Lagos',
    daily_report_schedule: null,
    external_notifications: 'PENDING',
    open_count: 0,
    overdue_count: 0
  };
}
