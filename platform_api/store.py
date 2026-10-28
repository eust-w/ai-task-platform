from __future__ import annotations

import hashlib
import hmac
import json
import secrets
import sqlite3
import threading
import time
from datetime import UTC, datetime

from fastapi import HTTPException

from platform_api.config import Settings


def timestamp(value=None):
    return datetime.fromtimestamp(value or time.time(), UTC).isoformat()


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


class Store:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.lock = threading.RLock()
        settings.data_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.artifact_dir = settings.data_dir / "artifacts"
        self.artifact_dir.mkdir(exist_ok=True, mode=0o700)
        self.db = sqlite3.connect(settings.data_dir / "platform.sqlite3", check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        (settings.data_dir / "platform.sqlite3").chmod(0o600)
        with self.db:
            self.db.executescript("""
                PRAGMA foreign_keys=ON;
                PRAGMA secure_delete=ON;
                CREATE TABLE IF NOT EXISTS keys(id TEXT PRIMARY KEY, hash TEXT UNIQUE, name TEXT,
                    enabled INTEGER, daily_quota INTEGER, concurrency_limit INTEGER,
                    min_interval_seconds REAL, usage_day TEXT DEFAULT '', usage_count INTEGER DEFAULT 0,
                    last_submission REAL DEFAULT 0);
                CREATE TABLE IF NOT EXISTS settings(name TEXT PRIMARY KEY, value TEXT);
                CREATE TABLE IF NOT EXISTS tasks(owner TEXT, id TEXT, fingerprint TEXT, mode TEXT, status TEXT,
                    record INTEGER, created REAL, updated REAL, payload TEXT, PRIMARY KEY(owner,id));
                CREATE INDEX IF NOT EXISTS tasks_status ON tasks(status);
                CREATE TABLE IF NOT EXISTS artifacts(id TEXT PRIMARY KEY, owner TEXT, task_id TEXT,
                    FOREIGN KEY(owner,task_id) REFERENCES tasks(owner,id) ON DELETE CASCADE);
            """)
            self.db.execute(
                "INSERT OR IGNORE INTO settings VALUES('history', ?)", (json.dumps(settings.history_enabled),)
            )
            self.db.execute(
                "UPDATE tasks SET status='error', payload=json_set(payload, '$.error', 'Interrupted by restart; not automatically retried to avoid duplicate billing.') WHERE status IN ('queued','running')"
            )

    def history(self):
        with self.lock:
            return bool(json.loads(self.db.execute("SELECT value FROM settings WHERE name='history'").fetchone()[0]))

    def set_history(self, enabled):
        with self.lock, self.db:
            self.db.execute("UPDATE settings SET value=? WHERE name='history'", (json.dumps(enabled),))

    def identity(self, authorization):
        scheme, _, raw = (authorization or "").partition(" ")
        if scheme.lower() != "bearer" or not raw:
            raise HTTPException(401, "A valid platform API key is required.")
        if hmac.compare_digest(digest(raw), digest(self.settings.admin_key)):
            return {"id": "admin", "name": "Administrator", "role": "admin", "daily_usage_count": 0}
        with self.lock:
            row = self.db.execute("SELECT * FROM keys WHERE hash=? AND enabled=1", (digest(raw),)).fetchone()
        if row is None:
            raise HTTPException(401, "Invalid or disabled platform API key.")
        return self.public_key(row)

    def public_key(self, row):
        day = datetime.now(UTC).date().isoformat()
        return {
            "id": row["id"],
            "name": row["name"],
            "role": "user",
            "enabled": bool(row["enabled"]),
            "daily_quota": row["daily_quota"],
            "concurrency_limit": row["concurrency_limit"],
            "min_interval_seconds": row["min_interval_seconds"],
            "daily_usage_count": row["usage_count"] if row["usage_day"] == day else 0,
        }

    def keys(self):
        with self.lock:
            return [self.public_key(row) for row in self.db.execute("SELECT * FROM keys ORDER BY rowid DESC")]

    def create_key(self, body):
        raw, key_id = "atp_" + secrets.token_urlsafe(32), secrets.token_hex(12)
        with self.lock, self.db:
            self.db.execute(
                "INSERT INTO keys(id,hash,name,enabled,daily_quota,concurrency_limit,min_interval_seconds) VALUES(?,?,?,?,?,?,?)",
                (
                    key_id,
                    digest(raw),
                    body["name"],
                    1,
                    body["daily_quota"],
                    body["concurrency_limit"],
                    body["min_interval_seconds"],
                ),
            )
        return {**next(k for k in self.keys() if k["id"] == key_id), "key": raw}

    def update_key(self, key_id, body):
        with self.lock, self.db:
            if not self.db.execute("SELECT id FROM keys WHERE id=?", (key_id,)).fetchone():
                raise HTTPException(404, "Key not found.")
            for field in ("name", "enabled", "daily_quota", "concurrency_limit", "min_interval_seconds"):
                if field in body:
                    self.db.execute(f"UPDATE keys SET {field}=? WHERE id=?", (body[field], key_id))
        return next(k for k in self.keys() if k["id"] == key_id)

    def delete_key(self, key_id):
        with self.lock, self.db:
            if not self.db.execute("DELETE FROM keys WHERE id=?", (key_id,)).rowcount:
                raise HTTPException(404, "Key not found.")

    def submit(self, identity, task_id, mode, body, fingerprint):
        owner, now = identity["id"], time.time()
        with self.lock, self.db:
            old = self.db.execute("SELECT * FROM tasks WHERE owner=? AND id=?", (owner, task_id)).fetchone()
            if old:
                if old["fingerprint"] != fingerprint:
                    raise HTTPException(409, "Task ID already belongs to a different request.")
                return self.public_task(old), False
            active = self.db.execute("SELECT COUNT(*) FROM tasks WHERE status IN ('queued','running')").fetchone()[0]
            if active >= self.settings.max_pending:
                raise HTTPException(429, "Task queue is full.", headers={"Retry-After": "10"})
            if owner != "admin":
                row = self.db.execute("SELECT * FROM keys WHERE id=? AND enabled=1", (owner,)).fetchone()
                if row is None:
                    raise HTTPException(401, "Key has been revoked.")
                day = datetime.now(UTC).date().isoformat()
                used = row["usage_count"] if row["usage_day"] == day else 0
                user_active = self.db.execute(
                    "SELECT COUNT(*) FROM tasks WHERE owner=? AND status IN ('queued','running')", (owner,)
                ).fetchone()[0]
                if used >= row["daily_quota"]:
                    raise HTTPException(429, "Daily request quota reached (UTC).", headers={"Retry-After": "3600"})
                if user_active >= row["concurrency_limit"]:
                    raise HTTPException(429, "Concurrent task limit reached.", headers={"Retry-After": "10"})
                wait = row["min_interval_seconds"] - (now - row["last_submission"])
                if wait > 0:
                    raise HTTPException(
                        429, "Request interval limit reached.", headers={"Retry-After": str(max(1, int(wait) + 1))}
                    )
                self.db.execute(
                    "UPDATE keys SET usage_day=?,usage_count=?,last_submission=? WHERE id=?",
                    (day, used + 1, now, owner),
                )
            record = self.history()
            payload = {
                "title": body.get("prompt", "Conversation")[:80] if record else "Temporary task",
                "prompt_preview": body.get("prompt", "") if record else "",
                "note": "",
                "model": body.get("model"),
                "size": body.get("size"),
                "quality": body.get("quality"),
            }
            self.db.execute(
                "INSERT INTO tasks VALUES(?,?,?,?,?,?,?,?,?)",
                (owner, task_id, fingerprint, mode, "queued", int(record), now, now, json.dumps(payload)),
            )
            return self.task(owner, task_id), True

    def public_task(self, row):
        payload = json.loads(row["payload"])
        return {
            **payload,
            "id": row["id"],
            "mode": row["mode"],
            "status": row["status"],
            "created_at": timestamp(row["created"]),
            "updated_at": timestamp(row["updated"]),
            "elapsed_secs": round(row["updated"] - row["created"], 2),
        }

    def task(self, owner, task_id):
        with self.lock:
            row = self.db.execute("SELECT * FROM tasks WHERE owner=? AND id=?", (owner, task_id)).fetchone()
            if not row:
                raise HTTPException(404, "Task not found.")
            return self.public_task(row)

    def tasks(self, owner, ids, images_only=False):
        with self.lock:
            history = self.history()
            if not history and not ids:
                return {"items": [], "history_enabled": False}
            if ids:
                ids = ids[:100]
                rows = self.db.execute(
                    f"SELECT * FROM tasks WHERE owner=? AND id IN ({','.join('?' for _ in ids)}) ORDER BY created DESC",
                    (owner, *ids),
                ).fetchall()
            else:
                rows = self.db.execute(
                    "SELECT * FROM tasks WHERE owner=? ORDER BY (status IN ('queued','running')) DESC,created DESC LIMIT 500",
                    (owner,),
                ).fetchall()
            rows = [row for row in rows if (row["id"] in ids if ids else row["record"])]
            if images_only:
                rows = [row for row in rows if row["mode"] != "chat"]
            return {"items": [self.public_task(row) for row in rows], "history_enabled": history}

    def update_task(self, owner, task_id, changes, status=None):
        with self.lock, self.db:
            row = self.db.execute("SELECT * FROM tasks WHERE owner=? AND id=?", (owner, task_id)).fetchone()
            if not row:
                raise HTTPException(404, "Task not found.")
            payload = json.loads(row["payload"])
            if not row["record"]:
                changes = {k: v for k, v in changes.items() if k not in {"title", "note", "prompt_preview", "text"}}
            payload.update(changes)
            self.db.execute(
                "UPDATE tasks SET payload=?,status=?,updated=? WHERE owner=? AND id=?",
                (json.dumps(payload), status or row["status"], time.time(), owner, task_id),
            )
            return self.task(owner, task_id)

    def add_artifact(self, owner, task_id, data):
        artifact_id = secrets.token_hex(24)
        path = self.artifact_dir / (artifact_id + ".png")
        with self.lock, self.db:
            path.write_bytes(data)
            path.chmod(0o600)
            try:
                self.db.execute("INSERT INTO artifacts VALUES(?,?,?)", (artifact_id, owner, task_id))
            except Exception:
                path.unlink(missing_ok=True)
                raise
        return f"/v1/artifacts/{artifact_id}"

    def artifact(self, owner, artifact_id):
        with self.lock:
            row = self.db.execute("SELECT id FROM artifacts WHERE owner=? AND id=?", (owner, artifact_id)).fetchone()
            if not row:
                raise HTTPException(404, "Artifact not found.")
            path = self.artifact_dir / (row["id"] + ".png")
            if not path.is_file():
                raise HTTPException(404, "Artifact expired.")
            return path

    def delete_task(self, owner, task_id):
        with self.lock, self.db:
            task = self.task(owner, task_id)
            if task["status"] in {"queued", "running"}:
                raise HTTPException(409, "An active provider request cannot be safely deleted. Wait for completion.")
            for row in self.db.execute("SELECT id FROM artifacts WHERE owner=? AND task_id=?", (owner, task_id)):
                (self.artifact_dir / (row["id"] + ".png")).unlink(missing_ok=True)
            self.db.execute("DELETE FROM tasks WHERE owner=? AND id=?", (owner, task_id))

    def cleanup(self):
        with self.lock:
            now = time.time()
            rows = self.db.execute(
                "SELECT owner,id FROM tasks WHERE status NOT IN ('queued','running') AND ((record=1 AND created<?) OR (record=0 AND created<?))",
                (now - self.settings.retention_days * 86400, now - 3600),
            ).fetchall()
            for row in rows:
                self.delete_task(row["owner"], row["id"])
