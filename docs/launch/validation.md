# Alpha Release Validation

Date: 2026-10-29. Scope: the standalone open-source distribution only.

## Verified Locally

- 32 pytest tests pass; backend statement coverage 93%.
- Ruff, TypeScript and Next.js static export pass.
- `pip-audit` and `npm audit`: no known vulnerabilities reported at test time.
- Gitleaks scan of the release source tree: no findings. This is not a security certification.
- Docker image builds; isolated container responds to health checks and runs as UID 10001.
- Actual browser: login, refresh requiring re-login, image form, two-file reference selection,
  settings, chat and downloads views. Missing provider configuration returns an explicit error.
- 390x844 mobile viewport has no horizontal page overflow; the active form precedes the task list.
- Video: 1920x1080 and 1080x1920, 30 fps, 59.72 seconds, H.264/AAC, bilingual captions.
  Both files fully decode. Sampled frames checked for text overlap. Audio is non-silent
  and peaks below clipping. Screenshots contain no credentials or customer content.

## Security Boundary

Public distribution does not include credential-bearing third-party canvas links,
browser-persisted keys, account pools, subscription session tokens or arbitrary CLI gateways.
Credentials are pinned to same-origin requests. Artifacts require owner authentication.
Provider errors are sanitized. Uploaded images and upstream results have size/format limits.
Task IDs, ownership, quotas, concurrency, retention and idempotency have regression tests.

## Public Release Gate

[GitHub Actions run 40767587426](https://github.com/eust-w/ai-task-platform/actions/runs/40767587426)
passed the backend, frontend and container jobs for the Alpha release source.
The [release](https://github.com/eust-w/ai-task-platform/releases/tag/v0.1.0-alpha.1)
contains the verified landscape/portrait videos, subtitles and covers.
Public-page playback was verified for YouTube, Bilibili, Douyin and X in a signed-in
browser; anonymous access and every region/device were not independently tested.

## Not Verified / Not Claimed

- No paid-provider image or chat request was executed: no provider key was supplied.
  Provider tests use controlled HTTP transports and are explicitly automated tests.
- No load test, penetration-test certification, HA guarantee or legal compliance certification.
- No changes were made to an existing production deployment. These fixes are not a claim
  that a separate legacy production instance has been patched.
- Social uploads, review acceptance and public playback are separate states; see
  [publication status](publication.md). Private screenshots remain outside Git.
- One known test-only deprecation warning comes from Starlette's current httpx TestClient bridge.
