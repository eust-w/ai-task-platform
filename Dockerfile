FROM node:22-alpine AS web
WORKDIR /build
ENV NEXT_TELEMETRY_DISABLED=1
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run typecheck && npm run build

FROM ghcr.io/astral-sh/uv:0.12.6 AS uv
FROM python:3.13-slim
COPY --from=uv /uv /usr/local/bin/uv
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev
COPY platform_api/ ./platform_api/
COPY --from=web /build/out ./web/out/
RUN useradd --uid 10001 --create-home app && mkdir /app/data && chown app:app /app/data
USER app
ENV ATP_DATA_DIR=/app/data PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
EXPOSE 3310
HEALTHCHECK --interval=30s --timeout=3s CMD ["/app/.venv/bin/python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:3310/health',timeout=2)"]
CMD ["/app/.venv/bin/uvicorn", "platform_api.app:create_app", "--factory", "--host", "0.0.0.0", "--port", "3310", "--no-access-log"]
