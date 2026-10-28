from __future__ import annotations

import base64
import io
import warnings

import httpx
from PIL import Image, UnidentifiedImageError

from platform_api.config import Settings

MAX_IMAGE_BYTES = 12 * 1024 * 1024
MAX_PIXELS = 20_000_000


class ProviderError(Exception):
    """Only deliberately sanitized error text may be returned to a user."""


def verified_image(data: bytes) -> bytes:
    if not data or len(data) > MAX_IMAGE_BYTES:
        raise ValueError("Image must be nonempty and at most 12 MiB.")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as image:
                if image.format not in {"PNG", "JPEG", "WEBP"} or image.width * image.height > MAX_PIXELS:
                    raise ValueError("Use PNG, JPEG or WebP with at most 20 million pixels.")
                image.load()
                output = io.BytesIO()
                image.convert("RGBA" if "A" in image.getbands() else "RGB").save(output, format="PNG")
                normalized = output.getvalue()
                if len(normalized) > MAX_IMAGE_BYTES:
                    raise ValueError("Normalized image exceeds 12 MiB.")
                return normalized
    except (UnidentifiedImageError, OSError, Image.DecompressionBombWarning, Image.DecompressionBombError) as exc:
        raise ValueError("Invalid or oversized image content.") from exc


class Provider:
    def __init__(self, settings: Settings, transport=None):
        self.settings = settings
        self.client = httpx.Client(
            base_url=settings.provider_url.rstrip("/") + "/",
            headers={"Authorization": f"Bearer {settings.provider_key}"},
            timeout=httpx.Timeout(300, connect=10),
            follow_redirects=False,
            trust_env=False,
            transport=transport,
        )

    def request(self, path: str, **kwargs):
        try:
            # Stream the transport response to enforce a bound before JSON decoding.
            with self.client.stream("POST", path, **kwargs) as response:
                if response.status_code != 200:
                    raise ProviderError(
                        f"Provider rejected the request (HTTP {response.status_code}). Check provider access, model and billing."
                    )
                chunks = bytearray()
                for chunk in response.iter_bytes():
                    chunks.extend(chunk)
                    if len(chunks) > 20 * 1024 * 1024:
                        raise ProviderError("Provider response exceeded the size limit.")
                import json

                payload = json.loads(chunks)
                if not isinstance(payload, dict):
                    raise ValueError("invalid JSON object")
                return payload
        except httpx.TimeoutException as exc:
            raise ProviderError(
                "Provider timed out. Check your provider account before retrying; billing may have occurred."
            ) from exc
        except (httpx.HTTPError, ValueError) as exc:
            raise ProviderError("Provider returned an invalid response or could not be reached.") from exc

    def image(self, body: dict, images: list[bytes]):
        data = {
            "model": self.settings.image_model,
            "prompt": body["prompt"],
            "n": 1,
            "size": body.get("size") or "1024x1024",
            "quality": body.get("quality") or "auto",
        }
        if images:
            payload = self.request(
                "images/edits",
                data={k: str(v) for k, v in data.items()},
                files=[("image[]", (f"reference-{i}.png", value, "image/png")) for i, value in enumerate(images)],
            )
        else:
            payload = self.request("images/generations", json=data)
        try:
            # URL-only responses are intentionally not fetched: no upstream SSRF surface.
            encoded = payload["data"][0]["b64_json"]
            if not isinstance(encoded, str) or len(encoded) > 17 * 1024 * 1024:
                raise ValueError("invalid image size")
            return verified_image(base64.b64decode(encoded, validate=True))
        except (KeyError, IndexError, TypeError, ValueError) as exc:
            raise ProviderError("Provider did not return a supported base64 image.") from exc

    def chat(self, messages: list[dict]):
        payload = self.request(
            "chat/completions",
            json={
                "model": self.settings.chat_model,
                "messages": messages,
                "stream": False,
                "store": False,
                "max_completion_tokens": 4096,
            },
        )
        try:
            content = payload["choices"][0]["message"]["content"]
            if not isinstance(content, str) or len(content) > 100_000:
                raise ValueError("invalid content")
            return content
        except (KeyError, IndexError, TypeError, ValueError) as exc:
            raise ProviderError("Provider did not return a text response.") from exc
