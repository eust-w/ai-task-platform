# AI Task Platform

**A self-hosted workspace for image creation, reference-image editing and text conversations.**

[简体中文](README.zh-CN.md) · [API](docs/api.md) · [Deployment](docs/deployment.md) · [Security](SECURITY.md) · [Provenance](NOTICE.md)

> **Alpha.** Bring your own authorized provider API key. No shared subscriptions,
> account pools or scraping. The current release has automated contract/security
> tests and real browser UI checks; paid-provider generation was not run for this
> release because no provider credentials were supplied. No simulated outputs are
> presented as real generations.

![AI Task Platform workspace](docs/images/workspace.jpg)

## Alpha Release and Video

[Download v0.1.0-alpha.1](https://github.com/eust-w/ai-task-platform/releases/tag/v0.1.0-alpha.1)
includes the introduction videos, subtitles and covers.
Watch on [YouTube](https://www.youtube.com/watch?v=YGa4kcTBZ9s) or
[Bilibili](https://www.bilibili.com/video/BV1gms96TE8j/).
See [validation](docs/launch/validation.md) and [publication status](docs/launch/publication.md)
for the tested scope, public links and remaining platform blockers.

## What It Does

- **Create and edit images:** text-to-image and up to eight uploaded references.
- **Run conversations:** text-only Chat Completions with per-request task records.
- **Manage work:** task status, search, rename, notes, deletion and authenticated downloads.
- **Control access:** generated user keys, daily request quotas, concurrency and submission intervals.
- **Choose retention:** history on/off, automatic expiry and no persistent browser credentials.
- **Own the deployment:** a static Next.js console, FastAPI workers and private SQLite/files.

The practical focus is the complete task lifecycle around an authorized API, not
another subscription gateway. The console never receives the provider credential.

## Start Locally

Requirements: Python 3.12+, [uv](https://docs.astral.sh/uv/), Node.js 22+, macOS or Linux.

```sh
git clone https://github.com/eust-w/ai-task-platform.git
cd ai-task-platform
uv sync --dev
uv run python scripts/bootstrap.py
npm --prefix web ci
npm --prefix web run build
uv run uvicorn platform_api.app:create_app --factory --host 127.0.0.1 --port 3310 --no-access-log
```

Open **http://127.0.0.1:3310/api-console/**. Bootstrap creates a local `.env` with a
random `ATP_ADMIN_KEY`; use that key to sign in and create ordinary user keys.
Keys are revealed only once. Keep `.env` private.

Without `OPENAI_API_KEY`, login, key management and preferences work, but generation
returns HTTP 503. To enable real generation, configure your own authorized key and
available `ATP_IMAGE_MODEL` / `ATP_CHAT_MODEL` in `.env`, then restart. Default models
are examples of documented models, not a guarantee of access for your account.
Model usage may incur fees. An OpenAI-compatible endpoint is not automatically
authorized or fully compatible; check its terms and supported response format.

## Docker

After creating `.env`:

```sh
docker compose up --build -d
docker compose logs -f
```

The port binds to localhost by default; the container runs as an unprivileged user.
Put an HTTPS reverse proxy in front for remote access. Never expose the data volume
as a static directory. See [deployment modes](docs/deployment.md).

## Architecture

```text
Browser (platform key held in memory)
   -> same-origin FastAPI /v1/*
      -> authenticated admission: quota / interval / concurrency
      -> bounded worker queue
         -> operator-configured HTTPS provider API
      -> SQLite task metadata + owner-protected artifact files
```

| Area | Directory |
| --- | --- |
| API, provider boundary, storage | `platform_api/` |
| React user console | `web/src/app/api-console/` |
| Contract and security tests | `tests/` |
| Deployment and API guides | `docs/` |
| Reproducible introduction video | `media/` |

## Boundaries

This is a **single-process Alpha**, not a distributed queue or high-availability
service. Interrupted requests are marked failed, not automatically replayed (to
avoid duplicate charges). There is no automatic provider failover or quota evasion.

Current API compatibility is intentionally bounded: one image per request,
non-streaming text chat, configured models only. Responses API, tool execution,
PPT/PSD, Codex CLI gateways, S3/SFTP offload and account registration are not included.
Reference images remain in process memory until the task finishes; their normalized
bytes are sent to the selected provider. See [retention and privacy](SECURITY.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Useful contributions include authorized
provider compatibility tests, accessibility, streaming chat, backup/restore and a
durable distributed worker design. Please propose a design before broad changes.

## License and Origin

MIT, with the original `Copyright (c) 2026 kunkun` retained. The user console is
derived from [basketikun/chatgpt2api](https://github.com/basketikun/chatgpt2api), with
new platform-specific security and provider wiring. See [NOTICE.md](NOTICE.md) for
the import boundary and upstream README wording. This is not an official OpenAI
product. Open-source code does not grant rights to external services or trademarks.
