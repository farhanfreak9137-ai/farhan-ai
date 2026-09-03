import { Client } from '@libsql/client';
import { defaultProfile } from '@/data/defaultProfile';
import { runMigrations } from './migrations';

/**
 * Ensures all tables exist and initial verified seed records are populated if empty.
 */
export async function bootstrapDatabase(client: Client): Promise<void> {
  // 0. Enable WAL mode and concurrency busy timeout for safe parallel test runners
  try {
    await client.execute('PRAGMA journal_mode = WAL;');
    await client.execute('PRAGMA busy_timeout = 10000;');
  } catch (err) {
    // Ignore if not supported in in-memory or specific remote environment
  }

  // 1. Create tables
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      added_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      company TEXT NOT NULL,
      role TEXT NOT NULL,
      location TEXT NOT NULL,
      work_model TEXT NOT NULL,
      status TEXT NOT NULL,
      match_score INTEGER NOT NULL,
      salary_range TEXT,
      notes TEXT,
      proposal_draft TEXT,
      applied_date TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS opportunities (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      company TEXT NOT NULL,
      location TEXT NOT NULL,
      work_model TEXT NOT NULL,
      salary_range TEXT,
      description TEXT NOT NULL,
      required_skills TEXT NOT NULL,
      url TEXT,
      posted_at TEXT NOT NULL,
      source TEXT,
      retrieved_at TEXT,
      external_id TEXT
    );

    CREATE TABLE IF NOT EXISTS interview_results (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      question TEXT NOT NULL,
      user_answer TEXT NOT NULL,
      overall_score INTEGER NOT NULL,
      clarity_score INTEGER NOT NULL,
      technical_depth_score INTEGER NOT NULL,
      strengths TEXT NOT NULL,
      improvements TEXT NOT NULL,
      feedback_summary TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS monitored_alerts (
      id TEXT PRIMARY KEY,
      opportunity_id TEXT NOT NULL,
      opportunity_data TEXT NOT NULL,
      status TEXT NOT NULL,
      detected_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      current_step INTEGER NOT NULL DEFAULT 0,
      input TEXT NOT NULL,
      output TEXT,
      error TEXT,
      approval_payload TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workflow_steps (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      step_index INTEGER NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL,
      agent TEXT,
      tool TEXT,
      input TEXT,
      output TEXT,
      error TEXT,
      started_at TEXT,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS document_chunks (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      page INTEGER,
      source TEXT NOT NULL,
      token_estimate INTEGER NOT NULL,
      embedding TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS memory_events (
      id TEXT PRIMARY KEY,
      memory_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS computer_actions (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      action TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
      result TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS automation_jobs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL,
      schedule TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'SCHEDULED',
      enabled INTEGER NOT NULL DEFAULT 1,
      task_type TEXT NOT NULL,
      task_payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      next_run_at TEXT,
      last_run_at TEXT,
      last_result TEXT,
      failure_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS automation_runs (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      result TEXT,
      error TEXT,
      steps TEXT
    );

    CREATE TABLE IF NOT EXISTS automation_approvals (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      run_id TEXT NOT NULL,
      action_id TEXT,
      action_type TEXT NOT NULL,
      reason TEXT NOT NULL,
      requested_action TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      created_at TEXT NOT NULL,
      expires_at TEXT
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      data TEXT,
      read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);

  // Incremental schema migration for existing SQLite databases
  const safeAlterColumns = [
    'ALTER TABLE opportunities ADD COLUMN source TEXT;',
    'ALTER TABLE opportunities ADD COLUMN retrieved_at TEXT;',
    'ALTER TABLE opportunities ADD COLUMN external_id TEXT;',
    'ALTER TABLE documents ADD COLUMN filename TEXT;',
    'ALTER TABLE documents ADD COLUMN source TEXT;',
    'ALTER TABLE documents ADD COLUMN size INTEGER;',
    'ALTER TABLE documents ADD COLUMN checksum TEXT;',
    'ALTER TABLE documents ADD COLUMN status TEXT;',
    'ALTER TABLE documents ADD COLUMN metadata TEXT;',
    'ALTER TABLE documents ADD COLUMN updated_at TEXT;',
    'ALTER TABLE memories ADD COLUMN source TEXT;',
    'ALTER TABLE memories ADD COLUMN confidence REAL;',
    'ALTER TABLE memories ADD COLUMN verified INTEGER;',
    'ALTER TABLE memories ADD COLUMN status TEXT;',
    'ALTER TABLE memories ADD COLUMN superseded_by TEXT;',
    'ALTER TABLE memories ADD COLUMN supersedes TEXT;',
    'ALTER TABLE memories ADD COLUMN expires_at TEXT;',
    'ALTER TABLE memories ADD COLUMN source_document_id TEXT;',
    'ALTER TABLE memories ADD COLUMN source_conversation_id TEXT;',
    'ALTER TABLE memories ADD COLUMN updated_at TEXT;',
  ];
  for (const sql of safeAlterColumns) {
    try {
      await client.execute(sql);
    } catch {
      // Column already exists or already up to date
    }
  }

  // 2. Seed profile if empty
  const profileCount = await client.execute('SELECT COUNT(*) as count FROM profiles;');
  if (Number(profileCount.rows[0]?.count || 0) === 0) {
    await client.execute({
      sql: 'INSERT INTO profiles (id, data, updated_at) VALUES (?, ?, ?);',
      args: ['main', JSON.stringify(defaultProfile), defaultProfile.updatedAt],
    });
  }

  // 3. Seed documents if empty
  const docCount = await client.execute('SELECT COUNT(*) as count FROM documents;');
  if (Number(docCount.rows[0]?.count || 0) === 0 && defaultProfile.documents.length > 0) {
    for (const doc of defaultProfile.documents) {
      await client.execute({
        sql: 'INSERT OR IGNORE INTO documents (id, title, type, content, added_at) VALUES (?, ?, ?, ?, ?);',
        args: [doc.id, doc.title, doc.type, doc.content, doc.addedAt],
      });
    }
  }

  // 4. Seed applications if empty
  const appCount = await client.execute('SELECT COUNT(*) as count FROM applications;');
  if (Number(appCount.rows[0]?.count || 0) === 0) {
    const initialApps = [
      {
        id: 'app-1',
        company: 'Nexus Cognitive Lab',
        role: 'Senior AI Systems Engineer',
        location: 'Remote (Worldwide)',
        workModel: 'remote',
        status: 'interviewing',
        matchScore: 94,
        salaryRange: '$145,000 - $180,000 USD',
        notes: 'Completed initial architectural discussion. Next step: Deep dive on agent tool calling and error failovers.',
        proposalDraft: 'Tailored proposal highlighting 45% latency reduction and multi-provider failovers submitted.',
        appliedDate: '2026-09-08',
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'app-2',
        company: 'Hyperion AI',
        role: 'Staff Agentic Systems Developer',
        location: 'Remote (Worldwide)',
        workModel: 'remote',
        status: 'saved',
        matchScore: 91,
        salaryRange: '$160,000 - $210,000 USD',
        notes: 'Identified strong alignment with Python, TypeScript, and RAG context injection.',
        appliedDate: null,
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'app-3',
        company: 'Apex Cloud Platforms',
        role: 'Full-Stack Software Architect',
        location: 'Remote (US/EU)',
        workModel: 'remote',
        status: 'applied',
        matchScore: 88,
        salaryRange: '$135,000 - $165,000 USD',
        notes: 'Submitted resume highlighting Next.js App Router migrations.',
        appliedDate: '2026-09-05',
        updatedAt: new Date().toISOString(),
      },
    ];

    for (const app of initialApps) {
      await client.execute({
        sql: `INSERT INTO applications (id, company, role, location, work_model, status, match_score, salary_range, notes, proposal_draft, applied_date, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        args: [
          app.id,
          app.company,
          app.role,
          app.location,
          app.workModel,
          app.status,
          app.matchScore,
          app.salaryRange ?? null,
          app.notes ?? null,
          (app as any).proposalDraft ?? null,
          app.appliedDate ?? null,
          app.updatedAt
        ],
      });
    }
  }

  // 5. Seed memories if empty
  const memCount = await client.execute('SELECT COUNT(*) as count FROM memories;');
  if (Number(memCount.rows[0]?.count || 0) === 0) {
    const initialMems = [
      {
        id: 'mem-1',
        category: 'interview_feedback',
        title: 'Nexus Cognitive Lab Initial Screen',
        content: 'Hiring manager was impressed by Farhan\'s quantified achievements (45% latency reduction via autonomous workflows and Next.js App Router migrations). Recommended emphasizing agentic tool calling in the next technical round.',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'mem-2',
        category: 'negotiation_goal',
        title: 'Target Compensation & Autonomy',
        content: 'Targeting base compensation of $150,000+ USD with equity for senior AI roles. Key non-negotiables: 100% remote flexibility and ownership over agentic architecture.',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'mem-3',
        category: 'career_reflection',
        title: 'Architectural Philosophy',
        content: 'Always advocate for type-safe interfaces (Zod/TypeScript), multi-provider failover, and strict factual boundaries before pushing LLMs to production.',
        createdAt: new Date().toISOString(),
      },
    ];

    for (const mem of initialMems) {
      await client.execute({
        sql: 'INSERT INTO memories (id, category, title, content, created_at) VALUES (?, ?, ?, ?, ?);',
        args: [mem.id, mem.category, mem.title, mem.content, mem.createdAt],
      });
    }
  }

  // 6. Seed opportunities if empty
  const oppCount = await client.execute('SELECT COUNT(*) as count FROM opportunities;');
  if (Number(oppCount.rows[0]?.count || 0) === 0) {
    const initialOpps = [
      {
        id: 'opp-1',
        title: 'Senior AI Systems Engineer',
        company: 'Nexus Cognitive Lab',
        location: 'Remote (Worldwide)',
        workModel: 'remote',
        salaryRange: '$145,000 - $180,000 USD',
        requiredSkills: ['TypeScript', 'LLM Orchestration & Prompt Engineering', 'Function & Tool Calling', 'Next.js (App Router)', 'PostgreSQL'],
        description: 'Lead the architecture of production-grade autonomous agent pipelines, streaming LLM interfaces, and multi-model failover systems.',
        url: 'https://careers.nexuslab.ai/senior-ai-engineer',
        postedAt: '2 days ago',
      },
      {
        id: 'opp-2',
        title: 'Full-Stack Software Architect',
        company: 'Apex Cloud Platforms',
        location: 'Remote (US / EU Timezones)',
        workModel: 'remote',
        salaryRange: '$135,000 - $165,000 USD',
        requiredSkills: ['TypeScript', 'Next.js (App Router)', 'React', 'Node.js', 'PostgreSQL', 'Docker'],
        description: 'Architect scalable web applications, serverless microservices, and event-driven data streaming platforms.',
        url: 'https://careers.apexcloud.io/architect',
        postedAt: '3 days ago',
      },
      {
        id: 'opp-3',
        title: 'Staff Agentic Systems Developer',
        company: 'Hyperion AI',
        location: 'Remote (Worldwide)',
        workModel: 'remote',
        salaryRange: '$160,000 - $210,000 USD',
        requiredSkills: ['Python', 'TypeScript', 'RAG & Vector Context Injection', 'Function & Tool Calling', 'Multi-Model Fallbacks & Routing'],
        description: 'Design autonomous multi-agent systems, self-correcting prompt engines, and developer-first AI tools.',
        url: 'https://hyperion.ai/jobs/staff-agentic-dev',
        postedAt: '1 day ago',
      },
      {
        id: 'opp-4',
        title: 'Senior Frontend & AI Platform Engineer',
        company: 'Pulse AI Studio',
        location: 'Remote (Flexible)',
        workModel: 'remote',
        salaryRange: '$125,000 - $155,000 USD',
        requiredSkills: ['React', 'Next.js (App Router)', 'JavaScript (ESNext)', 'HTML5 & Modern CSS', 'REST & Streaming APIs'],
        description: 'Craft high-performance, accessible user interfaces with real-time SSE streaming, glassmorphism designs, and AI chat interfaces.',
        url: 'https://pulseai.dev/careers',
        postedAt: '4 days ago',
      },
    ];

    for (const opp of initialOpps) {
      await client.execute({
        sql: `INSERT INTO opportunities (id, title, company, location, work_model, salary_range, description, required_skills, url, posted_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        args: [opp.id, opp.title, opp.company, opp.location, opp.workModel, opp.salaryRange, opp.description, JSON.stringify(opp.requiredSkills), opp.url, opp.postedAt],
      });
    }
  }

  // 7. Seed monitored alerts if empty
  const alertCount = await client.execute('SELECT COUNT(*) as count FROM monitored_alerts;');
  if (Number(alertCount.rows[0]?.count || 0) === 0) {
    const defaultAlert = {
      id: 'alert-1',
      opportunityId: 'opp-auto-1',
      opportunityData: {
        id: 'opp-auto-1',
        title: 'Principal Agentic Systems Architect',
        company: 'Aether Cognitive Labs',
        location: 'Remote (Worldwide)',
        workModel: 'remote' as const,
        salaryRange: '$170,000 - $220,000 USD',
        matchScore: 96,
        matchReason: 'Direct match for TypeScript, LLM Orchestration, and Autonomous Agent Architecture.',
        requiredSkills: ['TypeScript', 'LLM Orchestration', 'Multi-Model Fallbacks', 'PostgreSQL'],
        description: 'Lead engineering for self-healing agent pipelines and enterprise autonomous developer tools.',
        postedAt: 'Just now',
      },
      status: 'new' as const,
      detectedAt: new Date().toISOString(),
    };

    await client.execute({
      sql: 'INSERT INTO monitored_alerts (id, opportunity_id, opportunity_data, status, detected_at) VALUES (?, ?, ?, ?, ?);',
      args: [defaultAlert.id, defaultAlert.opportunityId, JSON.stringify(defaultAlert.opportunityData), defaultAlert.status, defaultAlert.detectedAt],
    });
  }

  // 8. Run tracked migrations to ensure schema versioning and audit tables are current
  await runMigrations(client);
}

