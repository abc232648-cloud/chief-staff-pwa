import { useMemo, useState } from 'react';
import { ClipboardPlus, RefreshCw, Send } from 'lucide-react';
import type { FarmTaskCreate } from '../../api/farm';
import type { StaffIdentity } from '../../types/capabilities';
import { useTeam } from '../team/useTeam';
import { taskEventId } from './useTasks';

interface Draft {
  eventId: string;
  taskId: string;
  title: string;
  instructions: string;
  location: string;
  assignedTo: string;
  supervisorId: string;
  dueLocal: string;
  priority: 'ROUTINE' | 'HIGH' | 'URGENT';
  evidence: 'NONE' | 'NOTE' | 'PHOTO' | 'MEASUREMENT' | 'CHECKLIST';
}

function localFutureValue(hours = 8) {
  const date = new Date(Date.now() + hours * 3600000);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function freshDraft(): Draft {
  return {
    eventId: taskEventId(),
    taskId: taskEventId(),
    title: '',
    instructions: '',
    location: '',
    assignedTo: '',
    supervisorId: '',
    dueLocal: localFutureValue(),
    priority: 'ROUTINE',
    evidence: 'NOTE'
  };
}

export function ManagerTaskCreatePanel({ identity, busy, onCreate }: {
  identity: StaffIdentity;
  busy: boolean;
  onCreate: (command: FarmTaskCreate) => Promise<boolean>;
}) {
  const team = useTeam(identity);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => freshDraft());

  const members = team.data?.team.members ?? [];
  const assignees = members.filter(member => member.farm_role !== 'GENERAL_MANAGER');
  const supervisors = members.filter(member => member.farm_role === 'SUPERVISOR');

  const command = useMemo<FarmTaskCreate | null>(() => {
    const due = new Date(draft.dueLocal);
    if (!draft.title.trim() || !draft.instructions.trim() || !draft.location.trim() || !draft.assignedTo || Number.isNaN(due.getTime()) || due <= new Date()) return null;
    if (draft.supervisorId && draft.supervisorId === draft.assignedTo) return null;
    return {
      event_id: draft.eventId,
      operation: 'CREATE',
      task_id: draft.taskId,
      title: draft.title.trim(),
      instructions: draft.instructions.trim(),
      location: draft.location.trim(),
      entity_id: null,
      assigned_to: draft.assignedTo,
      supervisor_id: draft.supervisorId || null,
      due_at: due.toISOString(),
      priority: draft.priority,
      evidence_required: [draft.evidence],
      sop_ref: null
    };
  }, [draft]);

  const submit = async () => {
    if (!command) return;
    const ok = await onCreate(command);
    if (ok) {
      setDraft(freshDraft());
      setOpen(false);
      team.refresh();
    }
  };

  if (!open) {
    return (
      <section className="card manager-task-create-closed">
        <div>
          <div className="eyebrow">Manager assignment</div>
          <strong>Create Chief field task</strong>
          <p className="muted small-text">Assignees come from the authenticated Chief Farm Staff directory. No typed identity IDs are accepted here.</p>
        </div>
        <button type="button" className="primary-action" disabled={identity.isSimulated} onClick={() => setOpen(true)}><ClipboardPlus size={18} /> New task</button>
      </section>
    );
  }

  return (
    <section className="card manager-task-create">
      <div className="section-heading"><ClipboardPlus size={19} /><strong>Create Chief field task</strong></div>
      {team.error && (
        <div className="task-error-inline">
          <span>{team.error.message}</span>
          <button type="button" className="secondary-action" onClick={team.refresh}><RefreshCw size={16} /> Retry Staff directory</button>
        </div>
      )}
      {!team.data ? (
        <p className="muted small-text">Chief Staff directory must be available before assigning work. No free-text assignee fallback is provided.</p>
      ) : (
        <div className="manager-task-form">
          <label>Task title<input value={draft.title} maxLength={160} onChange={event => setDraft(value => ({ ...value, title: event.target.value }))} /></label>
          <label>Instructions<textarea rows={4} value={draft.instructions} maxLength={2000} onChange={event => setDraft(value => ({ ...value, instructions: event.target.value }))} /></label>
          <label>Location<input value={draft.location} maxLength={120} placeholder="e.g. House 1" onChange={event => setDraft(value => ({ ...value, location: event.target.value }))} /><span>Free text does not create a canonical Farm entity.</span></label>
          <label>Assign to<select value={draft.assignedTo} onChange={event => setDraft(value => ({ ...value, assignedTo: event.target.value }))}><option value="">Choose Staff identity</option>{assignees.map(member => <option key={member.user_id} value={member.user_id}>{member.username} · {member.farm_role.toLowerCase()}</option>)}</select></label>
          <label>Supervisor (optional)<select value={draft.supervisorId} onChange={event => setDraft(value => ({ ...value, supervisorId: event.target.value }))}><option value="">No named supervisor</option>{supervisors.map(member => <option key={member.user_id} value={member.user_id}>{member.username}</option>)}</select></label>
          <label>Due<input type="datetime-local" value={draft.dueLocal} onChange={event => setDraft(value => ({ ...value, dueLocal: event.target.value }))} /></label>
          <div className="manager-task-two-col">
            <label>Priority<select value={draft.priority} onChange={event => setDraft(value => ({ ...value, priority: event.target.value as Draft['priority'] }))}><option value="ROUTINE">Routine</option><option value="HIGH">High</option><option value="URGENT">Urgent</option></select></label>
            <label>Evidence<select value={draft.evidence} onChange={event => setDraft(value => ({ ...value, evidence: event.target.value as Draft['evidence'] }))}><option value="NONE">None</option><option value="NOTE">Note</option><option value="PHOTO">Photo</option><option value="MEASUREMENT">Measurement</option><option value="CHECKLIST">Checklist</option></select></label>
          </div>
          <p className="muted small-text">This request creates no work until Chief records the CREATE event. A failed request keeps the same task/event IDs for safe retry.</p>
          <div className="task-intent-actions">
            <button type="button" className="secondary-action" disabled={busy} onClick={() => setOpen(false)}>Close</button>
            <button type="button" className="primary-action" disabled={busy || !command} onClick={() => void submit()}><Send size={18} /> {busy ? 'Sending…' : 'Create task in Chief'}</button>
          </div>
        </div>
      )}
    </section>
  );
}
