# Deployment

## One Host (Recommended for the Alpha)

Serve the static frontend and API from the same FastAPI process, either directly
or through the included Docker Compose configuration. The backend listens on
3310, avoiding common ports used by unrelated installations. Keep one process per
data directory. Never use Uvicorn `--workers` greater than one.

SQLite and artifacts live in `ATP_DATA_DIR` (private local directory, or the Docker
named volume). Keep SQLite on a local reliable filesystem. Back up this directory
with the service stopped; protect backups as confidential user data. Configuration
and provider credentials are in `.env`, not in SQLite.

## HTTPS Reverse Proxy

Use a domain you own and a trusted TLS certificate. Nginx example (replace all
placeholders, obtain the certificate through your own ACME setup):

```nginx
server {
    listen 443 ssl;
    server_name ai.example.com;
    ssl_certificate /etc/letsencrypt/live/ai.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ai.example.com/privkey.pem;
    client_max_body_size 26m;
    location / {
        proxy_pass http://127.0.0.1:3310;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 360s;
        proxy_buffering off;
    }
}
```

Add your own connection limits, abuse monitoring and backup policy before making
the service public. Do not cache `/v1/*`. Keep Authorization headers out of logs.
Redirect HTTP to HTTPS. Do not forward provider keys through URLs.

## Server Frontend, Private Execution Host

The frontend can be hosted on a public reverse-proxy machine while the API stays
on a private execution host, connected by an operator-managed VPN or SSH tunnel.
Proxy `/v1/*` to that host and serve `web/out` at the same public origin. Use an SSH
remote forwarding listener bound to server loopback, never a public raw API port.

This topology is supported by same-origin API paths; this repository does not
provision a cloud host, tunnel, DNS, TLS certificate or automatic remote storage.
Files and metadata remain on the API execution host in this Alpha. Do not describe
this as cloud storage offload or high availability.

## Provider Network

`OPENAI_BASE_URL` defaults to the official HTTPS API. It is operator-only config,
not a user-supplied proxy URL. Credentials embedded in URLs and HTTP endpoints
are rejected. Automatic HTTP redirects and ambient proxy variables are disabled
to prevent accidental credential forwarding. Run the backend on a network with
authorized, direct provider access. Provider-specific protocol compatibility and
terms must be verified independently for custom URLs.

## Upgrade and Recovery

Stop the isolated instance, back up private data, update code and dependencies,
run tests, rebuild static files, then restart. Do not copy production data into
a public release directory. Interrupted queued/running tasks become errors on
restart; check provider billing before submitting a new task.

If a key is compromised, disable/delete it in Settings and create a new one. If
the administrator key is compromised, generate a new random `ATP_ADMIN_KEY` in
`.env` and restart. Do not publish it in a support issue or recording.
