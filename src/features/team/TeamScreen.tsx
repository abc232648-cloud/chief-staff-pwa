import { AlertTriangle, CheckCircle2, ClipboardCheck, RefreshCw, UserCheck, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { StaffIdentity } from '../../types/capabilities';
import { useTeam } from './useTeam';
import './team.css';

function scopeLabel(scope: string) {
  if (scope === 'SUPERVISED_TASK_ASSIGNMENTS') return 'SUPERVISED TASK SCOPE';
  if (scope === 'FARM_DIRECTORY') return 'FARM STAFF DIRECTORY';
  return 'SELF SCOPE';
}

export function TeamScreen({ identity }: { identity: StaffIdentity }) {
  const resource = useTeam(identity);
  const data = resource.data;
  const title = identity.role === 'worker' ? 'My shift context' : identity.role === 'supervisor' ? 'My supervised team' : 'Farm staff';

  if (!data) {
    return (
      <div className="screen-stack">
        <section className="card hero">
          <div className="eyebrow">Team</div>
          <h1>{title}</h1>
          <div className="provenance-chip unavailable">CHIEF TEAM STATE UNAVAILABLE</div>
          <p className="muted">{resource.error?.message ?? 'Loading authenticated Chief Staff scope.'}</p>
          {resource.error && <button type="button" className="secondary-action" onClick={resource.refresh}><RefreshCw size={18} /> Retry Chief</button>}
        </section>
      </div>
    );
  }

  const team = data.team;
  const active = team.members.reduce((sum, member) => sum + member.active_task_count, 0);
  const overdue = team.members.reduce((sum, member) => sum + member.overdue_task_count, 0);
  const escalated = team.members.reduce((sum, member) => sum + member.escalated_task_count, 0);

  return (
    <div className="screen-stack team-screen">
      <section className="card hero">
        <div className="eyebrow">Team</div>
        <div className={`provenance-chip ${resource.provenance}`}>
          {resource.provenance === 'live' ? 'LIVE CHIEF STAFF STATE' : 'DEVELOPMENT FIXTURE'}
        </div>
        <h1>{title}</h1>
        <p className="muted">{team.scope_source}</p>
        <div className="team-scope-chip">{scopeLabel(team.scope)}</div>
        <div className="hero-grid">
          <div className="metric"><div className="metric-value">{team.member_count}</div><div className="metric-label">Visible staff</div></div>
          <div className="metric"><div className="metric-value">{active}</div><div className="metric-label">Active tasks</div></div>
          <div className="metric"><div className="metric-value">{overdue}</div><div className="metric-label">Overdue tasks</div></div>
        </div>
      </section>

      {identity.role !== 'worker' && (
        <section className="card verification-card">
          <div className="section-heading"><ClipboardCheck size={19} /><strong>Verification queue</strong></div>
          <div className="verification-value">{team.verification_count}</div>
          <p className="muted small-text">
            {identity.role === 'supervisor'
              ? 'Only tasks where Chief names you as supervisor appear in this count.'
              : 'Farm-wide tasks awaiting verification in your current Chief scope.'}
          </p>
          <Link className="primary-action team-link" to="/tasks">
            <ClipboardCheck size={18} aria-hidden="true" /> Open task verification
          </Link>
          <p className="muted tiny-text">Verification and correction actions remain on the authoritative Tasks surface. This Team screen does not duplicate task state.</p>
        </section>
      )}

      <section className="team-member-list" aria-live="polite">
        {team.members.length === 0 ? (
          <div className="card team-empty">
            <Users size={24} aria-hidden="true" />
            <div>
              <strong>No Staff identities in this Chief scope</strong>
              <p className="muted small-text">For Supervisors, workers appear only after an authoritative task names this supervisor.</p>
            </div>
          </div>
        ) : team.members.map(member => (
          <article className="card team-member" key={member.user_id}>
            <div className="team-member-header">
              <div className="team-avatar" aria-hidden="true"><UserCheck size={20} /></div>
              <div className="team-member-name">
                <strong>{member.username}</strong>
                <span>{member.farm_role.toLowerCase().replaceAll('_', ' ')}</span>
              </div>
              <span className="team-enabled"><CheckCircle2 size={14} /> Enabled</span>
            </div>

            <div className="team-stat-grid">
              <div><strong>{member.active_task_count}</strong><span>Active</span></div>
              <div><strong>{member.awaiting_verification_count}</strong><span>Verify</span></div>
              <div><strong>{member.needs_correction_count}</strong><span>Correction</span></div>
              <div className={member.overdue_task_count > 0 ? 'attention' : ''}><strong>{member.overdue_task_count}</strong><span>Overdue</span></div>
            </div>

            {member.escalated_task_count > 0 && (
              <div className="team-alert"><AlertTriangle size={16} /><span>{member.escalated_task_count} task{member.escalated_task_count === 1 ? '' : 's'} escalated</span></div>
            )}

            <div className="attendance-unavailable">
              <span>Attendance</span>
              <strong>Not connected</strong>
            </div>
          </article>
        ))}
      </section>

      <section className="card truth-note">
        <strong>Team-state boundary</strong>
        <p className="muted small-text" style={{ marginBottom: 0 }}>{team.notice} The Staff PWA does not infer whether someone is physically on site from task activity.</p>
      </section>

      {escalated > 0 && identity.role !== 'worker' && (
        <section className="card team-escalation-note">
          <div className="section-heading"><AlertTriangle size={18} /><strong>{escalated} escalated task{escalated === 1 ? '' : 's'} visible</strong></div>
          <p className="muted small-text" style={{ marginBottom: 0 }}>S10 will add incident/emergency escalation routing. Current task escalation remains a task state only.</p>
        </section>
      )}
    </div>
  );
}
