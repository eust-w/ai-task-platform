# AI Task Platform Open-Source Release Implementation Plan

**Goal:** Publish an independently deployable AI task platform and truthful launch media without changing the existing production checkout or services.

**Architecture:** Extract the existing user-console components from the MIT-licensed upstream-derived checkout. Replace account-pool-dependent API wiring with a small authorized-provider boundary, private artifact storage and durable task metadata. Production configuration, account data, browser captures and deployment scripts are never imported.

**Tech Stack:** FastAPI, httpx, SQLite, Pillow, Next.js/React, pytest, Playwright and FFmpeg.

## Approved Boundaries

- Do not edit, restart, deploy, rotate keys or modify DNS for the existing production instance.
- Work only in this separate repository. Keep upstream copyright and provenance.
- No account registration, cookies, reverse-engineered web provider, shared subscription gateway or arbitrary CLI execution in the public distribution.
- Use environment-supplied authorized API credentials; never include upstream or user secrets in links, browser persistence, logs or media.
- Publish an Alpha with measured limitations, not claims of unlimited use, guaranteed availability or compliance certification.

## Task 1: Isolated Import and Security Regression Tests

Files: `web/src/app/api-console/*`, `tests/test_release_boundary.py`, `NOTICE.md`, `.gitignore`.

1. Import only reusable frontend source and MIT license.
2. Write tests rejecting external credential URLs, persistent browser keys, private deployment identifiers and unsupported providers.
3. Run failing tests; remove inherited unsafe references and unused file-task surfaces.
4. Verify original checkout/config hashes and process identity are unchanged.

## Task 2: Authorized Provider and Task API

Files: `platform_api/config.py`, `provider.py`, `store.py`, `app.py`, `tests/test_platform.py`.

1. Write failing contract tests for auth, ownership, task submission, limits and artifact downloads.
2. Add configured HTTPS provider requests for image generation, multi-image editing and chat. No arbitrary client-supplied upstream URLs.
3. Add hashed platform keys, atomic admission limits, bounded workers, idempotent client task IDs and interrupted-task recovery.
4. Bound input sizes, verify image bytes, never fetch client image URLs, sanitize upstream errors and require auth on artifacts.
5. Test history-off behavior, deletion, key revocation, timeouts, multipart validation and restart recovery.

## Task 3: User Console and Administrator Settings

Files: `web/src/app/api-console/*`, `web/src/app/layout.tsx`, `web/src/app/page.tsx`.

1. Keep credentials in memory only and pin requests to the configured API origin.
2. Connect generation/edit/chat, task metadata editing/deletion and authenticated downloads.
3. Add administrator key CRUD, limits and history controls; refresh session configuration from API.
4. Typecheck/build and verify desktop/mobile layouts and real interaction flows in browser.

## Task 4: Release Engineering

Files: `README.md`, `README.zh-CN.md`, `docs/*`, `.github/workflows/ci.yml`, `Dockerfile`, `compose.yaml`.

1. Document authorization, privacy, deployment, API contracts, limitations and upstream attribution.
2. Add Docker build and unprivileged runtime; bind localhost by default.
3. Run tests, coverage, dependency audits, tree/history secret scans and release-content checks.
4. Create the repository under the authenticated GitHub account only after the release gate passes.

## Task 5: Truthful Media and Publication

Files: `media/render_launch.py`, `docs/launch/*`; generated private evidence under `.evidence/`.

1. Capture the isolated real UI; distinguish offline tests from live paid-provider verification.
2. Render landscape/portrait videos, captions, covers and provenance. Disclose synthetic narration.
3. Verify decoded video, audio and legible frames; publish Release assets.
4. Check platform accounts and publish where authorized/available. Record each platform as published, review-pending, blocked or not submitted with evidence.

## Progress

- Isolation: complete; independent checkout, no production edits or service operations.
- Security/API/UI: complete for the documented Alpha scope; 32 tests, 93% backend coverage.
- Release validation: local builds, dependency audits, source/history secret scans and browser checks passed; public backend/frontend/container CI passed.
- Video: landscape and portrait rendered and decoded; videos, subtitles and covers published as GitHub Release assets.
- Publication: YouTube, Bilibili, Douyin and X published; playback verified on their public pages in the signed-in browser. Xiaohongshu and WeChat Channels are blocked; see `docs/launch/publication.md`.
- Provider verification: deliberately not run; operator chose not to supply credentials.
