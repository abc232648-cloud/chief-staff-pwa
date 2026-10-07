# CHIEF Staff PWA

Operational PWA for **Workers, Supervisors and Managers** connected to the same Chief backend as Owner Mobile.

This is a separate client from Owner Mobile. Chief remains the authority for identity, capabilities, policy, task state, acceptance, STOP/ASK decisions, evidence and audit history.

## Current phase

- S1 architecture / capability model / design system
- S2 shell / role-adaptive navigation

Production authentication is intentionally fail-closed until S3.

## Development

```bash
npm install
VITE_CHIEF_STAFF_DEV_MODE=true npm run dev
```

DEV role previews are build-environment controlled and visibly labelled as simulation fixtures.

## Product-family design

The Staff PWA uses the same Chief visual DNA as Owner Mobile: deep green surfaces, emerald active accent, amber warning, rose critical/STOP semantics, system typography, rounded operational cards, Lucide icons, safe-area handling, strong focus-visible treatment and restrained motion.

See `ARCHITECTURE.md` and GitHub issue #1 for the canonical scope and frozen S1-S16 sequence.
