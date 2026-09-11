# Farhan AI v1.0 — Personal Career Operating System

Farhan AI is a production-grade personal AI career operating system built with strict groundings, native tool orchestration, browser automation safeguards, voice interactions, background automation, and server-side policy enforcement.

Engineered on **Next.js App Router (Node.js runtime)**, **libsql / SQLite**, and **Drizzle ORM**, Farhan AI delivers an end-to-end career copilot that strictly enforces anti-hallucination guardrails and immutable human approval boundaries.

---

## 🌟 The 9 Primary Workspaces

Farhan AI consolidates all career management capabilities into 9 unified workspaces:

1. **Assistant (`/assistant`)**: Central AI copilot orchestrating all native tools and sub-agents (Opportunities, Research, Career, Knowledge RAG, Computer Control, Automation). Every factual claim is backed by explicit source classifications (`PERSONAL_KNOWLEDGE`, `VERIFIED_MEMORY`, `LIVE_RESEARCH`, `MODEL_KNOWLEDGE`, `INFERENCE`, `UNKNOWN`).
2. **Opportunities (`/opportunities`)**: Real-time opportunity discovery engine with skill-match scoring, verified vs. missing skill breakdown, and company research integration.
3. **Career (`/career`)**: Unified Career Command Center featuring:
   - **Autonomous Workflows**: Multi-step pipeline execution (`career_discovery`, `opportunity_analysis`, `application_preparation`).
   - **Application Pipeline Tracker**: Kanban lifecycle tracking with milestone notes and audit links.
   - **Skill Gap Studio**: Deep capability matching against live market requirements with actionable learning roadmaps.
   - **Mock Interview Room**: Dynamic technical and behavioral interview simulations with STAR feedback.
   - **Career Analytics**: Market intelligence metrics and pipeline conversion analytics.
4. **Knowledge (`/knowledge`)**: RAG document ingestion (PDF, TXT, MD, JSON) and Advanced Personal Memory with 8 categories, confidence levels, verification audits, and strict grounding.
5. **Computer (`/computer`)**: Audited Playwright browser automation with SSRF protection, strict domain allowlisting, interactive action approval cards, credential isolation, and emergency STOP.
6. **Voice (`/voice`)**: Real-time speech interaction pipeline (Speech-to-Text → Central Assistant → Policy Boundary → Text-to-Speech) with strict multi-action approval safety and explicit provider status (`REAL`, `MOCK`, `UNAVAILABLE`).
7. **Automation (`/automation`)**: Autonomous cron-based background jobs (`daily_opportunity_scan`, `weekly_market_report`, `stale_application_check`) with concurrency controls, bounded retries, and crash recovery.
8. **Activity (`/activity`)**: Read-only, immutable audit ledger consuming `/api/audit` with subsystem filtering, security event inspection, and bounded polling.
9. **Settings (`/settings`)**: Strictly sanitized system health and configuration view displaying deployment mode, provider availability, SQLite WAL integrity checks, migration tracking, and server-authorized backup operations.

---

## 🛡️ Security & Integrity Architecture

* **Server-Side Policy Enforcement**: No mutating action or external interaction occurs without server-side validation.
* **Immutable Human Approval Lifecycle**: Sensitive operations (`submit_application`, `send_message`, `export_proposal`, `browser_mutation`) pause execution, generate a cryptographically bound payload, and require explicit operator confirmation.
* **Strict Anti-Hallucination**: Personal facts, qualifications, and credentials are only asserted if verified in SQLite personal memory. Nonexistent qualifications return `UNKNOWN` and cannot be fabricated or passed to browser agents.
* **SSRF & Browser Isolation**: Playwright automation enforces strict domain allowlists, rejects loopback/private IPs, and scrubs credentials before execution.
* **Zero Secret Leakage**: API keys, auth tokens, session cookies, and credentials are scrubbed from settings views, logs, and client telemetry.
* **Complete Audit Trail**: Every tool invocation, human approval, browser action, background job, and authentication event is immutably recorded in `audit_logs`.

---

## 🚀 Quick Start

### Prerequisites
- **Node.js**: v20.x or v22.x+
- **npm**: v10.x+

### Installation

```bash
# Clone and enter the repository
cd "c:/First Agent"

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env.local
```

### Configuration (`.env.local`)

```ini
# Environment
NODE_ENV=development
DEPLOYMENT_MODE=development
PORT=3000

# Authentication (Mandatory in production: >= 16 chars)
FARHAN_AUTH_TOKEN=your_secure_auth_token_here

# AI Providers (At least one recommended; defaults to mock in dev/test)
AI_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash

# Computer Control Security
ALLOWLIST_MODE=strict
COMPUTER_ALLOWLIST=indeed.com,linkedin.com,glassdoor.com,wellfound.com,github.com

# Database
DATABASE_URL=file:./data/farhan_ai.db
```

### Running the Application

```bash
# Start Next.js development server
npm run dev

# Run type checker
npm run type-check

# Run the complete test suite (152+ tests)
npm test

# Build for production
npm run build

# Start production server
npm start
```

Open [http://localhost:3000](http://localhost:3000) to access Farhan AI v1.0.

---

## 🧪 Testing & Verification

Farhan AI includes comprehensive test coverage spanning all 9 objectives and 10 production journeys:

```bash
# Run all unit, agent, workflow, security, and product tests
npm test
```

Test Suites:
- `tests/product/verify-v1-product.test.ts`: 10 core end-to-end user journeys (happy and failure paths).
- `tests/verify-security.test.ts`: Objective 8 security hardening, rate limiting, SSRF, and auth tests.
- `tests/verify-voice.test.ts`: Speech recognition, synthesis, and voice approval safety.
- `tests/verify-automation.test.ts`: Background automation, cron scheduler, and job recovery.
- `tests/verify-computer-control.test.ts`: Browser automation, allowlists, and emergency STOP.
- `tests/verify-workflows.test.ts`: Autonomous career workflows and checkpoint persistence.
- `tests/verify-rag.test.ts`: Vector indexing, document ingestion, and semantic search.
- `tests/verify-agents.test.ts`: Native tool calling, dynamic registry, and Central Assistant.

---

## 📚 Documentation

For in-depth operational and architectural details, consult the `docs/` directory:

- [User Guide](docs/USER_GUIDE.md): Detailed walkthrough of the 9 workspaces and daily career workflows.
- [Architecture](docs/ARCHITECTURE.md): Deep-dive into Central Assistant, Agent Registry, RAG, and Safety boundaries.
- [Security Model](docs/SECURITY.md): Threat model, SSRF protections, auth scope, and anti-hallucination gates.
- [Deployment Guide](docs/DEPLOYMENT.md): Production deployment on Ubuntu/Debian, Systemd, Nginx, and Docker.
- [Operations & Runbook](docs/OPERATIONS.md): Backup automation, disaster recovery, and emergency incident handling.

---

## 📄 License

Proprietary & Confidential — Personal Career Operating System for Farhan. All rights reserved.
