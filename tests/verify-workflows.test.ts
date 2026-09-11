import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureDatabaseReady, db } from '@/lib/db';
import { workflows as workflowsTable, workflowSteps as workflowStepsTable, applications as applicationsTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { WorkflowEngine } from '@/lib/workflows/engine';
import { defaultWorkflowRegistry, WorkflowRegistry } from '@/lib/workflows/registry';
import { WorkflowExecutor } from '@/lib/workflows/executor';
import {
  createWorkflowRecord,
  getWorkflowRecord,
  updateWorkflowRecord,
  saveWorkflowStepRecord,
} from '@/lib/workflows/persistence';
import { JobDescriptionAnalyzer } from '@/lib/workflows/analyzer/job-analyzer';
import { ProfileMatcher } from '@/lib/workflows/analyzer/profile-matcher';
import { defaultRegistry } from '@/lib/agents/registry';
import { WorkflowAgent } from '@/lib/agents/workflow-agent';
import { CentralAssistant } from '@/lib/agents/assistant';
import { MockProvider } from '@/lib/ai/providers/mock';
import { getProfile } from '@/lib/profile/store';
import { getApplications, getApplicationsAsync } from '@/lib/tracker/store';

test('Workflow: 1. Workflow engine and definition registration', () => {
  const engine = WorkflowEngine.getInstance();
  const defs = engine.getAvailableWorkflowTypes();

  assert.ok(defs.length >= 3);
  const types = defs.map((d) => d.type);
  assert.ok(types.includes('career_discovery'));
  assert.ok(types.includes('opportunity_analysis'));
  assert.ok(types.includes('application_preparation'));

  const discoveryDef = defaultWorkflowRegistry.getWorkflowDefinition('career_discovery');
  assert.ok(discoveryDef);
  assert.equal(discoveryDef.name, 'Career Opportunity Discovery & Research');
  assert.ok(discoveryDef.steps.length >= 5);
});

test('Workflow: 2. JobDescriptionAnalyzer extracts factual requirements without assumptions', () => {
  const sampleJD = `
    Job Title: Senior Backend Engineer
    Company: Acme Cloud Solutions
    Location: Remote (US & Canada)
    
    About the Role:
    We are looking for a Senior Backend Engineer to architect cloud-native distributed microservices.
    
    Required Qualifications:
    - 5+ years building backend systems with TypeScript and Node.js
    - Strong relational database experience with PostgreSQL or MySQL
    - Experience designing high-throughput REST and GraphQL APIs
    - Docker and Kubernetes deployment familiarity
    
    Nice to Have:
    - Go experience
    - Kafka stream processing
    
    Salary: $170,000 - $210,000 USD
  `;

  const parsed = JobDescriptionAnalyzer.analyze(sampleJD, 'Acme Cloud Solutions', 'Senior Backend Engineer');

  assert.equal(parsed.title, 'Senior Backend Engineer');
  assert.equal(parsed.company, 'Acme Cloud Solutions');
  assert.equal(parsed.level, 'senior');
  assert.ok(parsed.workModel === 'remote' || parsed.workModel === 'hybrid' || parsed.workModel === 'onsite');
  assert.ok(parsed.requiredSkills.includes('TypeScript') || parsed.requiredSkills.includes('Node.js'));
  assert.ok(parsed.requiredSkills.includes('PostgreSQL') || parsed.requiredSkills.includes('Docker'));
  assert.equal(parsed.minYearsExperience, 5);
  assert.ok(parsed.salaryRange?.includes('$170,000'));

  // Unknown fields must remain null/empty without fabrication
  const sparseJD = 'Need a web developer to help build our landing page.';
  const sparseParsed = JobDescriptionAnalyzer.analyze(sparseJD);
  assert.equal(sparseParsed.minYearsExperience, null);
  assert.equal(sparseParsed.salaryRange, null);
  assert.equal(sparseParsed.visaSupport, null);
});

test('Workflow: 3. ProfileMatcher deterministic scoring with explainable evidence classification', async () => {
  const profile = await getProfile();

  const mockRequirements = {
    roleTitle: 'Senior Full Stack Engineer',
    companyName: 'Vercel',
    seniorityLevel: 'Senior',
    requiredSkills: ['TypeScript', 'Next.js', 'React', 'PostgreSQL', 'Node.js'],
    preferredSkills: ['GraphQL', 'Docker', 'Tailwind CSS'],
    responsibilities: ['Architect scalable web applications', 'Optimize SQL queries'],
    minYearsExperience: 4,
  };

  const match = ProfileMatcher.evaluateMatch(profile, mockRequirements);

  // Deterministic checks
  assert.ok(match.overallScore >= 0 && match.overallScore <= 98, 'Score must be capped at 98%');
  assert.equal(typeof match.overallScore, 'number');

  // Breakdown factors
  assert.ok(match.breakdown.skillsMatch >= 0);
  assert.ok(match.breakdown.experienceMatch >= 0);
  assert.ok(match.breakdown.domainMatch >= 0);
  assert.ok(match.breakdown.educationMatch >= 0);

  // Strict Evidence classification
  assert.ok(Array.isArray(match.evidence.verified));
  assert.ok(Array.isArray(match.evidence.inferred));
  assert.ok(Array.isArray(match.evidence.unknown));

  // TypeScript and Next.js are verified in Farhan's profile
  assert.ok(match.evidence.verified.some((v: string) => v.toLowerCase().includes('typescript')));
  assert.ok(match.evidence.verified.some((v: string) => v.toLowerCase().includes('next.js') || v.toLowerCase().includes('react')));

  // Missing or unknown skills check
  const exoticRequirements = {
    roleTitle: 'Legacy Cobol Developer',
    companyName: 'Old Bank',
    requiredSkills: ['COBOL', 'Fortran', 'Mainframe Assembly'],
    responsibilities: ['Maintain 1970s ledger system'],
  };
  const exoticMatch = ProfileMatcher.evaluateMatch(profile, exoticRequirements);
  assert.ok(exoticMatch.overallScore < 50, 'Score should be low for unverified exotic skills');
  assert.ok(exoticMatch.skillGaps.length >= 2, 'Unmatched skills must appear in skillGaps');
});

test('Workflow: 4. SQLite persistence for workflow records and step checkpoints', async () => {
  await ensureDatabaseReady();

  const testWfId = `test_wf_${Date.now()}`;
  const now = new Date().toISOString();

  await createWorkflowRecord({
    id: testWfId,
    type: 'opportunity_analysis',
    status: 'pending',
    currentStepIndex: 0,
    steps: [
      { id: 's1', name: 'Step 1', status: 'pending' },
      { id: 's2', name: 'Step 2', status: 'pending' },
    ],
    context: { initialInput: 'test_val' },
    createdAt: now,
    updatedAt: now,
  });

  // Fetch record
  const fetched = await getWorkflowRecord(testWfId);
  assert.ok(fetched);
  assert.equal(fetched.id, testWfId);
  assert.equal(fetched.type, 'opportunity_analysis');
  assert.equal(fetched.status, 'pending');
  assert.equal(fetched.steps.length, 2);
  assert.equal(fetched.context.initialInput, 'test_val');

  // Save Step checkpoint
  await saveWorkflowStepRecord(testWfId, {
    id: 's1',
    name: 'Step 1',
    status: 'completed',
    output: { result: 'step 1 finished successfully' },
    startedAt: now,
    completedAt: new Date().toISOString(),
  });

  // Verify updated status
  fetched.status = 'running';
  fetched.currentStepIndex = 1;
  await updateWorkflowRecord(fetched);

  const updated = await getWorkflowRecord(testWfId);
  assert.ok(updated);
  assert.equal(updated.status, 'running');
  assert.equal(updated.currentStepIndex, 1);
  const step1 = updated.steps.find((s) => s.id === 's1');
  assert.ok(step1);
  assert.equal(step1.status, 'completed');
  assert.equal((step1.output as any)?.result, 'step 1 finished successfully');
});

test('Workflow: 5. Process restart recovery restores state checkpoints from SQLite', async () => {
  await ensureDatabaseReady();

  const restartWfId = `restart_wf_${Date.now()}`;
  const now = new Date().toISOString();

  // Create partially executed workflow
  await createWorkflowRecord({
    id: restartWfId,
    type: 'opportunity_analysis',
    status: 'waiting_for_approval',
    currentStepIndex: 2,
    steps: [
      { id: 's1', name: 'Step 1', status: 'completed', output: { parsed: true } },
      { id: 's2', name: 'Step 2', status: 'completed', output: { researched: true } },
      { id: 's3', name: 'Step 3', status: 'waiting_for_approval' },
    ],
    context: { stage: 'halfway', count: 42 },
    createdAt: now,
    updatedAt: now,
  });

  // Fresh engine instance simulating server restart
  const freshEngine = new WorkflowEngine(defaultWorkflowRegistry, new WorkflowExecutor());
  const recovered = await freshEngine.getWorkflow(restartWfId);

  assert.ok(recovered);
  assert.equal(recovered.status, 'waiting_for_approval');
  assert.equal(recovered.currentStepIndex, 2);
  assert.equal(recovered.context.stage, 'halfway');
  assert.equal(recovered.context.count, 42);
  assert.equal(recovered.steps[0].status, 'completed');
  assert.equal(recovered.steps[1].status, 'completed');
  assert.equal(recovered.steps[2].status, 'waiting_for_approval');
});

test('Workflow: 6. Sequential execution of opportunity_analysis workflow', async () => {
  const engine = WorkflowEngine.getInstance();

  const workflow = await engine.startWorkflow('opportunity_analysis', {
    roleTitle: 'Senior Full Stack Engineer',
    companyName: 'Vercel',
    jobDescription:
      'Looking for a Senior Full Stack Engineer with strong Next.js App Router, TypeScript, React Server Components, and PostgreSQL performance tuning experience.',
  });

  assert.equal(workflow.status, 'completed');
  assert.equal(workflow.type, 'opportunity_analysis');
  assert.ok(workflow.steps.length >= 5);
  for (const step of workflow.steps) {
    assert.equal(step.status, 'completed', `Step ${step.id} should be completed`);
  }

  // Check output artifacts in context
  assert.ok(workflow.context.parsedJD);
  assert.ok(workflow.context.companyResearch);
  assert.ok(workflow.context.techResearch);
  assert.ok(workflow.context.matchResult);
  assert.ok((workflow.context as any).matchResult.overallScore > 0);
  assert.ok(workflow.context.strategicAnalysis);
  assert.ok(workflow.context.synthesis);
});

test('Workflow: 7. Autonomous career_discovery workflow execution and ranking', async () => {
  const engine = WorkflowEngine.getInstance();

  const workflow = await engine.startWorkflow('career_discovery', {
    query: 'Senior Full Stack Engineer',
    location: 'Remote',
    maxOpportunities: 2,
  });

  assert.equal(workflow.status, 'completed');
  assert.equal(workflow.type, 'career_discovery');
  assert.ok(workflow.steps.every((s) => s.status === 'completed'));

  // Context must contain discovered, ranked opportunities
  assert.ok(Array.isArray(workflow.context.opportunities));
  assert.ok(Array.isArray(workflow.context.rankedOpportunities));
  assert.ok(workflow.context.synthesis);
});

test('Workflow: 8. Application preparation workflow enforces human approval boundary', async () => {
  const engine = WorkflowEngine.getInstance();

  const initialApps = await getApplicationsAsync();
  const initialCount = initialApps.length;

  const testRole = `Lead Architect Test ${Date.now()}`;
  const testCompany = 'Anthropic Test Corp';

  // Run without pre-approval
  const workflow = await engine.startWorkflow('application_preparation', {
    opportunity: {
      title: testRole,
      company: testCompany,
      description: 'Looking for a Lead Architect with distributed systems and TypeScript experience.',
      location: 'Remote',
      workModel: 'remote',
    },
  });

  // Workflow must stop in waiting_for_approval at step 5
  assert.equal(workflow.status, 'waiting_for_approval');
  const waitingStep = workflow.steps.find((s) => s.status === 'waiting_for_approval');
  assert.ok(waitingStep, 'Must have a step in waiting_for_approval');
  assert.equal(waitingStep.id, 'request_human_approval');

  // Verify SQLite applications table was NOT modified before approval
  const currentApps = await getApplicationsAsync();
  assert.equal(currentApps.length, initialCount, 'Database must not be mutated before user authorization');

  // Resume workflow with explicit approval
  const resumed = await engine.resumeWorkflow(workflow.id, { isHumanApproved: true });

  assert.equal(resumed.status, 'completed');
  assert.ok(resumed.steps.every((s) => s.status === 'completed'));

  // Verify application record was now persisted to SQLite
  const afterApps = await getApplicationsAsync();
  assert.equal(afterApps.length, initialCount + 1, 'Database must have the new application record after approval');
  const found = afterApps.find((a) => a.role === testRole && a.company === testCompany);
  assert.ok(found);
  assert.equal(found.company, testCompany);
});

test('Workflow: 9. Workflow cancellation handling', async () => {
  const engine = WorkflowEngine.getInstance();

  const workflow = await engine.startWorkflow('application_preparation', {
    opportunity: {
      title: 'Cancelled Role Candidate',
      company: 'Cancel Co',
      description: 'Role that will be cancelled.',
    },
  });

  assert.equal(workflow.status, 'waiting_for_approval');

  // Cancel the workflow
  const cancelled = await engine.cancelWorkflow(workflow.id);
  assert.equal(cancelled.status, 'cancelled');

  // Check in SQLite
  const fetched = await engine.getWorkflow(workflow.id);
  assert.ok(fetched);
  assert.equal(fetched.status, 'cancelled');
});

test('Workflow: 10. Step failure reporting and error preservation', async () => {
  const engine = WorkflowEngine.getInstance();
  const testRegistry = new WorkflowRegistry();

  testRegistry.registerWorkflow({
    type: 'failing_workflow',
    name: 'Failing Test Workflow',
    description: 'A workflow designed to fail at step 2',
    steps: [
      {
        id: 'step_ok',
        name: 'Normal Step',
        execute: async () => ({ ok: true }),
      },
      {
        id: 'step_fail',
        name: 'Failing Step',
        execute: async () => {
          throw new Error('Simulated upstream dependency connection failure');
        },
      },
    ],
  });

  const executor = new WorkflowExecutor();
  const failingEngine = new WorkflowEngine(testRegistry, executor);

  const wf = await failingEngine.startWorkflow('failing_workflow', {});
  assert.equal(wf.status, 'failed');
  const wfErrMsg = typeof wf.error === 'string' ? wf.error : wf.error?.message || '';
  assert.ok(wfErrMsg.includes('Simulated upstream dependency connection failure'));
  assert.equal(wf.steps[0].status, 'completed');
  assert.equal(wf.steps[1].status, 'failed');
  const stepErrMsg = typeof wf.steps[1].error === 'string' ? wf.steps[1].error : (wf.steps[1].error as any)?.message || '';
  assert.ok(stepErrMsg.includes('Simulated upstream dependency connection failure'));
});

test('Workflow: 11. WorkflowAgent tools execution via native tool interface', async () => {
  const startTool = WorkflowAgent.tools.find((t) => t.name === 'start_career_workflow');
  assert.ok(startTool);

  const startRes = await startTool.execute(
    {
      workflowType: 'opportunity_analysis',
      input: {
        roleTitle: 'Principal Engineer',
        companyName: 'Stripe',
        jobDescription: 'Seeking a Principal Engineer with TypeScript, payment gateways, and high availability systems.',
      },
    },
    {}
  );

  assert.equal(startRes.success, true);
  const startData = startRes.data as any;
  assert.ok(startData?.workflowId);
  assert.equal(startData?.status, 'completed');

  // Status tool
  const statusTool = WorkflowAgent.tools.find((t) => t.name === 'get_workflow_status');
  assert.ok(statusTool);

  const statusRes = await statusTool.execute({ workflowId: startData.workflowId }, {});
  assert.equal(statusRes.success, true);
  const statusData = statusRes.data as any;
  assert.equal(statusData?.workflowId, startData.workflowId);
  assert.equal(statusData?.status, 'completed');
});

test('Workflow: 12. AgentRegistry exposes all workflow orchestration tools', () => {
  const startTool = defaultRegistry.getTool('start_career_workflow');
  assert.ok(startTool);
  assert.equal(startTool.agentId, 'workflow_agent');

  const statusTool = defaultRegistry.getTool('get_workflow_status');
  assert.ok(statusTool);
  assert.equal(statusTool.agentId, 'workflow_agent');

  const resumeTool = defaultRegistry.getTool('resume_career_workflow');
  assert.ok(resumeTool);
  assert.equal(resumeTool.agentId, 'workflow_agent');

  const cancelTool = defaultRegistry.getTool('cancel_career_workflow');
  assert.ok(cancelTool);
  assert.equal(cancelTool.agentId, 'workflow_agent');
});

test('Workflow: 13. CentralAssistant native tool calling invokes start_career_workflow', async () => {
  const mockProvider = new MockProvider();
  mockProvider.queueToolCall(
    'start_career_workflow',
    {
      workflowType: 'opportunity_analysis',
      input: {
        roleTitle: 'Staff Software Engineer',
        companyName: 'Vercel',
        jobDescription: 'Senior Next.js and TypeScript role.',
      },
    },
    'Initiating autonomous opportunity analysis workflow for Vercel Staff Software Engineer.'
  );

  const assistant = new CentralAssistant(defaultRegistry, mockProvider);
  const result = await assistant.processRequest('Please do an in-depth analysis of this Vercel role.');

  assert.ok(result.answer);
  assert.ok(result.steps.length >= 2);
  const toolStep = result.steps.find((s) => s.title.includes('start_career_workflow'));
  assert.ok(toolStep);
  assert.ok(toolStep.details?.includes('opportunity_analysis'));
});

test('Workflow: 14. Strict Anti-Hallucination: Missing candidate skills are marked missing not assumed', async () => {
  const profile = await getProfile();

  const requirements = {
    roleTitle: 'Haskell Blockchain Core Developer',
    companyName: 'Crypto Core',
    requiredSkills: ['Haskell', 'Plutus', 'Formal Verification', 'Zero-Knowledge Proofs'],
    responsibilities: ['Write mathematically verified smart contracts'],
  };

  const match = ProfileMatcher.evaluateMatch(profile, requirements);
  assert.ok(match.skillGaps.length >= 3);
  for (const missing of ['Haskell', 'Plutus', 'Formal Verification', 'Zero-Knowledge Proofs']) {
    assert.ok(
      match.skillGaps.includes(missing),
      `Candidate does not have ${missing}, so it must be listed in skillGaps`
    );
  }
});

test('Workflow: 15. Workflow query listing and limit filtering from SQLite', async () => {
  const engine = WorkflowEngine.getInstance();
  const allWorkflows = await engine.listWorkflows({ limit: 10 });

  assert.ok(Array.isArray(allWorkflows));
  assert.ok(allWorkflows.length <= 10);
  if (allWorkflows.length > 0) {
    assert.ok(allWorkflows[0].id);
    assert.ok(allWorkflows[0].type);
    assert.ok(allWorkflows[0].status);
  }
});
