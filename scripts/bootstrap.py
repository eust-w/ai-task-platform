"""Create local-only configuration without overwriting existing settings."""

import secrets
from pathlib import Path

root = Path(__file__).resolve().parents[1]
target = root / ".env"
if target.exists():
    print(".env already exists; no changes made.")
else:
    template = (root / ".env.example").read_text()
    content = template.replace("ATP_ADMIN_KEY=\n", f"ATP_ADMIN_KEY={secrets.token_urlsafe(36)}\n")
    with target.open("x") as stream:
        stream.write(content)
    target.chmod(0o600)
    print("Created .env with a random local admin key. No provider credentials configured.")
