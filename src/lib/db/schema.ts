import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { UserProfile } from '@/types/profile';
import { OpportunityItem } from '@/types/tools';

/**
 * Profiles Table:
 * Stores Farhan's structured candidate profile.
 */
export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(),
  data: text('data', { mode: 'json' }).$type<UserProfile>().notNull(),
  updatedAt: text('updated_at').notNull(),
});

/**
 * Documents Table:
 * Ingested CVs, cover letters, markdown project specs, and notes.
 */
export const documents = sqliteTable('documents', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  filename: text('filename'),
  type: text('type').notNull(), // 'cv' | 'cover_letter' | 'project_spec' | 'note' | 'certification' | 'txt' | 'md' | 'json' | 'pdf'
  content: text('content').notNull(),
  source: text('source'),
  size: integer('size'),
  checksum: text('checksum'),
  status: text('status'), // 'unindexed' | 'indexing' | 'indexed' | 'failed'
  metadata: text('metadata', { mode: 'json' }),
  addedAt: text('added_at').notNull(),
  updatedAt: text('updated_at'),
});

/**
 * Document Chunks Table:
 * Granular document text chunks with deterministic token estimates and embeddings for vector retrieval.
 */
export const documentChunks = sqliteTable('document_chunks', {
  id: text('id').primaryKey(),
  documentId: text('document_id').notNull(),
  chunkIndex: integer('chunk_index').notNull(),
  content: text('content').notNull(),
  page: integer('page'),
  source: text('source').notNull(),
  tokenEstimate: integer('token_estimate').notNull(),
  embedding: text('embedding', { mode: 'json' }).$type<number[]>().notNull(),
  metadata: text('metadata', { mode: 'json' }),
  createdAt: text('created_at').notNull(),
});

/**
 * Applications Table:
 * Recruitment pipeline tracker (Saved, Applied, Interviewing, Offer, Rejected).
 */
export const applications = sqliteTable('applications', {
  id: text('id').primaryKey(),
  company: text('company').notNull(),
  role: text('role').notNull(),
  location: text('location').notNull(),
  workModel: text('work_model').notNull(), // 'remote' | 'hybrid' | 'on-site'
  status: text('status').notNull(), // 'saved' | 'applied' | 'interviewing' | 'offer' | 'rejected'
  matchScore: integer('match_score').notNull(),
  salaryRange: text('salary_range'),
  notes: text('notes'),
  proposalDraft: text('proposal_draft'),
  appliedDate: text('applied_date'),
  updatedAt: text('updated_at').notNull(),
});

/**
 * Memories Table:
 * Long-term contextual reflections, interview takeaways, and verified career preferences.
 */
export const memories = sqliteTable('memories', {
  id: text('id').primaryKey(),
  category: text('category').notNull(), // 'FACT' | 'PREFERENCE' | 'GOAL' | 'PROJECT' | 'SKILL' | 'EXPERIENCE' | 'CAREER_EVENT' | 'CONVERSATION'
  title: text('title').notNull(),
  content: text('content').notNull(),
  source: text('source'),
  confidence: real('confidence'), // 0.0 to 1.0
  verified: integer('verified', { mode: 'boolean' }),
  status: text('status'), // 'active' | 'superseded' | 'invalidated'
  supersededBy: text('superseded_by'),
  supersedes: text('supersedes'),
  expiresAt: text('expires_at'),
  sourceDocumentId: text('source_document_id'),
  sourceConversationId: text('source_conversation_id'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at'),
});

/**
 * Memory Events Table:
 * Immutable audit trail tracking memory lifecycle (creation, updates, verification, supersession).
 */
export const memoryEvents = sqliteTable('memory_events', {
  id: text('id').primaryKey(),
  memoryId: text('memory_id').notNull(),
  eventType: text('event_type').notNull(), // 'created' | 'updated' | 'verified' | 'invalidated' | 'superseded' | 'conflict_detected'
  details: text('details', { mode: 'json' }),
  createdAt: text('created_at').notNull(),
});

/**
 * Opportunities Table:
 * Curated and discovered career opportunities.
 */
export const opportunities = sqliteTable('opportunities', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  company: text('company').notNull(),
  location: text('location').notNull(),
  workModel: text('work_model').notNull(),
  salaryRange: text('salary_range'),
  description: text('description').notNull(),
  requiredSkills: text('required_skills', { mode: 'json' }).$type<string[]>().notNull(),
  url: text('url'),
  postedAt: text('posted_at').notNull(),
  source: text('source'),
  retrievedAt: text('retrieved_at'),
  externalId: text('external_id'),
});

/**
 * Interview Results Table:
 * Evaluated mock interview sessions with STAR ratings and feedback.
 */
export const interviewResults = sqliteTable('interview_results', {
  id: text('id').primaryKey(),
  category: text('category').notNull(),
  question: text('question').notNull(),
  userAnswer: text('user_answer').notNull(),
  overallScore: integer('overall_score').notNull(),
  clarityScore: integer('clarity_score').notNull(),
  technicalDepthScore: integer('technical_depth_score').notNull(),
  strengths: text('strengths', { mode: 'json' }).$type<string[]>().notNull(),
  improvements: text('improvements', { mode: 'json' }).$type<string[]>().notNull(),
  feedbackSummary: text('feedback_summary').notNull(),
  createdAt: text('created_at').notNull(),
});

/**
 * Monitored Alerts Table:
 * Opportunity monitor alert items.
 */
export const monitoredAlerts = sqliteTable('monitored_alerts', {
  id: text('id').primaryKey(),
  opportunityId: text('opportunity_id').notNull(),
  opportunityData: text('opportunity_data', { mode: 'json' }).$type<OpportunityItem>().notNull(),
  status: text('status').notNull(), // 'new' | 'viewed' | 'dismissed'
  detectedAt: text('detected_at').notNull(),
});

/**
 * Workflows Table:
 * High-level autonomous multi-step career workflows.
 */
export const workflows = sqliteTable('workflows', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  status: text('status').notNull(), // 'pending' | 'running' | 'waiting_for_approval' | 'completed' | 'failed' | 'cancelled'
  currentStep: integer('current_step').notNull().default(0),
  input: text('input', { mode: 'json' }).notNull(),
  output: text('output', { mode: 'json' }),
  error: text('error', { mode: 'json' }),
  approvalPayload: text('approval_payload', { mode: 'json' }),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

/**
 * Workflow Steps Table:
 * Sequential checkpoints and outcomes for each step in a career workflow.
 */
export const workflowSteps = sqliteTable('workflow_steps', {
  id: text('id').primaryKey(),
  workflowId: text('workflow_id').notNull(),
  stepIndex: integer('step_index').notNull(),
  name: text('name').notNull(),
  status: text('status').notNull(), // 'pending' | 'running' | 'completed' | 'failed' | 'waiting_for_approval'
  agent: text('agent'),
  tool: text('tool'),
  input: text('input', { mode: 'json' }),
  output: text('output', { mode: 'json' }),
  error: text('error'),
  startedAt: text('started_at'),
  completedAt: text('completed_at'),
});

/** Computer Actions Table */
/**
 * Stores pending and completed computer control actions.
 * Immutable audit trail is enforced via the approval flow.
 */
export const computerActions = sqliteTable('computer_actions', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  action: text('action').notNull(),
  payload: text('payload', { mode: 'json' }).notNull(),
  status: text('status')
    .notNull()
    .$default(() => 'PENDING_APPROVAL'), // enum: PENDING_APPROVAL|APPROVED|DENIED|EXECUTING|COMPLETED|FAILED|CANCELLED|EXPIRED
  result: text('result', { mode: 'json' }),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at')
});

/** Automation Jobs Table */
export const automationJobs = sqliteTable('automation_jobs', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  type: text('type').notNull(), // 'interval' | 'cron' | 'once'
  schedule: text('schedule').notNull(), // interval ms or cron string or ISO timestamp
  status: text('status').notNull().$default(() => 'SCHEDULED'), // 'DISABLED'|'SCHEDULED'|'RUNNING'|'COMPLETED'|'FAILED'|'CANCELLED'|'PAUSED'
  enabled: integer('enabled').notNull().$default(() => 1),
  taskType: text('task_type').notNull(), // 'opportunity_monitor'|'research_monitor'|'workflow_monitor'|'personal_summary'|'custom'
  taskPayload: text('task_payload', { mode: 'json' }).notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  nextRunAt: text('next_run_at'),
  lastRunAt: text('last_run_at'),
  lastResult: text('last_result', { mode: 'json' }),
  failureCount: integer('failure_count').notNull().$default(() => 0),
});

/** Automation Runs Table */
export const automationRuns = sqliteTable('automation_runs', {
  id: text('id').primaryKey(),
  jobId: text('job_id').notNull(),
  status: text('status').notNull(), // 'RUNNING'|'COMPLETED'|'FAILED'|'WAITING_FOR_APPROVAL'|'CANCELLED'
  startedAt: text('started_at').notNull(),
  completedAt: text('completed_at'),
  result: text('result', { mode: 'json' }),
  error: text('error'),
  steps: text('steps', { mode: 'json' }),
});

/** Automation Approvals Queue Table */
export const automationApprovals = sqliteTable('automation_approvals', {
  id: text('id').primaryKey(),
  jobId: text('job_id').notNull(),
  runId: text('run_id').notNull(),
  actionId: text('action_id'),
  actionType: text('action_type').notNull(),
  reason: text('reason').notNull(),
  requestedAction: text('requested_action', { mode: 'json' }).notNull(),
  status: text('status').notNull().$default(() => 'PENDING'), // 'PENDING'|'APPROVED'|'DENIED'|'EXPIRED'
  createdAt: text('created_at').notNull(),
  expiresAt: text('expires_at'),
});

/** In-App System Notifications Table */
export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  type: text('type').notNull(), // 'INFO'|'SUCCESS'|'WARNING'|'APPROVAL_REQUIRED'|'ERROR'
  title: text('title').notNull(),
  message: text('message').notNull(),
  data: text('data', { mode: 'json' }),
  read: integer('read').notNull().$default(() => 0),
  createdAt: text('created_at').notNull(),
});

/** Schema Migrations Tracking Table */
export const schemaMigrations = sqliteTable('schema_migrations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  appliedAt: text('applied_at').notNull(),
});

/** Append-Only System Audit Logs Table */
export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  timestamp: text('timestamp').notNull(),
  eventType: text('event_type').notNull(),
  actor: text('actor').notNull(),
  action: text('action').notNull(),
  status: text('status').notNull(),
  ipAddress: text('ip_address'),
  details: text('details', { mode: 'json' }),
  error: text('error'),
});


