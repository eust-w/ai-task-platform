import base64
import io
import secrets
import threading
import time

import httpx
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from platform_api.app import create_app
from platform_api.config import Settings


def png():
    stream = io.BytesIO()
    Image.new("RGB", (8, 8), "teal").save(stream, format="PNG")
    return stream.getvalue()


@pytest.fixture
def setup(tmp_path):
    calls = []

    def upstream(request):
        calls.append(request)
        if request.url.path.endswith("chat/completions"):
            return httpx.Response(
                200, json={"choices": [{"message": {"role": "assistant", "content": "Test response"}}]}
            )
        return httpx.Response(200, json={"data": [{"b64_json": base64.b64encode(png()).decode()}]})

    settings = Settings(
        admin_key=secrets.token_urlsafe(32), provider_key="test-provider-not-a-real-key", data_dir=tmp_path
    )
    app = create_app(settings, transport=httpx.MockTransport(upstream))
    with TestClient(app) as client:
        admin = {"Authorization": f"Bearer {settings.admin_key}"}
        yield client, admin, calls, settings


def user(client, admin, **limits):
    response = client.post("/v1/admin/keys", headers=admin, json={"name": "Test user", **limits})
    assert response.status_code == 201, response.text
    data = response.json()
    return {"Authorization": f"Bearer {data['key']}"}, data


def submit(client, headers, task_id="one", **extra):
    return client.post(
        "/v1/image-tasks/generations",
        headers=headers,
        json={"client_task_id": task_id, "prompt": "A green ceramic cup", **extra},
    )


def finished(client, headers, task_id):
    for _ in range(100):
        tasks = client.get("/v1/tasks", headers=headers, params={"ids": task_id}).json()["items"]
        if tasks and tasks[0]["status"] not in {"queued", "running"}:
            return tasks[0]
        time.sleep(0.02)
    pytest.fail("Task did not finish")


def test_auth_and_key_hashing(setup):
    client, admin, _, settings = setup
    assert client.get("/v1/tasks").status_code == 401
    headers, key = user(client, admin)
    assert client.get("/v1/session", headers=headers).json()["role"] == "user"
    assert client.get("/v1/admin/keys", headers=headers).status_code == 403
    listing = client.get("/v1/admin/keys", headers=admin)
    assert key["key"] not in listing.text
    assert key["key"].encode() not in (settings.data_dir / "platform.sqlite3").read_bytes()
    assert client.patch(f"/v1/admin/keys/{key['id']}", headers=admin, json={"enabled": False}).status_code == 200
    assert client.get("/v1/session", headers=headers).status_code == 401


def test_image_tasks_ownership_idempotency_and_download(setup):
    client, admin, calls, _ = setup
    owner, _ = user(client, admin, min_interval_seconds=0)
    other, _ = user(client, admin)
    response = submit(client, owner)
    assert response.status_code == 202
    task = finished(client, owner, "one")
    assert task["status"] == "success"
    assert len(calls) == 1
    assert submit(client, owner).status_code == 202
    assert len(calls) == 1
    assert submit(client, owner, prompt_override=True).status_code == 422
    assert client.get("/v1/tasks", headers=other).json()["items"] == []
    assert client.patch("/v1/tasks/one", headers=other, json={"title": "stolen"}).status_code == 404
    url = task["data"][0]["url"]
    assert "?" not in url
    assert client.get(url).status_code == 401
    assert client.get(url, headers=other).status_code == 404
    download = client.get(url, headers=owner)
    assert download.status_code == 200
    assert download.headers["content-type"] == "image/png"
    assert download.headers["cache-control"] == "private, no-store"
    assert (
        client.patch("/v1/tasks/one", headers=owner, json={"title": "Cup", "note": "First draft"}).json()["title"]
        == "Cup"
    )
    assert client.delete("/v1/tasks/one", headers=owner).status_code == 200
    assert client.get(url, headers=owner).status_code == 404


def test_multi_reference_edits_and_validation(setup):
    client, admin, calls, _ = setup
    headers, _ = user(client, admin, min_interval_seconds=0)
    response = client.post(
        "/v1/image-tasks/edits",
        headers=headers,
        data={"client_task_id": "edit", "prompt": "Combine these"},
        files=[("image", ("one.png", png(), "image/png")), ("image", ("two.png", png(), "image/png"))],
    )
    assert response.status_code == 202, response.text
    assert finished(client, headers, "edit")["status"] == "success"
    assert calls[-1].content.count(b'name="image[]"') == 2
    bad = client.post(
        "/v1/image-tasks/edits",
        headers=headers,
        data={"client_task_id": "bad", "prompt": "x"},
        files={"image": ("fake.png", b"<script>alert(1)</script>", "image/png")},
    )
    assert bad.status_code == 422
    assert client.post("/v1/image-tasks/edits", headers=headers, json={"image": "http://127.0.0.1/"}).status_code == 415


def test_quota_counts_generation_not_polling(setup):
    client, admin, _, _ = setup
    headers, _ = user(client, admin, daily_quota=1, min_interval_seconds=0)
    assert submit(client, headers).status_code == 202
    assert finished(client, headers, "one")["status"] == "success"
    for _ in range(4):
        assert client.get("/v1/tasks", headers=headers).status_code == 200
    assert submit(client, headers, "two").status_code == 429
    assert submit(client, headers, "one").status_code == 202


def test_rate_limit(setup):
    client, admin, _, _ = setup
    headers, _ = user(client, admin)
    assert submit(client, headers).status_code == 202
    finished(client, headers, "one")
    response = submit(client, headers, "two")
    assert response.status_code == 429
    assert "retry-after" in response.headers


def test_history_off_still_allows_current_task(setup):
    client, admin, _, settings = setup
    headers, _ = user(client, admin)
    assert client.patch("/v1/admin/settings", headers=admin, json={"history_enabled": False}).status_code == 200
    assert submit(client, headers).status_code == 202
    assert finished(client, headers, "one")["status"] == "success"
    data = client.get("/v1/tasks", headers=headers).json()
    assert data == {"items": [], "history_enabled": False}
    assert b"A green ceramic cup" not in (settings.data_dir / "platform.sqlite3").read_bytes()


def test_chat_is_a_task_and_upstream_key_stays_server_side(setup):
    client, admin, calls, settings = setup
    headers, _ = user(client, admin)
    response = client.post(
        "/v1/chat/completions",
        headers=headers,
        json={"messages": [{"role": "user", "content": "Plan a product photo"}]},
    )
    assert response.status_code == 200, response.text
    assert response.json()["choices"][0]["message"]["content"] == "Test response"
    assert settings.provider_key not in response.text
    assert calls[0].headers["authorization"] == f"Bearer {settings.provider_key}"
    tasks = client.get("/v1/tasks", headers=headers).json()["items"]
    assert tasks[0]["mode"] == "chat"
    assert client.get("/v1/image-tasks", headers=headers).json()["items"] == []


def test_missing_provider_is_honest_and_does_not_charge(tmp_path):
    settings = Settings(admin_key=secrets.token_urlsafe(32), data_dir=tmp_path)
    with TestClient(create_app(settings)) as client:
        admin = {"Authorization": f"Bearer {settings.admin_key}"}
        headers, _ = user(client, admin)
        assert client.get("/v1/session", headers=headers).json()["provider_configured"] is False
        assert submit(client, headers).status_code == 503
        assert client.get("/v1/session", headers=headers).json()["daily_usage_count"] == 0


def test_errors_do_not_echo_upstream_secrets(tmp_path):
    settings = Settings(admin_key=secrets.token_urlsafe(32), provider_key="secret-never-echo", data_dir=tmp_path)
    transport = httpx.MockTransport(lambda _: httpx.Response(401, json={"error": "secret-never-echo"}))
    with TestClient(create_app(settings, transport=transport)) as client:
        headers, _ = user(client, {"Authorization": f"Bearer {settings.admin_key}"})
        assert submit(client, headers).status_code == 202
        task = finished(client, headers, "one")
        assert task["status"] == "error"
        assert "secret-never-echo" not in str(task)


def test_settings_reject_unsafe_defaults(tmp_path):
    with pytest.raises(ValueError):
        Settings(admin_key="short", data_dir=tmp_path)
    with pytest.raises(ValueError):
        Settings(admin_key=secrets.token_urlsafe(32), provider_url="http://example.com/v1", data_dir=tmp_path)


def test_concurrency_is_held_until_task_finishes(tmp_path):
    release = threading.Event()
    started = threading.Event()

    def upstream(_):
        started.set()
        release.wait(3)
        return httpx.Response(200, json={"data": [{"b64_json": base64.b64encode(png()).decode()}]})

    settings = Settings(admin_key=secrets.token_urlsafe(32), provider_key="test", data_dir=tmp_path)
    with TestClient(create_app(settings, transport=httpx.MockTransport(upstream))) as client:
        headers, _ = user(client, {"Authorization": f"Bearer {settings.admin_key}"}, min_interval_seconds=0)
        assert submit(client, headers).status_code == 202
        assert started.wait(1)
        try:
            assert submit(client, headers, "two").status_code == 429
        finally:
            release.set()
        assert finished(client, headers, "one")["status"] == "success"
