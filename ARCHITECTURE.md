# CHIEF Staff PWA — Canonical Architecture

## Boundary

CHIEF Staff PWA is a separate operational client from Owner Mobile. It connects to the same Chief backend and never becomes a second Chief, policy engine, authoritative database, or audit authority.

It is one codebase with deeply role-shaped Worker, Supervisor and Manager experiences. It is not three applications, and it is not Owner Mobile with controls hidden.

## Authority

Chief remains authoritative for identity, capabilities, organizational scope, task state, acceptance, policy, STOP/ASK decisions, evidence, receipts and audit history.

Staff Mobile may display authority, request authority, collect evidence, perform locally permitted actions and exercise capabilities explicitly granted by Chief. It may never manufacture authority.

Immutable rules:

- STOP cannot be overridden by Staff Mobile.
- ASK cannot silently become AUTO.
- No fake acceptance, approval, rejection, receipt, verification hash, sync success or policy state.
- Local completion is not Chief acceptance.
- DEV/simulated data never masquerades as production.
- Authorization is backend capability-enforced, never CSS/route hiding alone.
- No cross-user local storage exposure.
- No browser model/provider secrets.
- Owner PWA and Staff PWA communicate only through Chief.

## Roles and capabilities

Role shapes navigation and information density. `capabilities[]` represents permission vocabulary.

Worker: own tasks, task execution, reports, incidents, emergency reporting, assigned SOPs, own history.

Supervisor: Worker capabilities plus assigned-team visibility, scoped assignment, completion verification, correction requests, incident classification/escalation and scoped attendance.

Manager: Supervisor capabilities plus farm operations, staff visibility, scoped team management, farm task assignment/reassignment, farm reports/incidents, inventory where granted and escalation to Owner workflows through Chief.

Supervisor verification means field completion/evidence verification. It is not Chief policy approval.

## Primary navigation

1. Today — immediate priorities
2. Tasks — assignments, progress, verification
3. Report — observations, evidence, incidents, emergencies
4. Team — own shift for Worker; scoped team/staff operations for Supervisor/Manager
5. More — history, sync, account, help, device/session

Today is the operational centre of the Staff product.

## Task lifecycle

`assigned -> acknowledged -> in_progress -> completed_locally -> submitted -> awaiting_verification -> verified | needs_correction | escalated | cancelled`

Local, queued, Chief-received and verified states must remain visually and semantically distinct.

## Offline direction

Designed for intermittent farm connectivity. Previously synchronized tasks/SOPs, drafts, evidence, reports and media queues may be available offline later. UI must distinguish at minimum:

- STORED ON THIS DEVICE
- QUEUED FOR CHIEF
- RECEIVED BY CHIEF
- VERIFIED

## Visual relationship with Owner Mobile

Owner and Staff are one product family. Shared design language:

- background `#021209`
- elevated/nav surface `#041a10`
- emerald accent `#34d399`
- near-white green primary text
- deep-green borders/cards
- amber warning
- rose/red critical and STOP semantics
- same system-font hierarchy and mono treatment for IDs/status only
- same rounded-card language
- same Lucide-style icon family
- same emerald active-navigation behavior
- safe-area support, reduced motion and focus-visible treatment

Staff deliberately differs in interaction density: larger touch targets, simpler field flows, less text, fewer simultaneous metrics and no Owner system-administration surfaces.

## Delivery sequence

S1 architecture/capabilities/design system
S2 shell + role-adaptive navigation
S3 auth/session/capability enforcement
S4 Chief API + provenance/errors
S5 Today
S6 tasks
S7 worker reporting
S8 supervisor verification/team operations
S9 manager operations
S10 incidents/emergencies
S11 SOP/runbooks
S12 offline persistence/queue/media
S13 PWA/device behavior
S14 security/privacy/accessibility
S15 integration/invariant tests
S16 browser E2E/release readiness

Do not skip ahead unless a genuine dependency requires it.

## Deferred

Payroll/full HR, biometric attendance, continuous GPS tracking, native mobile apps, live video, accounting/procurement ERP, employee social/chat and worker AI chatbot are outside the initial Staff PWA scope.
