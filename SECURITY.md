# Security Policy

This is an early Alpha, not an audited enterprise security product. Report issues
privately through GitHub's Security Advisories if enabled. Otherwise open an issue
requesting a private contact without including credentials or exploit details.

## Trust Boundaries

- Platform user keys and provider API keys are different. Only the operator configures
  the provider key. User keys are random and stored as SHA-256 hashes.
- Browser credentials stay in memory until logout, refresh or tab closure. They are
  never passed to third-party links or localStorage. Clipboard copies remain subject
  to operating-system clipboard history.
- Every task and artifact request requires the owning key. The administrator has no
  cross-user artifact bypass. Keys are revealed only at creation.
- The operator-configured HTTPS upstream is trusted. Clients cannot select an upstream
  URL or submit remote reference-image URLs. Redirects are not followed. Image output
  must be base64; URL-only provider outputs are rejected.
- Reference images are decoded, size/pixel limited and re-encoded before forwarding.
  Upstream errors are sanitized. Request payloads and keys are not application logs.
- Same-origin deployment is the supported frontend configuration. Serve via HTTPS
  outside localhost. Use a reverse proxy for connection limits, TLS and request-rate
  control. Do not serve the data directory statically.

## Retention Is Not Zero Logging

History-on tasks retain prompts, metadata, generated chat text and image artifacts
for seven days by default. Chat input context is not persisted as a full transcript.

History-off hides task listings and does not store new prompt/title/note/chat text in
SQLite. Operational metadata, request fingerprints, quota counters and generated
images still exist for up to one hour, allowing polling and downloading by task ID.
Cleanup runs at startup and every minute. Existing recorded tasks are not erased by
the switch. Re-enabling history exposes previously recorded tasks again.

Deleting a terminal task removes its database row and artifact file. Deleting or
disabling a key revokes new access, but does not cancel already accepted upstream
requests or erase the user's tasks. Files previously downloaded, OS caches, backups,
proxy access logs, and provider retention are outside this deletion guarantee. A
failed/timeout request may still incur provider charges.

## Limits

Run one server process per SQLite data directory; a process lock prevents accidental
multi-worker launch. Do not put SQLite on an unreliable network filesystem. This is
not a distributed queue. Publicly exposed installations additionally need monitoring,
backups, abuse controls and an operator privacy policy.

Next.js static export requires inline hydration scripts; the current CSP allows inline
scripts/styles, so it is defense in depth, not a complete XSS prevention guarantee.

No claim is made about fixing or rotating credentials on any separately deployed
legacy installation. This distribution must be deployed and configured independently.
