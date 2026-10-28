from __future__ import annotations

import base64
import fcntl
import hashlib
import json
import secrets
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from starlette.datastructures import Headers, UploadFile

from platform_api.config import Settings
from platform_api.provider import MAX_IMAGE_BYTES, Provider, ProviderError, verified_image
from platform_api.store import Store, digest


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ImageRequest(StrictModel):
    client_task_id: str = Field(default_factory=lambda: secrets.token_hex(16), pattern=r"^[a-zA-Z0-9_-]{1,80}$")
    prompt: str = Field(min_length=1, max_length=16000)
    model: str | None = None
    size: Literal["auto", "1024x1024", "1024x1536", "1536x1024"] = "1024x1024"
    quality: Literal["auto", "low", "medium", "high"] = "auto"


class SyncImageRequest(ImageRequest):
    n: Literal[1] = 1
    response_format: Literal["b64_json", "url"] = "b64_json"


class Message(StrictModel):
    role: Literal["system", "user", "assistant"]
    content: str = Field(min_length=1, max_length=16000)


class ChatRequest(StrictModel):
    model: str | None = None
    messages: list[Message] = Field(min_length=1, max_length=40)
    stream: Literal[False] = False


class KeyCreate(StrictModel):
    name: str = Field(min_length=1, max_length=80)
    daily_quota: int = Field(default=50, ge=1, le=10000)
    concurrency_limit: int = Field(default=1, ge=1, le=8)
    min_interval_seconds: float = Field(default=10, ge=0, le=3600)


class KeyUpdate(StrictModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    enabled: bool | None = None
    daily_quota: int | None = Field(default=None, ge=1, le=10000)
    concurrency_limit: int | None = Field(default=None, ge=1, le=8)
    min_interval_seconds: float | None = Field(default=None, ge=0, le=3600)


class Metadata(StrictModel):
    title: str = Field(default="", max_length=120)
    note: str = Field(default="", max_length=1000)


class Preferences(StrictModel):
    history_enabled: bool


class BoundaryMiddleware:
    def __init__(self, app, store_getter):
        self.app, self.store_getter = app, store_getter

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        headers = Headers(scope=scope)
        if scope["path"].startswith("/v1/"):
            try:
                identity = self.store_getter().identity(headers.get("authorization"))
                scope.setdefault("state", {})["identity"] = identity
            except HTTPException as exc:
                return await JSONResponse({"detail": exc.detail}, exc.status_code)(scope, receive, send)
        # Buffer only mutation bodies, with an absolute cap even for chunked requests.
        if scope["method"] in {"POST", "PATCH", "PUT"}:
            limit = 26 * 1024 * 1024 if headers.get("content-type", "").startswith("multipart/") else 256 * 1024
            body = bytearray()
            while True:
                message = await receive()
                if message["type"] == "http.disconnect":
                    return
                body.extend(message.get("body", b""))
                if len(body) > limit:
                    return await JSONResponse({"detail": "Request body exceeds the size limit."}, 413)(
                        scope, receive, send
                    )
                if not message.get("more_body", False):
                    break
            delivered = False

            async def buffered():
                nonlocal delivered
                if delivered:
                    return await receive()
                delivered = True
                return {"type": "http.request", "body": bytes(body), "more_body": False}
        else:
            buffered = receive

        async def secure_send(message):
            if message["type"] == "http.response.start":
                message.setdefault("headers", []).extend(
                    [
                        (b"x-content-type-options", b"nosniff"),
                        (b"referrer-policy", b"no-referrer"),
                        (b"x-frame-options", b"DENY"),
                        (b"permissions-policy", b"camera=(), microphone=(), geolocation=()"),
                        (
                            b"content-security-policy",
                            b"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
                        ),
                    ]
                )
                if scope["path"].startswith("/v1/"):
                    message["headers"].append((b"cache-control", b"private, no-store"))
            await send(message)

        await self.app(scope, buffered, secure_send)


def create_app(settings: Settings | None = None, *, transport=None) -> FastAPI:
    settings = settings or Settings.from_env()
    store = None
    provider = None
    executor = None

    @asynccontextmanager
    async def lifespan(app):
        nonlocal store, provider, executor
        settings.data_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
        with (settings.data_dir / ".server.lock").open("a") as lock_file:
            try:
                fcntl.flock(lock_file, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError as exc:
                raise RuntimeError(
                    "Use a single server process per data directory. Horizontal workers are not supported."
                ) from exc
            store = Store(settings)
            provider = Provider(settings, transport=transport)
            executor = ThreadPoolExecutor(max_workers=settings.workers, thread_name_prefix="atp-worker")
            stop = threading.Event()

            def housekeeping():
                while not stop.wait(60):
                    store.cleanup()

            store.cleanup()
            cleanup_thread = threading.Thread(target=housekeeping, daemon=True)
            cleanup_thread.start()
            app.state.store = store
            try:
                yield
            finally:
                stop.set()
                cleanup_thread.join(timeout=2)
                await run_in_threadpool(executor.shutdown, wait=True)
                provider.client.close()
                store.db.close()

    app = FastAPI(
        title="AI Task Platform",
        version="0.1.0-alpha.1",
        lifespan=lifespan,
        docs_url=None,
        redoc_url=None,
        openapi_url="/v1/openapi.json",
    )
    app.add_middleware(BoundaryMiddleware, store_getter=lambda: store)
    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=list(settings.cors_origins),
            allow_methods=["GET", "POST", "PATCH", "DELETE"],
            allow_headers=["Authorization", "Content-Type"],
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error(_, exc):
        # Pydantic's default response can echo credentials/content submitted in a malformed body.
        return JSONResponse(
            {"detail": [{"loc": list(e["loc"]), "msg": e["msg"], "type": e["type"]} for e in exc.errors()]}, 422
        )

    def admin(request):
        identity = request.state.identity
        if identity["role"] != "admin":
            raise HTTPException(403, "Administrator access required.")

    def model_check(model, kind):
        expected = settings.chat_model if kind == "chat" else settings.image_model
        if model and model not in {"auto", expected}:
            raise HTTPException(422, "Model is not in the operator's configured allowlist.")
        return expected

    def perform(owner, task_id, mode, body, images):
        store.update_task(owner, task_id, {}, "running")
        try:
            if mode == "chat":
                text = provider.chat(body["messages"])
                store.update_task(owner, task_id, {"text": text}, "success")
                return {
                    "id": task_id,
                    "object": "chat.completion",
                    "created": int(time.time()),
                    "model": settings.chat_model,
                    "choices": [
                        {"index": 0, "message": {"role": "assistant", "content": text}, "finish_reason": "stop"}
                    ],
                }
            image = provider.image(body, images)
            url = store.add_artifact(owner, task_id, image)
            return store.update_task(owner, task_id, {"data": [{"url": url}]}, "success")
        except ProviderError as exc:
            store.update_task(owner, task_id, {"error": str(exc)}, "error")
            return None
        except Exception:
            store.update_task(
                owner, task_id, {"error": "Task failed while processing the result. Contact the operator."}, "error"
            )
            return None

    def enqueue(request, body, mode, images=None):
        if not settings.provider_key:
            raise HTTPException(503, "Provider not configured. The operator must supply an authorized API key.")
        body["model"] = model_check(body.get("model"), mode)
        owner = request.state.identity["id"]
        task_id = body.pop("client_task_id", None) or secrets.token_hex(16)
        images = images or []
        fingerprint = digest(
            json.dumps(body, sort_keys=True) + mode + "".join(hashlib.sha256(x).hexdigest() for x in images)
        )
        task, fresh = store.submit(request.state.identity, task_id, mode, body, fingerprint)
        future = executor.submit(perform, owner, task_id, mode, body, images) if fresh else None
        return task, future

    @app.get("/health")
    def health():
        return {"status": "ok", "version": app.version}

    @app.get("/v1/session")
    def session(request: Request):
        return {
            **request.state.identity,
            "history_enabled": store.history(),
            "provider_configured": bool(settings.provider_key),
            "image_model": settings.image_model,
            "chat_model": settings.chat_model,
            "max_reference_images": 8,
        }

    @app.get("/v1/models")
    def models():
        return {
            "object": "list",
            "data": [
                {"id": x, "object": "model", "owned_by": "configured-provider"}
                for x in {settings.image_model, settings.chat_model}
            ],
        }

    @app.get("/v1/tasks")
    @app.get("/v1/image-tasks")
    def tasks(request: Request, ids: str = ""):
        if len(ids) > 8192:
            raise HTTPException(422, "Too many task IDs.")
        return store.tasks(
            request.state.identity["id"], ids.split(",") if ids else [], request.url.path.endswith("image-tasks")
        )

    @app.post("/v1/image-tasks/generations", status_code=202)
    def generate(body: ImageRequest, request: Request):
        return enqueue(request, body.model_dump(), "generate")[0]

    async def parse_edit(request, sync=False):
        if not request.headers.get("content-type", "").startswith("multipart/form-data"):
            raise HTTPException(415, "Use multipart/form-data with uploaded images, not remote URLs.")
        async with request.form(max_files=8, max_fields=8, max_part_size=32768) as form:
            try:
                raw = {k: v for k, v in form.items() if k not in {"image", "image[]"}}
                schema = SyncImageRequest if sync else ImageRequest
                if sync and "n" in raw:
                    raw["n"] = int(raw["n"])
                body = schema.model_validate(raw).model_dump()
            except (ValidationError, ValueError) as exc:
                raise HTTPException(422, "Invalid image-edit fields.") from exc
            uploads = form.getlist("image") + form.getlist("image[]")
            if not 1 <= len(uploads) <= 8 or any(not isinstance(x, UploadFile) for x in uploads):
                raise HTTPException(422, "Upload between 1 and 8 reference images.")
            images, total = [], 0
            for upload in uploads:
                data = await upload.read(MAX_IMAGE_BYTES + 1)
                total += len(data)
                if total > 24 * 1024 * 1024:
                    raise HTTPException(413, "Reference images exceed 24 MiB in total.")
                try:
                    images.append(await run_in_threadpool(verified_image, data))
                except ValueError as exc:
                    raise HTTPException(422, str(exc)) from exc
            return body, images

    @app.post("/v1/image-tasks/edits", status_code=202)
    async def edit(request: Request):
        body, images = await parse_edit(request)
        task, _ = enqueue(request, body, "edit", images)
        return task

    @app.post("/v1/images/generations")
    def sync_generate(body: SyncImageRequest, request: Request):
        payload = body.model_dump(exclude={"n", "response_format"})
        task, future = enqueue(request, payload, "generate")
        if future:
            future.result()
        return image_response(request, task["id"], body.response_format)

    def image_response(request, task_id, response_format):
        task = store.task(request.state.identity["id"], task_id)
        if task["status"] != "success":
            raise HTTPException(502 if task["status"] == "error" else 409, task.get("error", "Task is still running."))
        if response_format == "url":
            return {"created": int(time.time()), "data": task["data"]}
        artifact_id = task["data"][0]["url"].rsplit("/", 1)[1]
        data = store.artifact(request.state.identity["id"], artifact_id).read_bytes()
        return {"created": int(time.time()), "data": [{"b64_json": base64.b64encode(data).decode()}]}

    @app.post("/v1/images/edits")
    async def sync_edit(request: Request):
        body, images = await parse_edit(request, sync=True)
        response_format = body.pop("response_format")
        body.pop("n")
        task, future = enqueue(request, body, "edit", images)
        if future:
            await run_in_threadpool(future.result)
        return await run_in_threadpool(image_response, request, task["id"], response_format)

    @app.post("/v1/chat/completions")
    def chat(body: ChatRequest, request: Request):
        if sum(len(m.content) for m in body.messages) > 64000:
            raise HTTPException(422, "Conversation exceeds 64,000 characters.")
        payload = body.model_dump()
        payload["prompt"] = body.messages[-1].content
        _, future = enqueue(request, payload, "chat")
        response = future.result()
        if response is None:
            raise HTTPException(502, "Provider chat request failed. Check task status.")
        return response

    @app.patch("/v1/tasks/{task_id}")
    @app.patch("/v1/image-tasks/{task_id}")
    def update_task(task_id: str, body: Metadata, request: Request):
        return store.update_task(request.state.identity["id"], task_id, body.model_dump())

    @app.delete("/v1/tasks/{task_id}")
    @app.delete("/v1/image-tasks/{task_id}")
    def delete_task(task_id: str, request: Request):
        store.delete_task(request.state.identity["id"], task_id)
        return {"ok": True}

    @app.get("/v1/artifacts/{artifact_id}")
    def artifact(artifact_id: str, request: Request):
        path = store.artifact(request.state.identity["id"], artifact_id)
        return FileResponse(
            path, media_type="image/png", filename=f"{artifact_id}.png", content_disposition_type="inline"
        )

    @app.get("/v1/admin/keys")
    def keys(request: Request):
        admin(request)
        return {"items": store.keys()}

    @app.post("/v1/admin/keys", status_code=201)
    def create_key(body: KeyCreate, request: Request):
        admin(request)
        return store.create_key(body.model_dump())

    @app.patch("/v1/admin/keys/{key_id}")
    def update_key(key_id: str, body: KeyUpdate, request: Request):
        admin(request)
        return store.update_key(key_id, body.model_dump(exclude_none=True))

    @app.delete("/v1/admin/keys/{key_id}")
    def delete_key(key_id: str, request: Request):
        admin(request)
        store.delete_key(key_id)
        return {"ok": True}

    @app.patch("/v1/admin/settings")
    def preferences(body: Preferences, request: Request):
        admin(request)
        store.set_history(body.history_enabled)
        return {"history_enabled": store.history()}

    @app.get("/")
    def root():
        return RedirectResponse("/api-console/")

    @app.get("/{path:path}", include_in_schema=False)
    def web(path: str):
        root = settings.web_dir.resolve()
        target = (root / path).resolve()
        if not target.is_relative_to(root):
            raise HTTPException(404, "Not found.")
        if target.is_dir():
            target = target / "index.html"
        if not target.is_file():
            raise HTTPException(404, "Not found. Build the frontend first if needed.")
        return FileResponse(target)

    return app
