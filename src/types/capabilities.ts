export type StaffRole = 'worker' | 'supervisor' | 'manager';

export type StaffCapability =
  | 'tasks.read.own'
  | 'tasks.acknowledge.own'
  | 'tasks.start.own'
  | 'tasks.complete.own'
  | 'reports.create'
  | 'incidents.create'
  | 'emergencies.create'
  | 'sops.read.assigned'
  | 'history.read.own'
  | 'team.read.assigned'
  | 'tasks.read.team'
  | 'tasks.assign.scoped'
  | 'tasks.verify.scoped'
  | 'reports.read.team'
  | 'reports.request_correction'
  | 'incidents.classify.scoped'
  | 'incidents.escalate'
  | 'attendance.read.team'
  | 'operations.read.farm'
  | 'staff.read.farm'
  | 'teams.manage.scoped'
  | 'tasks.assign.farm'
  | 'tasks.reassign.farm'
  | 'reports.read.farm'
  | 'incidents.manage.farm'
  | 'inventory.read'
  | 'inventory.manage'
  | 'operations.escalate.owner';

export interface StaffIdentity {
  userId: string;
  staffNumber?: string;
  displayName: string;
  role: StaffRole;
  /**
   * Presentation capability projection used to shape the client UI.
   * Chief backend authorization remains mandatory for every protected request.
   */
  capabilities: readonly StaffCapability[];
  farmId?: string;
  assignedAreaIds: readonly string[];
  supervisorId?: string;
  isSimulated: boolean;
}

export const ROLE_PRESENTATION_CAPABILITIES: Readonly<Record<StaffRole, readonly StaffCapability[]>> = {
  worker: [
    'tasks.read.own',
    'tasks.acknowledge.own',
    'tasks.start.own',
    'tasks.complete.own',
    'reports.create',
    'incidents.create',
    'emergencies.create',
    'sops.read.assigned',
    'history.read.own'
  ],
  supervisor: [
    'tasks.read.own',
    'tasks.acknowledge.own',
    'tasks.start.own',
    'tasks.complete.own',
    'reports.create',
    'incidents.create',
    'emergencies.create',
    'sops.read.assigned',
    'history.read.own',
    'team.read.assigned',
    'tasks.read.team',
    'tasks.assign.scoped',
    'tasks.verify.scoped',
    'reports.read.team',
    'reports.request_correction',
    'incidents.classify.scoped',
    'incidents.escalate',
    'attendance.read.team'
  ],
  manager: [
    'tasks.read.own',
    'tasks.acknowledge.own',
    'tasks.start.own',
    'tasks.complete.own',
    'reports.create',
    'incidents.create',
    'emergencies.create',
    'sops.read.assigned',
    'history.read.own',
    'team.read.assigned',
    'tasks.read.team',
    'tasks.assign.scoped',
    'tasks.verify.scoped',
    'reports.read.team',
    'reports.request_correction',
    'incidents.classify.scoped',
    'incidents.escalate',
    'attendance.read.team',
    'operations.read.farm',
    'staff.read.farm',
    'teams.manage.scoped',
    'tasks.assign.farm',
    'tasks.reassign.farm',
    'reports.read.farm',
    'incidents.manage.farm',
    'inventory.read',
    'inventory.manage',
    'operations.escalate.owner'
  ]
} as const;

export const hasCapability = (
  identity: StaffIdentity | null,
  capability: StaffCapability
): boolean => Boolean(identity?.capabilities.includes(capability));
