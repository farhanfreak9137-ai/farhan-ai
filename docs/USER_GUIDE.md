# Farhan AI v1.0 — User Guide

Welcome to **Farhan AI v1.0**, your personal AI career operating system. Farhan AI is designed to serve as an intelligent, autonomous, and safe career copilot.

This guide walks you through the 9 primary workspaces, explaining how each system operates and how you can maximize your daily career productivity.

---

## 🧭 Navigation & Overview

The top navigation bar provides instant access to the 9 core areas of the operating system:

| Workspace | Purpose | Key Subsystems |
| :--- | :--- | :--- |
| **Assistant** | Central conversational copilot | Native tool orchestration, grounded Q&A, source provenance |
| **Opportunities** | Job discovery and skill matching | Verified match scoring, gap analysis, company research |
| **Career** | Autonomous workflows & pipeline | Multi-step pipelines, Kanban tracker, interview room, analytics |
| **Knowledge** | RAG documents & personal memory | Document ingestion, memory categories, verification confidence |
| **Computer** | Audited browser automation | Allowlisted navigation, interactive approval cards, Emergency STOP |
| **Voice** | Spoken interface & voice commands | STT, Central Assistant bridge, audio feedback, approval safety |
| **Automation** | Background scheduled jobs | Autonomous monitors, cron schedules, job runs, retry management |
| **Activity** | Immutable system audit ledger | Subsystem event filters, security log inspection, bounded refresh |
| **Settings** | Sanitized health & backup controls | SQLite WAL status, safe provider status, server-side backup creation |

---

## 1. 🤖 Assistant Workspace

The Assistant is your primary hub for conversational interaction. Powered by the Central Assistant engine, it dynamically detects your intent and invokes specialized tools via the Agent Registry.

### Grounding & Source Transparency
Farhan AI never presents speculation as fact. Every answer containing factual claims includes explicit source classifications:

- `[PERSONAL_KNOWLEDGE]`: Directly retrieved from your ingested resumes, portfolio docs, or career records.
- `[VERIFIED_MEMORY]`: Retrieved from verified personal memory items stored in SQLite.
- `[LIVE_RESEARCH]`: Retrieved from live web queries with source citations and timestamps.
- `[MODEL_KNOWLEDGE]`: General reasoning provided by the underlying LLM.
- `[INFERENCE]`: Logical deductions made by analyzing multiple facts.
- `[UNKNOWN]`: Explicitly returned when a required qualification or fact is missing from your verified profile.

### Multi-Agent Tool Orchestration
You can ask the Assistant to perform complex actions across any subsystem without leaving the chat:
- *"Find senior TypeScript and AI engineering roles in tech hubs"*
- *"Run a skill gap analysis for Stripe against my verified resume"*
- *"Research OpenAI's engineering culture and recent leadership updates"*
- *"Open indeed.com and find remote Next.js opportunities"*

---

## 2. 🎯 Opportunities Workspace

The Opportunity Hub constantly monitors and evaluates career opportunities tailored to your profile.

### Interpreting Match Scores
- **Overall Match Score (0–100%)**: Calculated deterministically based on your verified skills, experience level, and preferences.
- **Matching Skills (Green)**: Factual capabilities found in your verified profile.
- **Missing Skills (Red/Amber)**: Requirements listed in the job description that are NOT found in your profile.
- **Source Grounding**: Every opportunity links to its original posting domain with retrieval timestamps.

### One-Click Actions
- **Analyze Gap**: Sends the opportunity to the **Skill Gap Studio** for a detailed breakdown.
- **Company Research**: Triggers the Research Agent to fetch company news, financials, and culture.
- **Track**: Adds the opportunity directly to your **Application Pipeline Tracker**.

---

## 3. 🚀 Career Command Center

The Career view consolidates five core career management tools into a single tabbed interface:

### 3.1 Autonomous Workflows
Multi-step, state-machine-driven career pipelines:
- **`career_discovery`**: Scans market channels, matches against verified profile, and ranks opportunities.
- **`opportunity_analysis`**: Analyzes a job posting, verifies skill coverage, and identifies gaps.
- **`application_preparation`**: Gathers company research, personal proof points, drafts tailored proposal, and halts at the **Human Approval Gate** before export.

*Checkpoints are persisted in SQLite, allowing workflows to resume seamlessly after system restarts.*

### 3.2 Application Pipeline Tracker
A structured Kanban board tracking your active applications across 6 stages:
`SAVED` → `PREPARING` → `APPLIED` → `INTERVIEWING` → `OFFER` → `ARCHIVED`

Each card stores:
- Role and company details
- Match score at time of application
- Notes, contact names, and next milestone dates
- Direct link to the audit trail for actions taken on that application

### 3.3 Skill Gap Studio
Deep-dive comparison between your verified skillset and target job roles. Generates:
- Precise capability match percentage
- Critical missing skills categorized by priority
- Custom learning roadmap with recommended study topics and project ideas

### 3.4 Mock Interview Room
Interactive interview preparation powered by your actual candidate profile:
- Simulates realistic technical, behavioral, and architectural interview rounds
- Evaluates answers using the **STAR method** (Situation, Task, Action, Result)
- Provides actionable scoring and specific feedback for improvements

### 3.5 Career Analytics
Holistic view of your career pipeline health:
- Stage-by-stage conversion metrics
- Skill demand distribution across discovered opportunities
- Time-in-stage tracking to identify stalled applications

---

## 4. 📚 Knowledge & Memory Workspace

Farhan AI’s personal memory system ensures your copilot knows your background intimately without hallucinating.

### Document Ingestion (RAG)
- Supports `.pdf`, `.txt`, `.md`, and `.json` documents.
- Ingestion pipeline extracts text streams, chunks content deterministically with semantic boundaries, and computes vector embeddings.
- Full-text and vector cosine similarity search allows instant recall of previous projects, publications, and accomplishments.

### Advanced Personal Memory
Stores structured career facts across 8 dedicated categories:
1. `IDENTITY`: Core career title, years of experience, professional summary.
2. `SKILLS`: Languages, frameworks, tools, and seniority levels.
3. `EXPERIENCE`: Roles, companies, responsibilities, and verified achievements.
4. `EDUCATION`: Degrees, certifications, and institutions.
5. `PREFERENCES`: Desired salary, remote work preferences, target roles.
6. `RESTRICTIONS`: Do-not-contact companies, non-competes, location boundaries.
7. `ACHIEVEMENTS`: Key metrics (e.g. revenue generated, latency reduced).
8. `METRICS`: Quantitative career milestones.

*Each memory item tracks confidence level (0.0–1.0) and verification status. If you update a preference, the older conflicting record is superseded with an audit record.*

---

## 5. 💻 Computer Control Workspace

Farhan AI can automate browser workflows (navigating job boards, researching companies, filling forms) with strict security boundaries.

### Safety Guarantees
- **Strict SSRF Protection**: Only domains in the configured allowlist (e.g., `linkedin.com`, `indeed.com`, `glassdoor.com`) are accessible. Requests to loopback (`127.0.0.1`, `localhost`) or private networks (`10.0.0.0/8`, `192.168.0.0/16`) are blocked server-side.
- **Interactive Approval Cards**: Read-only actions (navigation, taking screenshots, reading page text) execute safely. Any mutating action (typing input, clicking submit, uploading resumes) generates an interactive **Action Approval Card** requiring operator confirmation.
- **Credential Protection**: The browser agent never receives or interacts with raw passwords or personal secrets.
- **Emergency STOP**: Clicking the red **Emergency STOP** button immediately terminates all active Playwright browser contexts, aborts running actions, and writes an emergency audit log.

---

## 6. 🎙️ Voice Workspace

The Voice interface enables hands-free voice conversations with Farhan AI:

### Operation
1. Click **Start Listening** to speak your request.
2. Farhan AI transcribes your speech via Speech-to-Text (STT).
3. The prompt is dispatched to the Central Assistant, which analyzes intent and invokes tools.
4. The response is synthesized via Text-to-Speech (TTS) and spoken aloud.

### Voice Safety Guardrails
- **Provider Transparency**: The UI clearly shows whether your voice provider is `REAL`, `MOCK`, or `UNAVAILABLE`.
- **Approval Safety**: Saying *"approve"* or *"yes, do it"* only confirms an action if **exactly one** approval is pending. If zero or multiple actions are pending, the command is safely rejected to prevent accidental approvals.

---

## 7. ⏱️ Automation Workspace

Farhan AI runs scheduled background tasks to keep your career pipeline up to date without manual effort.

### Default Scheduled Jobs
- **Daily Opportunity Scan (`0 8 * * *`)**: Queries job boards for high-match opportunities matching your verified skills.
- **Weekly Market Report (`0 9 * * 1`)**: Synthesizes emerging tech requirements and trending roles.
- **Stale Application Check (`0 10 * * 3`)**: Identifies applications with no movement for 14+ days.

### Controls & Safeguards
- **Concurrency Limits**: Jobs are queued and executed within strict concurrency limits to prevent system overload.
- **Bounded Retries**: Failing jobs retry up to 3 times with exponential backoff before transitioning to `FAILED`.
- **Pause / Resume**: Easily pause any scheduled job from the UI.
- **Manual Trigger**: Click "Run Now" to trigger an immediate execution cycle.

---

## 8. 📊 Activity Workspace

The Activity Center provides an immutable audit log of everything occurring across Farhan AI.

- **Subsystem Filters**: Filter events by `Assistant`, `Career`, `Computer`, `Automation`, `Voice`, `Knowledge`, or `Security`.
- **Event Inspection**: Click any event to inspect timestamps, actor IDs, request payloads, and security classifications.
- **Tamper-Proof**: Audit logs are read-only and written directly to SQLite; entries cannot be edited or deleted from the UI.
- **Safe Polling**: Bounded auto-refresh updates the log every 30 seconds without excessive database overhead.

---

## 9. ⚙️ Settings Workspace

The Settings view provides real-time system diagnostics and backup controls while strictly safeguarding sensitive credentials.

### System Diagnostics
- **Deployment Mode**: Displays whether the system is running in `development` or `production`.
- **Database Health**: Real-time SQLite WAL checkpoint and integrity check status.
- **Migration State**: Tracks all applied schema versions (`001_baseline_schema`, `002_audit_logs`).
- **Provider Status**: Displays safe availability indicators for Gemini, OpenAI, and Local providers without revealing API keys.

### Server-Side Verified Backup
- Click **Create Backup** to trigger a server-side verified SQLite backup.
- The server validates authorization, forces a WAL checkpoint (`PRAGMA wal_checkpoint(TRUNCATE)`), verifies database integrity (`PRAGMA integrity_check`), computes a SHA-256 checksum, and records an audit event.
- Backups are stored safely in `data/backups/`.

---

## 📅 Recommended Daily Workflow

For the ultimate career copilot experience, follow this daily 10-minute routine:

1. **Morning Review (Automation & Opportunities)**:
   - Check the **Activity** log to see what the morning `daily_opportunity_scan` discovered.
   - Review new job postings in **Opportunities**; star high-match roles (>80%).
2. **Analysis & Gap Review (Career)**:
   - Send top opportunities to the **Skill Gap Studio** to identify any unfamiliar libraries or frameworks.
   - Use the **Mock Interview Room** to practice a 5-minute STAR-format response for required domain concepts.
3. **Application Preparation (Workflows & Assistant)**:
   - Run the `application_preparation` workflow for a selected role.
   - Review the generated proposal draft and approve the export.
   - Log the application in the **Application Pipeline Tracker**.
4. **End-of-Day Backup (Settings)**:
   - Check system health in **Settings** and ensure backups are verified.
