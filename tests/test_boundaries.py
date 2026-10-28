import io
import secrets
import time

import httpx
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from platform_api.app import create_app
from platform_api.config import Settings
from platform_api.provider import Provider, ProviderError, verified_image
from platform_api.store import Store, digest
from tests.test_platform import finished, png, submit, user


@pytest.fixture
def api(setup):
    return setup


def test_sync_images(setup):
    client, admin, _, _ = setup
    headers, _ = user(client, admin, min_interval_seconds=0)
    response = client.post("/v1/images/generations", headers=headers, json={"prompt": "Cup"})
    assert response.status_code == 200
    assert response.json()["data"][0]["b64_json"]
    response = client.post(
        "/v1/images/edits",
        headers=headers,
        data={"prompt": "Cup", "n": "1", "response_format": "url"},
        files={"image": ("cup.png", png(), "image/png")},
    )
    assert response.status_code == 200
    assert response.json()["data"][0]["url"].startswith("/v1/artifacts/")


def test_mutation_and_model_limits(setup):
    client, admin, _, _ = setup
    headers, key = user(client, admin, min_interval_seconds=0)
    assert submit(client, headers, model="unapproved-model").status_code == 422
    assert submit(client, headers).status_code == 202
    finished(client, headers, "one")
    assert (
        client.post(
            "/v1/image-tasks/generations", headers=headers, json={"client_task_id": "one", "prompt": "Other"}
        ).status_code
        == 409
    )
    response = client.post("/v1/image-tasks/generations", headers=headers, content=b"x" * (256 * 1024 + 1))
    assert response.status_code == 413
    assert client.delete(f"/v1/admin/keys/{key['id']}", headers=admin).status_code == 200
    assert client.get("/v1/tasks", headers=headers).status_code == 401
    assert client.delete("/v1/admin/keys/missing", headers=admin).status_code == 404
    assert client.patch("/v1/admin/keys/missing", headers=admin, json={"name": "Name"}).status_code == 404


def test_validation_redacts_request_and_headers(setup):
    client, admin, _, _ = setup
    response = client.post(
        "/v1/image-tasks/generations", headers=admin, json={"prompt": "sensitive-input", "secret": "sensitive-input"}
    )
    assert response.status_code == 422
    assert "sensitive-input" not in response.text
    response = client.get("/v1/session", headers=admin)
    assert response.headers["referrer-policy"] == "no-referrer"
    assert "frame-ancestors 'none'" in response.headers["content-security-policy"]
    assert client.get("/v1/tasks?ids=" + "x" * 8193, headers=admin).status_code == 422
    assert client.get("/v1/openapi.json", headers=admin).status_code == 200


def test_static_files_and_traversal(tmp_path):
    web = tmp_path / "web"
    web.mkdir()
    (web / "index.html").write_text("Public shell")
    settings = Settings(admin_key=secrets.token_urlsafe(32), data_dir=tmp_path / "data", web_dir=web)
    with TestClient(create_app(settings)) as client:
        assert client.get("/health").json()["status"] == "ok"
        assert client.get("/index.html").text == "Public shell"
        assert client.get("/%2e%2e/platform.sqlite3").status_code == 404
        assert client.get("/data/platform.sqlite3").status_code == 404


def test_history_and_restart_cleanup(tmp_path):
    settings = Settings(admin_key=secrets.token_urlsafe(32), data_dir=tmp_path)
    store = Store(settings)
    admin = {"id": "admin"}
    store.submit(admin, "old", "generate", {"prompt": "private"}, digest("one"))
    with pytest.raises(Exception) as exc:
        store.delete_task("admin", "old")
    assert exc.value.status_code == 409
    store.db.close()
    store = Store(settings)
    assert store.task("admin", "old")["status"] == "error"
    url = store.add_artifact("admin", "old", png())
    store.db.execute("UPDATE tasks SET created=?", (time.time() - 10 * 86400,))
    store.db.commit()
    store.cleanup()
    assert store.tasks("admin", ["old"])["items"] == []
    assert not list(store.artifact_dir.glob("*.png"))
    with pytest.raises(Exception) as exc:
        store.artifact("admin", url.rsplit("/", 1)[-1])
    assert exc.value.status_code == 404
    store.db.close()


def test_queue_bound_and_duplicate_after_daily_reset(tmp_path):
    settings = Settings(admin_key=secrets.token_urlsafe(32), data_dir=tmp_path, max_pending=1)
    store = Store(settings)
    store.submit({"id": "admin"}, "one", "generate", {"prompt": "private"}, digest("one"))
    with pytest.raises(Exception) as exc:
        store.submit({"id": "admin"}, "two", "generate", {}, digest("two"))
    assert exc.value.status_code == 429
    assert store.task("admin", "one")["status"] == "queued"
    store.db.close()


@pytest.mark.parametrize("body", [b"", b"<svg/>", b"hello", b"x" * (12 * 1024 * 1024 + 1)])
def test_image_content_limits(body):
    with pytest.raises(ValueError):
        verified_image(body)


def test_strip_image_metadata():
    raw = io.BytesIO()
    Image.new("RGB", (16, 16)).save(raw, format="JPEG", comment=b"private metadata")
    assert b"private metadata" not in verified_image(raw.getvalue())


@pytest.mark.parametrize(
    "response", [{}, {"data": [{"url": "http://127.0.0.1/private"}]}, {"data": [{"b64_json": "invalid"}]}]
)
def test_never_fetch_provider_image_urls(response):
    settings = Settings(admin_key=secrets.token_urlsafe(32))
    provider = Provider(settings, httpx.MockTransport(lambda _: httpx.Response(200, json=response)))
    try:
        with pytest.raises(ProviderError):
            provider.image({"prompt": "Image"}, [])
    finally:
        provider.client.close()


@pytest.mark.parametrize(
    "url", ["http://example.org", "https://user:password@example.org/v1", "https://example.org/?key=bad"]
)
def test_provider_url_has_no_embedded_secrets(url):
    with pytest.raises(ValueError):
        Settings(admin_key=secrets.token_urlsafe(32), provider_url=url)
