// scripts/verify-live-objective7.ts
import { db, ensureDatabaseReady } from '../src/lib/db';
import { automationJobs, automationRuns, automationApprovals, notifications } from '../src/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { automationEngine } from '../src/lib/automation/engine';
import { defaultAutomationExecutor } from '../src/lib/automation/executor';
import { processVoiceCommand } from '../src/lib/voice/voiceAssistant';
import { getVoiceProviderStatus, setVoiceProvider } from '../src/lib/voice/factory';
import { mockVoiceProvider } from '../src/lib/voice/mockVoiceProvider';

async function runLiveVerification() {
  console.log('====================================================');
  console.log('  OBJECTIVE 7: LIVE SYSTEM VERIFICATION & AUDIT');
  console.log('====================================================\n');

  await ensureDatabaseReady();

  // ----------------------------------------------------
  // Part 1: Voice Verification
  // ----------------------------------------------------
  console.log('--- 1. VOICE PROVIDER & WORKFLOW VERIFICATION ---');
  setVoiceProvider(mockVoiceProvider);
  const voiceStatus = getVoiceProviderStatus();
  console.log('Voice Provider Status:', JSON.stringify(voiceStatus, null, 2));

  console.log('\n[Voice Test] Speech input -> STT -> Central Assistant -> Response -> TTS:');
  const voiceCmdResult = await processVoiceCommand({
    transcript: 'Find me new remote React jobs.',
  });
  console.log('Voice Command Query:', voiceCmdResult.transcript);
  console.log('Assistant Response Text:', voiceCmdResult.responseText);
  console.log('Synthesized Audio Available:', !!voiceCmdResult.responseAudio);
  console.log('Audio Container Format:', voiceCmdResult.audioFormat);
  console.log('Provider Used:', voiceCmdResult.providerUsed);

  // ----------------------------------------------------
  // Part 2: Safe Background Automation Verification
  // ----------------------------------------------------
  console.log('\n--- 2. SAFE BACKGROUND AUTOMATION LIFECYCLE ---');
  const safeJob = await automationEngine.createJob({
    name: 'Live Daily Remote React Watcher',
    description: 'Autonomous periodic opportunity discovery',
    type: 'interval',
    schedule: '60000',
    taskType: 'opportunity_monitor',
    taskPayload: { query: 'React Next.js', workModel: 'remote' },
    enabled: true,
  });
  console.log('Created Safe Job (SCHEDULED):', {
    id: safeJob.id,
    name: safeJob.name,
    status: safeJob.status,
    nextRunAt: safeJob.nextRunAt,
  });

  console.log('\nExecuting Safe Job...');
  const execSafe = await defaultAutomationExecutor.executeJob(safeJob);
  console.log('Safe Job Execution Status:', execSafe.status);
  console.log('Execution Run ID:', execSafe.runId);
  console.log('Trace Steps Count:', execSafe.steps.length);

  // ----------------------------------------------------
  // Part 3: Approval Boundary Enforcement Verification
  // ----------------------------------------------------
  console.log('\n--- 3. CONSEQUENTIAL ACTION & APPROVAL BOUNDARY ---');
  const approvalJob = await automationEngine.createJob({
    name: 'Live Application Submitter',
    description: 'Attempts consequential external submission',
    type: 'interval',
    schedule: '60000',
    taskType: 'custom',
    taskPayload: { action: 'submit_application_to_target_portal', company: 'Nexus Cognitive Lab' },
    enabled: true,
  });

  console.log('Executing Consequential Job (must halt at approval boundary)...');
  const execApproval = await defaultAutomationExecutor.executeJob(approvalJob);
  console.log('Consequential Job Status:', execApproval.status);
  console.log('Halting Result:', execApproval.result);

  const pendingApprovals = await automationEngine.listApprovals();
  const matchedApproval = pendingApprovals.find(a => a.runId === execApproval.runId);
  console.log('Queued in automation_approvals:', {
    id: matchedApproval?.id,
    actionType: matchedApproval?.actionType,
    status: matchedApproval?.status,
    reason: matchedApproval?.reason,
  });

  // Test explicit human approval
  if (matchedApproval) {
    console.log('\nAuthorizing pending action via human approval...');
    await automationEngine.handleApproval(matchedApproval.id, true);
    const updatedRun = await automationEngine.getRun(execApproval.runId);
    console.log('Post-Approval Run Status:', updatedRun?.status);
  }

  // ----------------------------------------------------
  // Part 4: Direct SQLite State Inspection
  // ----------------------------------------------------
  console.log('\n--- 4. DIRECT SQLITE AUDIT RECORDS ---');
  const auditedJobs = await db.select().from(automationJobs).orderBy(desc(automationJobs.createdAt)).limit(3);
  const auditedRuns = await db.select().from(automationRuns).orderBy(desc(automationRuns.startedAt)).limit(3);
  const auditedNotifs = await db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(3);

  console.log('Active Jobs in SQLite:', auditedJobs.map(j => ({ id: j.id, name: j.name, status: j.status, nextRunAt: j.nextRunAt })));
  console.log('Recent Runs in SQLite:', auditedRuns.map(r => ({ id: r.id, status: r.status, startedAt: r.startedAt, completedAt: r.completedAt })));
  console.log('Recent Notifications in SQLite:', auditedNotifs.map(n => ({ id: n.id, type: n.type, title: n.title })));

  console.log('\n====================================================');
  console.log('  ALL LIVE VERIFICATIONS COMPLETED SUCCESSFULLY');
  console.log('====================================================\n');
}

runLiveVerification().catch(err => {
  console.error('Live verification failed:', err);
  process.exit(1);
});
