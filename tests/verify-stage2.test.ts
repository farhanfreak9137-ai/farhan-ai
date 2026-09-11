import test from 'node:test';
import assert from 'node:assert/strict';

import {
  executeDiscoverOpportunities,
  executeAnalyzeJobDescription,
  executeAnalyzeSkillGap,
  executeGenerateProposal,
  executeStartMockInterview,
  executeEvaluateInterviewAnswer,
} from '@/lib/tools/registry';
import { detectToolIntent, runOrchestrator } from '@/lib/ai/orchestrator';
import { getApplications, addApplication, updateApplicationStatus } from '@/lib/tracker/store';

test('Stage 2 Tool: Opportunity Discovery ranks matching roles by verified skills', async () => {
  const result = await executeDiscoverOpportunities({ workModel: 'remote' });
  assert.equal(result.success, true);
  assert.equal(result.toolName, 'discover_opportunities');

  const data = result.data as any;
  assert.ok(data.opportunities.length > 0, 'Should find matching opportunities');
  const topOpp = data.opportunities[0];
  assert.ok(topOpp.matchScore >= 80, 'Top opportunity should have a high match score');
  assert.ok(topOpp.matchReason.length > 0, 'Should explain why the opportunity matches');
});

test('Stage 2 Tool: Job Description Parser extracts skills and seniority', async () => {
  const jd = `We are seeking a Senior AI Systems Architect with 5+ years of experience in TypeScript, Next.js, Node.js, and PostgreSQL to lead our autonomous agent infrastructure.`;
  const result = await executeAnalyzeJobDescription({ jobDescriptionText: jd, companyName: 'Scale AI' });

  assert.equal(result.success, true);
  const data = result.data as any;
  assert.ok(data.extractedSkills.includes('TypeScript'));
  assert.ok(data.extractedSkills.includes('Next.js'));
  assert.equal(data.detectedSeniority, 'Senior / Lead Level');
});

test('Stage 2 Tool: Skill Gap Analysis computes accurate match score and learning roadmap', async () => {
  const result = await executeAnalyzeSkillGap({
    targetRole: 'AI Systems Architect',
    requiredSkills: 'TypeScript, Next.js, LLM Orchestration, Rust, Kubernetes',
  });

  assert.equal(result.success, true);
  const data = result.data as any;
  assert.ok(data.overallMatchScore > 0 && data.overallMatchScore < 100);
  assert.ok(data.verifiedMatches.some((m: string) => m.includes('TypeScript')));
  assert.ok(data.gapsOrMissingSkills.includes('Rust'));
  assert.ok(data.learningRoadmap.length > 0, 'Roadmap must provide learning items for missing skills');
});

test('Stage 2 Guardrail: Proposal Generator mandates explicit Human Approval', async () => {
  const result = await executeGenerateProposal({
    companyName: 'Nexus Cognitive Lab',
    roleTitle: 'Senior AI Engineer',
  });

  assert.equal(result.success, true);
  assert.equal(result.requiresHumanApproval, true, 'Proposal generator MUST require human approval');
  assert.ok(result.approvalPayload, 'Must provide approval payload with action details');
  assert.equal(result.approvalPayload?.actionType, 'export_proposal');
  assert.ok(String(result.approvalPayload?.payload.content).includes('Farhan'));
});

test('Stage 2 Tool: Mock Interview Generator and STAR Evaluation', async () => {
  const questionResult = await executeStartMockInterview({ category: 'ai_systems' });
  assert.equal(questionResult.success, true);
  const qData = questionResult.data as any;
  assert.ok(qData.question.length > 0);

  const evalResult = await executeEvaluateInterviewAnswer({
    question: qData.question,
    userAnswer: 'I resolved this by engineering a resilient streaming fallback architecture in Next.js App Router, which slashed response times and reduced latency by 45%.',
  });

  assert.equal(evalResult.success, true);
  const eData = evalResult.data as any;
  assert.ok(eData.overallScore >= 7, 'Score should reflect strong STAR answer');
  assert.ok(eData.strengths.length > 0);
});

test('Stage 2 Orchestrator: Intent Detection routes to correct career tools', () => {
  const oppIntent = detectToolIntent('Please find opportunities suitable for me');
  assert.equal(oppIntent?.toolName, 'discover_opportunities');

  const gapIntent = detectToolIntent('Analyze my skill gap for an AI Architect role');
  assert.equal(gapIntent?.toolName, 'analyze_skill_gap');

  const mockIntent = detectToolIntent('Let us practice a mock interview for AI systems');
  assert.equal(mockIntent?.toolName, 'start_mock_interview');
});

test('Stage 2 Application Tracker: Manages application pipeline lifecycle', () => {
  const initialApps = getApplications();
  assert.ok(initialApps.length > 0);

  const newApp = addApplication({
    company: 'Test AI Labs',
    role: 'Lead Developer',
    location: 'Remote',
    workModel: 'remote',
    status: 'saved',
    matchScore: 92,
  });

  assert.equal(newApp.company, 'Test AI Labs');

  const updated = updateApplicationStatus(newApp.id, 'interviewing');
  assert.equal(updated?.status, 'interviewing');
});
