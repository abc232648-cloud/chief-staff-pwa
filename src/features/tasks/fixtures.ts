import type { FarmTask, FarmTaskOverview } from '../../api/farm';
import type { StaffRole } from '../../types/capabilities';

const noActions = {
  can_acknowledge: false,
  can_start: false,
  can_submit: false,
  can_verify: false,
  can_request_correction: false,
  can_escalate: false,
  can_reassign: false,
  can_cancel: false
};

function fixtureTask(changes: Partial<FarmTask>): FarmTask {
  return {
    task_id: 'dev-task-0001',
    title: 'Development fixture — inspect water line',
    instructions: 'Fixture instructions for layout testing only. This is not Chief-assigned work.',
    location: 'Development House 1',
    entity_id: null,
    assigned_to: 'dev-worker-0001',
    supervisor_id: 'dev-supervisor-0001',
    due_at: '2026-10-08T08:00:00Z',
    priority: 'ROUTINE',
    evidence_required: ['NOTE'],
    sop_ref: null,
    status: 'ASSIGNED',
    revision: 'dev-revision-0001',
    created_at: '2026-10-07T07:00:00Z',
    updated_at: '2026-10-07T07:00:00Z',
    last_actor_id: 'dev-manager-0001',
    submission_note: null,
    verification_note: null,
    correction_note: null,
    escalation_reason: null,
    capabilities: { ...noActions },
    ...changes
  };
}

export function taskFixturesFor(role: StaffRole): FarmTaskOverview {
  const tasks = role === 'worker'
    ? [fixtureTask({})]
    : role === 'supervisor'
      ? [fixtureTask({ status: 'AWAITING_VERIFICATION', submission_note: 'Development fixture submission.' })]
      : [
          fixtureTask({}),
          fixtureTask({
            task_id: 'dev-task-0002',
            title: 'Development fixture — feed-store check',
            status: 'ESCALATED',
            assigned_to: 'dev-worker-0002',
            supervisor_id: null,
            escalation_reason: 'Development fixture escalation only.'
          })
        ];
  return {
    tasks,
    total: tasks.length,
    next_offset: null,
    farm_role: role === 'manager' ? 'GENERAL_MANAGER' : role === 'supervisor' ? 'SUPERVISOR' : 'WORKER',
    can_create: false,
    notice: 'Development fixture only. No task, status, assignment, or action shown here is Chief state.'
  };
}
