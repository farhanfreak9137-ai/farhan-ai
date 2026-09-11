# Farhan AI v1.0 — Security Model & Threat Boundary

Security, provenance integrity, and operator control are foundational tenets of Farhan AI. Farhan AI is built so that autonomous capabilities never bypass server-side security policies.

---

## 1. Authentication & Authorization Boundaries

In `production` mode, Farhan AI enforces token-based authentication across **all sensitive API endpoints**, covering both mutating and data-retrieval routes.

### 1.1 Endpoint Protection Scope
- **Protected Endpoints (Require `Authorization: Bearer <token>`)**:
  - `/api/chat` (Conversational inference and tool execution)
  - `/api/profile` (Candidate personal data)
  - `/api/memory` (Personal memory retrieval and updates)
  - `/api/documents/*` (Ingested documents and RAG vector search)
  - `/api/opportunities/*` (Career opportunity data)
  - `/api/applications/*` (Job application pipeline tracking)
  - `/api/workflows/*` (Autonomous workflow execution and step checkpoints)
  - `/api/computer/*` (Playwright browser automation and approvals)
  - `/api/voice/*` (Audio transcription, speech synthesis, and voice commands)
  - `/api/automation/*` (Background cron schedules and job runs)
  - `/api/audit` (System-wide audit logs)
  - `/api/backup` (Database backup creation and metadata)
  - `/api/diagnostics` (System readiness and migration metadata)
- **Intentionally Public Endpoints**:
  - `/api/health` (Liveness check returning basic operational status)
  - `/api/ready` (Sanitized readiness check indicating database and migration status without secrets)

### 1.2 Token Validation Invariants
- In `production` mode, `FARHAN_AUTH_TOKEN` must be configured with at least 16 characters and sufficient entropy.
- Requests without a valid Bearer token receive an immediate `401 Unauthorized` response.
- Authorization is strictly validated **server-side**; UI visibility states are never trusted for authorization.

---

## 2. Immutable Human Approval Lifecycle

Any operation capable of altering external state, submitting applications, or modifying sensitive data enforces an immutable approval boundary.

```text
Tool Invocation (e.g. generate_proposal)
  ↓
Policy Engine Check (isMutation: true, requiresHumanApproval: true)
  ↓
Check Approval Context (isHumanApproved === true?)
  ├── NO  → Pause execution; generate HumanApprovalPayload; emit PENDING audit event.
  └── YES → Validate approval token & signature; proceed to execution; emit COMPLETED audit event.
```

### Supported Action Types
- `submit_application`: Direct submission of a job application.
- `send_message`: Outbound communication to recruiters or contacts.
- `export_proposal`: Exporting tailored cover letters or proposals.
- `browser_mutation`: Executing form inputs or button clicks via Computer Control.
- `database_backup`: Initiating full database snapshots and WAL checkpoints.

### Voice & Multi-Approval Invariant
When approving actions via voice commands (*"approve"*, *"yes, do it"*), approval is granted **ONLY IF EXACTLY ONE** approval is pending. If zero or multiple approvals exist, the voice interface rejects the request to eliminate ambiguity.

---

## 3. Strict Anti-Hallucination & Provenance

Farhan AI strictly prevents the fabrication of candidate achievements, skills, or credentials.

### 3.1 Standardized Source Classifications
Every fact asserted by the assistant or workflows must carry one of the 6 canonical provenance classes:
1. `PERSONAL_KNOWLEDGE`: Ingested from verified user resumes, documents, or portfolio files.
2. `VERIFIED_MEMORY`: Sourced from the SQLite `personal_memory` table with explicit verification flags.
3. `LIVE_RESEARCH`: Retrievable from live web searches with validated URLs and timestamps.
4. `MODEL_KNOWLEDGE`: General reasoning from underlying foundation models.
5. `INFERENCE`: Deductions explicitly derived from verified facts.
6. `UNKNOWN`: Returned when a required credential or qualification is missing from the candidate's profile.

### 3.2 Negative Constraints & Boundary Tests
- If an opportunity requires a skill (e.g. *AWS Certified Solutions Architect*) not present in the verified profile, the engine records it as `MISSING` rather than hallucinating familiarity.
- Nonexistent qualifications (e.g. *commercial airline pilot license*) return empty/unknown results.
- Under no circumstances can fabricated personal data be injected into cover letter proposals or passed to browser automation agents.

---

## 4. Computer Control & SSRF Protections

Browser automation poses significant security risks if left unconstrained. Farhan AI implements multiple layers of network and execution isolation:

### 4.1 Server-Side Request Forgery (SSRF) Prevention
Before Playwright loads any URL:
1. **URL Parsing**: Protocol must be strictly `http:` or `https:`.
2. **DNS Resolution**: The hostname is resolved to its underlying IP address.
3. **IP Range Validation**: The target IP is checked against forbidden ranges:
   - Loopback addresses (`127.0.0.0/8`, `::1`)
   - Private RFC 1918 networks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`)
   - Link-local and cloud metadata addresses (`169.254.169.254`, `fe80::/10`)
4. **Domain Allowlisting**: In `strict` mode, the domain must match an entry in `COMPUTER_ALLOWLIST` (e.g., `indeed.com`, `linkedin.com`, `glassdoor.com`, `wellfound.com`, `github.com`).

### 4.2 Credential Isolation
- Browser automation agents do not have access to plaintext user passwords or master authentication tokens.
- Navigation headers strip session tokens and authorization secrets before initiating third-party requests.

### 4.3 Emergency STOP
- A hardware-style emergency stop button is exposed in the UI and via `POST /api/computer/stop`.
- Invocation instantly terminates the active Playwright context, kills Chromium child processes, marks running actions as `CANCELLED`, and logs an emergency audit record.

---

## 5. Rate Limiting & Denial-of-Service Protection

Farhan AI incorporates an in-memory sliding-window rate limiter designed for single-instance Node.js deployments:

- **Sliding Window Tracking**: Tracks requests over a 60-second window per IP or token.
- **Trusted Proxy Awareness**: `X-Forwarded-For` headers are ONLY honored if the immediate peer IP is explicitly enumerated in `TRUSTED_PROXIES`.
- **429 Response**: When thresholds are exceeded, the server returns `429 Too Many Requests` with standard `Retry-After` headers.

---

## 6. Secret Sanitization & Leakage Prevention

Sensitive credentials must never appear in client-facing API responses, logs, or UI dashboards:

- **Settings View**: Exposes safe booleans (`hasGeminiKey`, `hasOpenAiKey`) and sanitized model names (`gemini-2.5-flash`), but never raw API keys, cookies, or authorization tokens.
- **Audit Logs**: Request bodies containing sensitive fields (`password`, `token`, `secret`, `apiKey`) are sanitized before being committed to SQLite.
- **Error Handlers**: Server-side error handlers strip stack traces and database connection strings in production mode.

---

## 7. Audit Logging & Non-Repudiation

Every significant operation is immutably recorded in the `audit_logs` table:

```sql
CREATE TABLE audit_logs (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    subsystem TEXT NOT NULL,
    action TEXT NOT NULL,
    status TEXT NOT NULL,
    details_json TEXT,
    created_at INTEGER NOT NULL
);
```

- **Read-Only from UI**: Audit logs cannot be modified, edited, or deleted through the client interface or public API.
- **Subsystem Coverage**: Records actions across `Assistant`, `Career`, `Computer`, `Automation`, `Voice`, `Knowledge`, and `Security`.
