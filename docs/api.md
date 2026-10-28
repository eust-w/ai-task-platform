# API Reference

All `/v1/*` endpoints require `Authorization: Bearer $ATP_USER_KEY`. This is a
platform key, not an upstream provider key. Authenticated OpenAPI: `/v1/openapi.json`.

## Supported Compatibility Surface

| Method | Route | Behavior |
| --- | --- | --- |
| GET | `/v1/session` | Identity, limits, history and provider configuration state |
| GET | `/v1/models` | Operator-configured model allowlist, not proof of provider access |
| POST | `/v1/images/generations` | Synchronous image generation, one result |
| POST | `/v1/images/edits` | Synchronous multipart edit, 1-8 images |
| POST | `/v1/chat/completions` | Non-streaming text messages; system/user/assistant roles |
| POST | `/v1/image-tasks/generations` | Asynchronous generation, HTTP 202 |
| POST | `/v1/image-tasks/edits` | Asynchronous multipart edit, HTTP 202 |
| GET | `/v1/tasks` | Current owner's image and chat tasks, newest 500 with active tasks first |
| GET | `/v1/image-tasks` | Image-only task listing |
| PATCH | `/v1/tasks/{id}` | Update title and note |
| DELETE | `/v1/tasks/{id}` | Delete terminal task and artifact; active tasks return 409 |
| GET | `/v1/artifacts/{id}` | Authenticated image download; private/no-store |

Tool calls, streaming, Responses API, PPT/PSD, arbitrary models, remote reference
URLs and URL-only provider image responses are not implemented in this Alpha.

## Async Image Generation

```sh
curl http://127.0.0.1:3310/v1/image-tasks/generations \
  -H "Authorization: Bearer $ATP_USER_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"client_task_id":"product-photo-1","prompt":"A green ceramic cup on a white table","size":"1024x1024","quality":"auto"}'
```

Poll `GET /v1/tasks?ids=product-photo-1`. Status is queued/running/success/error.
On success, `data[0].url` is a relative authenticated artifact path. Do not paste
a key into its query string; download with the same Authorization header.

Client task IDs accept 1-80 ASCII letters, digits, hyphens and underscores.
Resubmitting the same owner/ID/payload returns the existing task without charging
the platform quota again. Different payload with the same ID returns 409. The
idempotency window ends when the task is deleted or expires.

## Multi-image Editing

```sh
curl http://127.0.0.1:3310/v1/image-tasks/edits \
  -H "Authorization: Bearer $ATP_USER_KEY" \
  -F client_task_id=product-edit-1 \
  -F prompt='Use the product shape from the first reference and the palette from the second.' \
  -F image=@product.png -F image=@palette.jpg
```

PNG/JPEG/WebP only, maximum 8 references, 12 MiB each, 24 MiB aggregate, 20 million
pixels each. Filenames are not used as filesystem paths. The synchronous route
also accepts `response_format=b64_json` (default) or `url`, and `n=1` only.

## Chat

```sh
curl http://127.0.0.1:3310/v1/chat/completions \
  -H "Authorization: Bearer $ATP_USER_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"Write three product photo concepts."}],"stream":false}'
```

Up to 40 messages, 16,000 characters per message and 64,000 total. The backend
uses its configured model, sends `store:false`, and caps completion tokens at 4096.
Provider-specific terms and retention still apply.

## Administration

Administrator key required: `GET/POST /v1/admin/keys`,
`PATCH/DELETE /v1/admin/keys/{id}`, `PATCH /v1/admin/settings`.

New key body: `{"name":"Designer","daily_quota":50,"concurrency_limit":1,"min_interval_seconds":10}`.
The raw key appears once in the creation response. List/update never return it.
History switch body: `{"history_enabled":false}`. See [retention details](../SECURITY.md).

Quotas count admitted generation/chat requests, not polling or downloads. They
reset at UTC midnight. Failed upstream attempts still count. Responses: 401 invalid
key, 403 wrong role, 404 missing/non-owned resource, 409 conflict/active deletion,
413 body limit, 415 wrong media type, 422 validation/model mismatch, 429 limit,
502 provider failure, 503 provider not configured. Never assume a retry is free.
