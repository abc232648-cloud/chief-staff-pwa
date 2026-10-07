# CHIEF Staff PWA — Deployment Security Boundary

The browser client is not the authority. Production deployment must preserve these host/backend controls:

- HTTPS only, with HSTS at the production edge.
- Same-origin Chief API routing; do not expose browser bearer/API/model secrets.
- Secure, HttpOnly, SameSite session cookies and Chief CSRF enforcement.
- Backend capability and organizational-scope checks on every mutation/read; frontend role shaping is presentation only.
- CSP at the HTTP header layer at least as restrictive as the checked-in document policy.
- `X-Content-Type-Options: nosniff`, anti-framing (`frame-ancestors 'none'` and/or `X-Frame-Options: DENY`), `Referrer-Policy: no-referrer`, and a restrictive `Permissions-Policy`.
- Service worker must remain static-shell only: no `/api/` interception/caching and no synthetic mutation success.
- Production and DEV builds must be deployed separately. `VITE_CHIEF_STAFF_DEV_MODE=true` must never be used for a production artifact.
- IndexedDB queue data is device-local operational data. Shared devices require explicit logout/session discipline and OS/device protection. Unsynchronized records remain bound to the user ID that created them.
- Backups, audit retention, authoritative evidence, STOP/ASK state and policy history belong to Chief backend systems, not this PWA.

## Deferred platform capabilities

Push notification infrastructure, authoritative media upload reconciliation, native-device attestation and optional site/location confirmation require separate backend contracts and security review. Their absence must not be represented as success.
