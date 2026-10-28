# AI Task Platform v0.1.0-alpha.1

An independent, self-hosted workspace for authorized image APIs and text chat.

## Included

- Text-to-image and up to eight uploaded image references.
- Text Chat Completions, task metadata, filtering and owner-authenticated downloads.
- Administrator-managed user keys, daily quota, concurrency and submission interval.
- In-memory browser credentials, hashed user keys, configurable history and expiry.
- Docker, bilingual setup guides, API documentation and automated security contracts.
- Reproducible 60-second introduction: landscape/portrait, Chinese narration and bilingual subtitles.

## Important

This is a single-process Alpha. Bring your own authorized provider API key.
Without one, generation returns HTTP 503; administration remains available.
No paid-provider generation was performed during this release. The videos show the
real local UI with synthetic narration, not simulated model outputs.

Not included: account pools, shared-subscription gateways, Codex CLI execution,
Responses API, streaming/tool calls, PPT/PSD, S3/SFTP offload or high availability.

Frontend derived from basketikun/chatgpt2api. Original MIT copyright and provenance
are retained in LICENSE and NOTICE.md. This is not an official OpenAI product.
