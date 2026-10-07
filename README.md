# CHIEF Staff PWA

Operational PWA for **Workers, Supervisors and Managers** connected to the same Chief backend as Owner Mobile.

This is a separate client from Owner Mobile. Chief remains the authority for identity, capabilities, policy, task state, acceptance, STOP/ASK decisions, evidence and audit history.

## Implementation status

The frozen S1–S16 client sequence is implemented to the repository/release-readiness boundary:

- S1 architecture / role-capability model / Chief-family design system
- S2 role-adaptive shell and five-tab navigation
- S3 Chief cookie-session authentication and Staff role mapping
- S4 same-origin Chief API client, CSRF and provenance/error taxonomy
- S5 Today / Farm brief
- S6 authoritative task workflow
- S7 worker field reporting
- S8 Supervisor/team operations
- S9 Manager operations
- S10 incident and emergency evidence reporting
- S11 assigned SOP/runbook surface
- S12 user/environment-scoped IndexedDB queue and exact report/incident replay
- S13 installable PWA, static-shell service worker and controlled update UX
- S14 security/privacy/accessibility/deployment boundary
- S15 architecture/safety invariant tests
- S16 production release smoke and real Chrome render verification

Production behavior remains fail-closed when a Chief endpoint is not provisioned. The Staff client never substitutes fixtures or local state for Chief authority.

### External/backend dependencies still required

Some client surfaces intentionally remain unavailable until Chief exposes the matching authoritative contract. In particular, the incident/SOP routes and media-upload reconciliation require backend implementation/verification before they can become live operational features. Media is not silently called uploaded or synchronized.

## Development

```bash
npm ci
VITE_CHIEF_STAFF_DEV_MODE=true npm run dev
```

DEV role previews are build-environment controlled and visibly labelled as simulation fixtures. DEV identities cannot use the live Chief API client.

## Verification

```bash
npm run check
npm run browser:smoke
```

GitHub CI uses Node 24 and runs deterministic install, dependency audit, source-safety lint, TypeScript, invariant tests, production build, release smoke and a real headless-Chrome render check.

## Product-family design

The Staff PWA uses the same Chief visual DNA as Owner Mobile: deep green surfaces, emerald active accent, amber warning, rose critical/STOP semantics, system typography, rounded operational cards, Lucide icons, safe-area handling, strong focus-visible treatment and restrained motion.

Staff intentionally differs in information density: Worker flows are large-touch and task-first; Supervisor views emphasize verification/team scope; Manager views emphasize farm operations and escalation.

See `ARCHITECTURE.md`, `DEPLOYMENT_SECURITY.md` and GitHub issue #1 for the canonical boundaries.
