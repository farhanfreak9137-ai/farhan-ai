import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { updateProfileAsync, addDocumentAsync, getProfile } from '@/lib/profile/store';
import { addApplicationAsync } from '@/lib/tracker/store';
import { addMemoryAsync } from '@/lib/memory/store';
import { executeEvaluateInterviewAnswer } from '@/lib/tools/registry';
import { db, ensureDatabaseReady } from '@/lib/db';

test('Persistent Storage: SQLite database file exists on disk', async () => {
  await ensureDatabaseReady();
  const dbPath = path.resolve(process.cwd(), 'data/farhan_ai.db');
  assert.ok(fs.existsSync(dbPath), `Database file must exist at ${dbPath}`);
  const stats = fs.statSync(dbPath);
  assert.ok(stats.size > 0, 'Database file must not be empty');
});

test('Persistent Storage: Data survives process restart and is verified by independent connection', async () => {
  await ensureDatabaseReady();

  const uniqueSuffix = Date.now().toString();

  // 1. Write an update to Farhan's Profile
  const originalProfile = getProfile();
  const testHeadline = `Staff AI Systems Architect [Verified Test ${uniqueSuffix}]`;
  await updateProfileAsync({
    personalInfo: {
      ...originalProfile.personalInfo,
      headline: testHeadline,
    },
  });

  // 2. Add an ingested document
  const testDoc = {
    title: `Autonomous Systems Whitepaper ${uniqueSuffix}`,
    type: 'project_spec' as const,
    content: 'Detailed specifications for multi-agent LLM orchestrators and stateful failovers.',
  };
  await addDocumentAsync(testDoc);

  // 3. Add an Application
  const testApp = await addApplicationAsync({
    company: `Cognitive Cloud Labs ${uniqueSuffix}`,
    role: 'Principal Agentic Engineer',
    location: 'Remote (Worldwide)',
    workModel: 'remote',
    status: 'interviewing',
    matchScore: 98,
    salaryRange: '$180,000 - $220,000 USD',
    notes: 'Direct architecture evaluation for distributed AI workloads.',
  });

  // 4. Add a Memory
  const testMem = await addMemoryAsync({
    category: 'career_reflection',
    title: `Architecture Decision Record ${uniqueSuffix}`,
    content: 'Strictly isolate prompt assembly from execution and guarantee failover redundancy.',
  });

  // 5. Run Mock Interview Evaluation (persists to interview_results)
  const evalResult = await executeEvaluateInterviewAnswer({
    question: 'How do you design database persistence with zero downtime?',
    userAnswer: 'I implemented WAL mode SQLite with Drizzle ORM which slashed query latency by 45% and guaranteed 100% data persistence across process restarts.',
  });
  assert.ok(evalResult.success, 'Interview evaluation must succeed');

  // =========================================================================
  // SIMULATE PROCESS RESTART:
  // Open a brand-new, isolated LibSQL connection to disk with its own cache
  // =========================================================================
  const isolatedClient = createClient({
    url: `file:${path.resolve(process.cwd(), 'data/farhan_ai.db')}`,
  });
  const isolatedDb = drizzle(isolatedClient, { schema });

  // A. Verify Profile persistence on disk
  const profileRows = await isolatedDb
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.id, 'main'));

  assert.equal(profileRows.length, 1, 'Profile record must exist on disk');
  const storedData = typeof profileRows[0].data === 'string'
    ? JSON.parse(profileRows[0].data)
    : profileRows[0].data;
  assert.equal(storedData.personalInfo.headline, testHeadline, 'Persisted profile headline must match update');

  // B. Verify Document persistence on disk
  const docRows = await isolatedDb
    .select()
    .from(schema.documents)
    .where(eq(schema.documents.title, testDoc.title));

  assert.ok(docRows.length >= 1, 'Ingested document must persist in SQLite documents table');
  assert.equal(docRows[0].content, testDoc.content, 'Document content must match exactly on disk');

  // C. Verify Application persistence on disk
  const appRows = await isolatedDb
    .select()
    .from(schema.applications)
    .where(eq(schema.applications.id, testApp.id));

  assert.equal(appRows.length, 1, 'Application must persist in SQLite applications table');
  assert.equal(appRows[0].company, `Cognitive Cloud Labs ${uniqueSuffix}`);
  assert.equal(appRows[0].status, 'interviewing');
  assert.equal(appRows[0].matchScore, 98);

  // D. Verify Memory persistence on disk
  const memRows = await isolatedDb
    .select()
    .from(schema.memories)
    .where(eq(schema.memories.id, testMem.id));

  assert.equal(memRows.length, 1, 'Memory record must persist in SQLite memories table');
  assert.equal(memRows[0].title, `Architecture Decision Record ${uniqueSuffix}`);

  // E. Verify Interview Results persistence on disk
  const evalRows = await isolatedDb
    .select()
    .from(schema.interviewResults)
    .where(eq(schema.interviewResults.question, 'How do you design database persistence with zero downtime?'));

  assert.ok(evalRows.length >= 1, 'Interview evaluation must persist in SQLite interview_results table');
  assert.ok(evalRows[0].overallScore && evalRows[0].overallScore >= 8, 'Stored score must be >= 8');
  assert.ok(evalRows[0].feedbackSummary?.includes('Solid response'), 'Stored feedback summary must exist');

  // Clean up test application and memory to keep environment clean
  await isolatedDb.delete(schema.applications).where(eq(schema.applications.id, testApp.id));
  await isolatedDb.delete(schema.memories).where(eq(schema.memories.id, testMem.id));
  await isolatedDb.delete(schema.documents).where(eq(schema.documents.title, testDoc.title));
  await isolatedDb.delete(schema.interviewResults).where(eq(schema.interviewResults.id, evalRows[0].id));
});
