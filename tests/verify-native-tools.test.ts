import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureDatabaseReady } from '@/lib/db';
import { defaultRegistry, AgentRegistry } from '@/lib/agents/registry';
import { careerAgent } from '@/lib/agents/career-agent';
import { opportunityAgent } from '@/lib/agents/opportunity-agent';
import { researchAgent } from '@/lib/agents/research-agent';
import { memoryAgent } from '@/lib/agents/memory-agent';
import { CentralAssistant } from '@/lib/agents/assistant';
import { MockProvider } from '@/lib/ai/providers/mock';
import { getApplicationsAsync } from '@/lib/tracker/store';
import { z } from 'zod';
import { Agent } from '@/lib/agents/types';

test('Native Tools: Direct conversational query is answered without tool calls', async () => {
  await ensureDatabaseReady();

  const provider = new MockProvider();
  // No tool calls queued; MockProvider acts as direct conversation
  const assistant = new CentralAssistant(defaultRegistry);

  const result = await assistant.run([
    { role: 'user', content: 'Explain the concept of Retrieval-Augmented Generation (RAG).' },
  ], provider);

  assert.ok(result.answer, 'Must return an answer');
  assert.equal(result.steps.length, 1, 'Should record 1 step for direct conversation');
  assert.equal(result.steps[0].step, 'intent_resolution');
  assert.ok(result.steps[0].title.includes('Direct Conversational Response'));
  assert.equal(result.approvalRequest, undefined, 'Direct conversation requires no approval');
});

test('Native Tools: Agent Registry dynamically discovers capabilities as LLM tool declarations', async () => {
  const tools = defaultRegistry.getToolsForLLM();
  assert.ok(tools.length >= 10, 'Must expose all registered agent tools');

  const profileTool = tools.find((t) => t.name === 'get_profile');
  assert.ok(profileTool, 'get_profile declaration must exist');
  assert.equal(profileTool.parameters.type, 'object');

  const oppTool = tools.find((t) => t.name === 'discover_opportunities');
  assert.ok(oppTool, 'discover_opportunities declaration must exist');

  // Dynamic extension test: registering a new agent makes it immediately discoverable
  const customRegistry = new AgentRegistry();
  const testAgent: Agent = {
    id: 'analytics_agent',
    name: 'Analytics Agent',
    description: 'Specialized agent for career metrics',
    capabilities: ['readiness_scoring'],
    tools: [
      {
        name: 'compute_interview_readiness',
        description: 'Computes candidate interview readiness score',
        parameters: z.object({ targetRole: z.string() }),
        execute: async (args) => ({ toolName: 'compute_interview_readiness', success: true, score: 92, target: args.targetRole }),
      },
    ],
  };

  customRegistry.register(testAgent);
  const customDeclarations = customRegistry.getToolsForLLM();
  assert.equal(customDeclarations.length, 1);
  assert.equal(customDeclarations[0].name, 'compute_interview_readiness');
});

test('Native Tools: Central Assistant executes Career Agent get_profile tool natively', async () => {
  await ensureDatabaseReady();

  const provider = new MockProvider();
  provider.queueToolCalls([
    {
      id: 'call_profile_1',
      name: 'get_profile',
      arguments: {},
    },
  ]);

  const assistant = new CentralAssistant(defaultRegistry);
  const result = await assistant.run([
    { role: 'user', content: 'What are Farhan’s key skills and background?' },
  ], provider);

  assert.ok(result.answer, 'Must return synthesized answer');
  assert.ok(result.steps.length >= 3, 'Must record intent, execution, and synthesis steps');
  
  const execStep = result.steps.find((s) => s.step === 'tool_execution');
  assert.ok(execStep, 'Must have tool_execution step');
  assert.ok(execStep.title.includes('get_profile'));

  const synthesisStep = result.steps.find((s) => s.step === 'synthesis');
  assert.ok(synthesisStep, 'Must have synthesis step');
});

test('Native Tools: Central Assistant executes Opportunity Agent discover_opportunities natively', async () => {
  await ensureDatabaseReady();

  const provider = new MockProvider();
  provider.queueToolCalls([
    {
      id: 'call_opp_1',
      name: 'discover_opportunities',
      arguments: { roleQuery: 'AI Engineer' },
    },
  ]);

  const assistant = new CentralAssistant(defaultRegistry);
  const result = await assistant.run([
    { role: 'user', content: 'Find AI Engineer jobs matching my profile' },
  ], provider);

  assert.ok(result.answer, 'Must return synthesized answer');
  const execStep = result.steps.find((s) => s.step === 'tool_execution');
  assert.ok(execStep, 'Must execute discover_opportunities tool');
  assert.ok(execStep.title.includes('discover_opportunities'));
});

test('Native Tools: Zod schema validation safely catches invalid arguments', async () => {
  // Test invalid parameters for analyze_skill_gap (targetRole required)
  const result = await defaultRegistry.executeTool('analyze_skill_gap', {
    wrongParam: 12345,
  } as any);

  assert.equal(result.success, false, 'Must fail gracefully on invalid schema');
  assert.ok(result.error?.includes('Validation error') || result.error?.includes('targetRole'), 'Must explain validation issue');
});

test('Native Tools: Mutating tool (create_application) is halted before SQLite commit without human approval', async () => {
  await ensureDatabaseReady();

  const uniqueSuffix = Date.now().toString();
  const testCompany = `Anthropic Safeguard Test ${uniqueSuffix}`;

  const provider = new MockProvider();
  provider.queueToolCalls([
    {
      id: 'call_create_app_1',
      name: 'create_application',
      arguments: {
        company: testCompany,
        role: 'Research Alignment Engineer',
        location: 'Remote',
        workModel: 'remote',
      },
    },
  ]);

  const assistant = new CentralAssistant(defaultRegistry);
  const result = await assistant.run([
    { role: 'user', content: `Create an application for ${testCompany}` },
  ], provider);

  // 1. Assistant must report approval required
  assert.ok(result.approvalRequest, 'Approval request must be returned to client');
  assert.equal(result.approvalRequest.actionType, 'create_application');
  assert.ok(result.pendingToolCall, 'Pending tool call must be preserved');
  assert.equal(result.pendingToolCall.name, 'create_application');

  // 2. Step log must show pending approval
  const approvalStep = result.steps.find((s) => s.step === 'approval_requested');
  assert.ok(approvalStep, 'Must record approval_requested step');

  // 3. SQLite database must NOT contain the application yet
  const applications = await getApplicationsAsync();
  const found = applications.find((a) => a.company === testCompany);
  assert.equal(found, undefined, 'Mutating action MUST NOT commit to SQLite before human approval');
});

test('Native Tools: User authorization permits mutation and persists to SQLite', async () => {
  await ensureDatabaseReady();

  const uniqueSuffix = Date.now().toString();
  const testCompany = `Authorized DeepMind Test ${uniqueSuffix}`;

  const provider = new MockProvider();
  const assistant = new CentralAssistant(defaultRegistry);

  const approvedToolCall = {
    id: 'call_auth_1',
    name: 'create_application',
    arguments: {
      company: testCompany,
      role: 'Staff Agentic Architect',
      location: 'Remote',
      workModel: 'remote',
      salaryRange: '$220,000 - $260,000 USD',
      notes: 'Authorized by candidate.',
    },
  };

  // Run with explicit human approval
  const result = await assistant.run([
    { role: 'user', content: `Execute authorized application for ${testCompany}` },
  ], provider, {
    isHumanApproved: true,
    approvedToolCall,
  });

  // 1. Must proceed without requiring further approval
  assert.equal(result.approvalRequest, undefined, 'Approval request must be clear when authorized');
  assert.ok(result.answer, 'Must return completion answer');

  // 2. SQLite database MUST now contain the application
  const applications = await getApplicationsAsync();
  const created = applications.find((a) => a.company === testCompany);
  assert.ok(created, 'Application must be persisted to SQLite after human approval');
  assert.equal(created.role, 'Staff Agentic Architect');
  assert.equal(created.company, testCompany);
});

test('Native Tools: Proposal generation requires approval before completion', async () => {
  await ensureDatabaseReady();

  const provider = new MockProvider();
  provider.queueToolCalls([
    {
      id: 'call_proposal_1',
      name: 'generate_proposal',
      arguments: {
        company: 'Cohere AI',
        role: 'LLM Platform Lead',
      },
    },
  ]);

  const assistant = new CentralAssistant(defaultRegistry);
  const result = await assistant.run([
    { role: 'user', content: 'Generate a proposal for Cohere AI' },
  ], provider);

  assert.ok(result.approvalRequest, 'Proposal generation must require human approval before export');
  assert.equal(result.approvalRequest.actionType, 'export_proposal');
});

test('Native Tools: Central Assistant executes sequential multi-step tool calls', async () => {
  await ensureDatabaseReady();

  const provider = new MockProvider();
  // Queue first tool call, then second tool call
  provider.queueToolCalls([
    {
      id: 'step_1_profile',
      name: 'get_profile',
      arguments: {},
    },
    {
      id: 'step_2_docs',
      name: 'get_documents',
      arguments: {},
    },
  ]);

  const assistant = new CentralAssistant(defaultRegistry);
  const result = await assistant.run([
    { role: 'user', content: 'Check my profile and my uploaded documents' },
  ], provider);

  assert.ok(result.answer, 'Must complete sequential execution');
  const toolCalls = result.steps.filter((s) => s.type === 'tool_call');
  assert.equal(toolCalls.length, 2, 'Must execute both tools in sequence');
  assert.ok(toolCalls[0].title.includes('get_profile'));
  assert.ok(toolCalls[1].title.includes('get_documents'));
});

test('Native Tools: Research Agent exposes registered research tools', async () => {
  assert.equal(researchAgent.id, 'research_agent');
  assert.equal(researchAgent.name, 'Research Agent');
  assert.ok(researchAgent.tools.length >= 4, 'Research Agent exposes real research tools in Objective 3');
  assert.ok(researchAgent.tools.some((t) => t.name === 'web_search'));
  assert.ok(researchAgent.tools.some((t) => t.name === 'company_research'));
});
