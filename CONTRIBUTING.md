# Contributing

Start with a focused issue or a small pull request. Keep provider integrations within
documented, authorized APIs. Do not submit account scraping, automated registration,
cookie extraction, quota evasion or shared-subscription gateways.

Setup: `uv sync --dev`, then `npm --prefix web ci`.

Run before a pull request:

```sh
uv run ruff check platform_api tests scripts
uv run pytest --cov=platform_api --cov-fail-under=80
npm --prefix web run typecheck
npm --prefix web run build
uv run pip-audit
npm --prefix web audit --audit-level=moderate
```

Use explicit test doubles only under tests. Never add a production fake-success
fallback. Include tests for tenant isolation and input bounds when changing APIs.
Do not attach .env files, real user images, browser storage or production logs.
Retain upstream attribution in `NOTICE.md` and `LICENSE`.
