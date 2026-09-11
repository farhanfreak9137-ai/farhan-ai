# Farhan AI — Production Deployment Guide

## 1. Architecture Overview

Farhan AI is an autonomous, personal career copilot engineered with strict security boundaries, persistent SQLite storage, and server-side policy controls.

### Architectural Model:
* **Single-Instance Node.js Application**: Built on Next.js App Router (Node.js runtime).
* **Storage**: Embedded SQLite database (`data/farhan_ai.db`) with Write-Ahead Logging (`PRAGMA journal_mode = WAL;`) and 10-second busy timeout for concurrent safety.
* **Rate Limiting**: In-memory sliding-window limiter designed specifically for single-node / single-instance operations. If running behind a reverse proxy, trusted proxy IP evaluation is strictly enforced.
* **Security Boundaries**: Server-side policy engine, immutable human approval gates, SSRF prevention, and token-based authentication protecting all sensitive endpoints.

---

## 2. Environment Configuration

In production, create `.env.local` or pass environment variables through your container orchestrator/systemd unit:

```ini
# Core Environment
NODE_ENV=production
DEPLOYMENT_MODE=production
PORT=3000

# Authentication (Mandatory in production: >= 16 chars, high entropy)
FARHAN_AUTH_TOKEN=sec_f8a9e14d3b76250ca2e838194cf9b071

# Trusted Reverse Proxies (Comma-separated IP addresses)
# Farhan AI ONLY inspects X-Forwarded-For if the direct peer matches this list
TRUSTED_PROXIES=127.0.0.1,10.0.0.1

# Computer Control Safety
ALLOWLIST_MODE=strict
COMPUTER_ALLOWLIST=indeed.com,linkedin.com,glassdoor.com,wellfound.com,github.com

# AI Inference Providers
AI_PROVIDER=gemini
GEMINI_API_KEY=AIzaSy...
GEMINI_MODEL=gemini-2.5-flash

# Storage
DATABASE_URL=file:./data/farhan_ai.db
```

---

## 3. Reverse Proxy Configuration (Nginx Example)

When deploying behind Nginx, configure SSL termination and proxy headers appropriately:

```nginx
server {
    listen 443 ssl http2;
    server_name farhan.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/farhan.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/farhan.yourdomain.com/privkey.pem;

    # Client body limit for document uploads (matches server 10MB limit)
    client_max_body_size 12M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    # Public liveness check for external uptime monitors
    location /api/health {
        proxy_pass http://127.0.0.1:3000/api/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

---

## 4. Production Process Management (PM2 Example)

Use PM2 or systemd to run Farhan AI as a reliable daemon:

```json
{
  "apps": [
    {
      "name": "farhan-ai",
      "script": "node_modules/next/dist/bin/next",
      "args": "start",
      "instances": 1,
      "autorestart": true,
      "watch": false,
      "max_memory_restart": "1G",
      "env": {
        "NODE_ENV": "production",
        "DEPLOYMENT_MODE": "production",
        "PORT": "3000"
      }
    }
  ]
}
```

Start the service:
```bash
npm run build
pm2 start ecosystem.config.json
pm2 save
```

---

## 5. Health and Monitoring Probes

* **Public Liveness Probe**: `GET /api/health`
  * No authentication required.
  * Fast 200 OK response with uptime and timestamp.
  * Used by load balancers, Kubernetes liveness probes, or external monitoring services.

* **Readiness Probe**: `GET /api/ready`
  * Requires authentication in production (`Authorization: Bearer <FARHAN_AUTH_TOKEN>`).
  * Validates SQLite database connection (`SELECT 1`), database integrity (`PRAGMA integrity_check`), migration status, and disk write permissions.
  * Returns `200 OK` when fully healthy, or `503 Service Unavailable` if any check fails.

---

## 6. Pre-Flight Production Checklist

- [ ] `NODE_ENV=production` and `DEPLOYMENT_MODE=production` set.
- [ ] `FARHAN_AUTH_TOKEN` configured with a cryptographically random secret (>= 16 chars).
- [ ] `TRUSTED_PROXIES` configured to match your reverse proxy IP addresses.
- [ ] Automated database backup cron configured (see `docs/OPERATIONS.md`).
- [ ] Persistent directory `data/` mounted on persistent storage.
- [ ] Next.js production build succeeded (`npm run build`).
- [ ] All verification test suites passing (`npm test`).
