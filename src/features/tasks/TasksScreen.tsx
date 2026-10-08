import { useMemo, useState } from 'react';
import { AlertTriangle, Check, CheckCircle2, Clock3, Flag, Play, RefreshCw, RotateCcw, Send, ShieldCheck } from 'lucide-react';
import type { FarmTask } from '../../api/farm';
import type { StaffIdentity } from '../../types/capabilities';
import { TaskPhotoEvidence } from './TaskPhotoEvidence';
import { useTasks, type TaskOperation } from './useTasks';
import './tasks.css';

const statusLabel: Record<FarmTask['status'], string> = {
  ASSIGNED: 'Assigned',
  ACKNOWLEDGED: 'Acknowledged',
  IN_PROGRESS: 'In progress',
  AWAITING_VERIFICATION: 'Awaiting verification',
  NEEDS_CORRECTION: 'Needs correction',
  ESCALATED: 'Escalated',
  VERIFIED: 'Verified',
  CANCELLED: 'Cancelled'
};

const actionMeta: Partial<Record<TaskOperation, { label: string; prompt: string; icon: typeof Check }>> = {
  SUBMIT: { label: 'Submit completion', prompt: 'Completion note to send to Chief', icon: Send },
  VERIFY: { label: 'Verify completion', prompt: 'Verification note', icon: ShieldCheck },
  REQUEST_CORRECTION: { label: 'Request correction', prompt: 'What needs correction?', icon: RotateCcw },
  ESCALATE: { label: 'Escalate', prompt: 'Reason for escalation', icon: Flag },
  CANCEL: { label: 'Cancel task', prompt: 'Reason for cancellation', icon: AlertTriangle }
};

function dueLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function provenanceLabel(provenance: 'live' | 'cached' | 'mock_isolated' | 'unavailable') {
  if (provenance === 'live') return 'LIVE CHIEF TASK STATE';
  if (provenance === 'mock_isolated') return 'DEVELOPMENT FIXTURE';
  if (provenance === 'cached') return 'CACHED CHIEF TASK STATE';
  return 'CHIEF TASK STATE UNAVAILABLE';
}

function TaskCard({ task, busy, simulated, onAction }: {
  task: FarmTask;
  busy: boolean;
  simulated: boolean;
  onAction: (operation: TaskOperation, detail?: string) => Promise<boolean>;
}) {
  const [intent, setIntent] = useState<TaskOperation | null>(null);
  const [detail, setDetail] = useState('');
  const meta = intent ? actionMeta[intent] : undefined;

  const runSimple = async (operation: 'ACKNOWLEDGE' | 'START') => {
    await onAction(operation);
  };

  const submitIntent = async () => {
    if (!intent) return;
    const ok = await onAction(intent, detail);
    if (ok) {
      setIntent(null);
      setDetail('');
    }
  };

  return (
    <article className={`task-card priority-${task.priority.toLowerCase()}`}>
      <div className="task-card-top">
        <div>
          <div className="task-location">{task.location || 'Location not stated'}</div>
          <h2>{task.title}</h2>
        </div>
        <span className={`task-status status-${task.status.toLowerCase()}`}>{statusLabel[task.status]}</span>
      </div>

      <p className="task-instructions">{task.instructions}</p>

      <div className="task-meta-grid">
        <div><Clock3 size={16} aria-hidden="true" /><span><strong>Due</strong>{dueLabel(task.due_at)}</span></div>
        <div><Flag size={16} aria-hidden="true" /><span><strong>Priority</strong>{task.priority.toLowerCase()}</span></div>
      </div>

      <div className="task-evidence">
        <strong>Evidence:</strong> {task.evidence_required.join(', ').toLowerCase().replaceAll('_', ' ')}
        {task.sop_ref ? <span> · SOP: {task.sop_ref}</span> : null}
      </div>

      <TaskPhotoEvidence task={task} simulated={simulated} />

      {task.correction_note && <div className="task-note correction"><strong>Correction requested:</strong> {task.correction_note}</div>}
      {task.escalation_reason && <div className="task-note escalation"><strong>Escalation:</strong> {task.escalation_reason}</div>}
      {task.submission_note && task.status === 'AWAITING_VERIFICATION' && <div className="task-note"><strong>Submitted note:</strong> {task.submission_note}</div>}
      {task.verification_note && <div className="task-note verified"><strong>Verification:</strong> {task.verification_note}</div>}

      {!simulated && (
        <div className="task-actions" aria-label={`Actions for ${task.title}`}>
          {task.capabilities.can_acknowledge && (
            <button type="button" className="primary-action" disabled={busy} onClick={() => void runSimple('ACKNOWLEDGE')}>
              <Check size={18} aria-hidden="true" /> Acknowledge
            </button>
          )}
          {task.capabilities.can_start && (
            <button type="button" className="primary-action" disabled={busy} onClick={() => void runSimple('START')}>
              <Play size={18} aria-hidden="true" /> Start task
            </button>
          )}
          {task.capabilities.can_submit && (
            <button type="button" className="primary-action" disabled={busy} onClick={() => { setIntent('SUBMIT'); setDetail(''); }}>
              <Send size={18} aria-hidden="true" /> Submit completion
            </button>
          )}
          {task.capabilities.can_verify && (
            <button type="button" className="primary-action" disabled={busy} onClick={() => { setIntent('VERIFY'); setDetail(''); }}>
              <ShieldCheck size={18} aria-hidden="true" /> Verify
            </button>
          )}
          {task.capabilities.can_request_correction && (
            <button type="button" className="secondary-action" disabled={busy} onClick={() => { setIntent('REQUEST_CORRECTION'); setDetail(''); }}>
              <RotateCcw size={18} aria-hidden="true" /> Correction
            </button>
          )}
          {task.capabilities.can_escalate && (
            <button type="button" className="secondary-action warning-action" disabled={busy} onClick={() => { setIntent('ESCALATE'); setDetail(''); }}>
              <Flag size={18} aria-hidden="true" /> Escalate
            </button>
          )}
          {task.capabilities.can_cancel && (
            <button type="button" className="secondary-action danger-outline" disabled={busy} onClick={() => { setIntent('CANCEL'); setDetail(''); }}>
              <AlertTriangle size={18} aria-hidden="true" /> Cancel
            </button>
          )}
        </div>
      )}

      {meta && intent && (
        <div className="task-intent-panel">
          <label htmlFor={`task-detail-${task.task_id}`}>{meta.prompt}</label>
          <textarea
            id={`task-detail-${task.task_id}`}
            value={detail}
            onChange={event => setDetail(event.target.value)}
            rows={3}
            maxLength={intent === 'ESCALATE' || intent === 'CANCEL' ? 800 : 1200}
            placeholder="State only what you observed or verified."
          />
          <p className="muted small-text">This action is sent to Chief. It is not complete until Chief confirms the task event.</p>
          <div className="task-intent-actions">
            <button type="button" className="secondary-action" disabled={busy} onClick={() => { setIntent(null); setDetail(''); }}>Back</button>
            <button type="button" className={intent === 'CANCEL' ? 'critical-action' : 'primary-action'} disabled={busy || !detail.trim()} onClick={() => void submitIntent()}>
              <meta.icon size={18} aria-hidden="true" /> {meta.label}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

export function TasksScreen({ identity }: { identity: StaffIdentity }) {
  const tasks = useTasks(identity);
  const data = tasks.data;
  const title = identity.role === 'worker' ? 'My tasks' : identity.role === 'supervisor' ? 'Team tasks' : 'Farm task board';
  const counts = useMemo(() => {
    const list = data?.tasks ?? [];
    return {
      active: list.filter(task => !['VERIFIED', 'CANCELLED'].includes(task.status)).length,
      verification: list.filter(task => task.status === 'AWAITING_VERIFICATION').length,
      escalated: list.filter(task => task.status === 'ESCALATED').length
    };
  }, [data]);

  if (!data) {
    return (
      <div className="screen-stack">
        <section className="card hero">
          <div className="eyebrow">Tasks</div>
          <h1>{title}</h1>
          <div className="provenance-chip unavailable">CHIEF TASK STATE UNAVAILABLE</div>
          <p className="muted">{tasks.error?.message ?? 'Loading authenticated Chief task state. No Today-brief work is being promoted into authoritative tasks.'}</p>
          {tasks.error && <button type="button" className="secondary-action" onClick={tasks.refresh}><RefreshCw size={18} /> Retry Chief</button>}
        </section>
      </div>
    );
  }

  return (
    <div className="screen-stack">
      <section className="card hero">
        <div className="eyebrow">Tasks</div>
        <div className={`provenance-chip ${tasks.provenance}`}>{provenanceLabel(tasks.provenance)}</div>
        <h1>{title}</h1>
        <p className="muted">{tasks.provenance === 'mock_isolated' ? 'Read-only development fixtures. Actions cannot reach Chief.' : data.notice}</p>
        <div className="hero-grid">
          <div className="metric"><div className="metric-value">{counts.active}</div><div className="metric-label">Active</div></div>
          <div className="metric"><div className="metric-value">{counts.verification}</div><div className="metric-label">Awaiting verification</div></div>
          <div className="metric"><div className="metric-value">{counts.escalated}</div><div className="metric-label">Escalated</div></div>
        </div>
      </section>

      {tasks.mutationError && (
        <section className="card task-error" role="alert">
          <div className="row-title"><AlertTriangle size={18} /><strong>Task action not confirmed</strong></div>
          <p className="muted small-text">{tasks.mutationError.message}</p>
          <p className="muted small-text" style={{ marginBottom: 0 }}>Refresh before retrying if another person may have changed this task. No local success is being substituted.</p>
        </section>
      )}

      {data.can_create && identity.role === 'manager' && (
        <section className="card truth-note">
          <strong>Assignment management</strong>
          <p className="muted small-text" style={{ marginBottom: 0 }}>Chief permits this account to create field tasks. Staff assignment controls are populated only from the authoritative Chief Staff directory; typed or invented worker identities are not accepted.</p>
        </section>
      )}

      <section className="task-list" aria-live="polite">
        {data.tasks.length === 0 ? (
          <div className="card task-empty">
            <CheckCircle2 size={26} aria-hidden="true" />
            <div><strong>No tasks returned in your Chief scope</strong><p className="muted small-text">This does not mean no farm work exists outside your authenticated assignment scope.</p></div>
          </div>
        ) : data.tasks.map(task => (
          <TaskCard
            key={task.task_id}
            task={task}
            busy={tasks.mutatingTaskId === task.task_id}
            simulated={identity.isSimulated}
            onAction={(operation, detail) => tasks.act(task, operation, detail)}
          />
        ))}
      </section>

      <section className="card truth-note">
        <strong>Task-state boundary</strong>
        <p className="muted small-text" style={{ marginBottom: 0 }}>A device action is not authoritative merely because you tapped a button. This screen changes task state only after Chief accepts the event and the task list is refreshed.</p>
      </section>
    </div>
  );
}
