import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureDatabaseReady, db } from '@/lib/db';
import { opportunities as opportunitiesTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { MockResearchProvider } from '@/lib/research/providers/mock-research';
import { setResearchProvider } from '@/lib/research/factory';
import { ResearchProvider, ResearchResult } from '@/lib/research/types';
import { MockOpportunitySource } from '@/lib/opportunities/sources/mock-source';
import { OpportunityPipeline } from '@/lib/opportunities/pipeline';
import { NormalizedOpportunity, NormalizedOpportunitySchema } from '@/lib/opportunities/types';
import { CentralAssistant } from '@/lib/agents/assistant';
import { defaultRegistry } from '@/lib/agents/registry';
import { MockProvider } from '@/lib/ai/providers/mock';
import { getProfile } from '@/lib/profile/store';

test('Objective 3: 1. Research provider interface defines required capabilities', () => {
  const provider = new MockResearchProvider();
  assert.equal(typeof provider.search, 'function');
  assert.equal(typeof provider.researchCompany, 'function');
  assert.equal(typeof provider.researchTechnology, 'function');
  assert.equal(typeof provider.researchMarket, 'function');
  assert.ok(provider.id);
  assert.ok(provider.name);
});

test('Objective 3: 2. Successful research response normalization contains structured evidence', async () => {
  const provider = new MockResearchProvider();
  const result = await provider.researchCompany('Microsoft', 'AI engineering');

  assert.equal(result.query, 'Microsoft');
  assert.ok(result.topic.includes('Microsoft'));
  assert.ok(result.summary.length > 0);
  assert.ok(Array.isArray(result.sources));
  assert.ok(result.sources.length >= 1);
  assert.ok(Array.isArray(result.keyFindings));
  assert.ok(Array.isArray(result.verifiedFacts));
  assert.ok(Array.isArray(result.inferences));
  assert.ok(Array.isArray(result.uncertainties));
  assert.ok(result.retrievedAt);
});

test('Objective 3: 3. Malformed research response handling fails gracefully', async () => {
  // Test invalid parameters to research agent tool via registry
  const result = await defaultRegistry.executeTool('company_research', {
    // Missing companyName
    context: 'Some context',
  });

  assert.equal(result.success, false);
  assert.ok(result.error?.includes('Validation error') || result.error?.includes('companyName'));
});

test('Objective 3: 4. Research failure handling reports transparently without hallucinating facts', async () => {
  const failingProvider: ResearchProvider = {
    id: 'failing-provider',
    name: 'Failing Provider',
    search: async () => { throw new Error('Simulated upstream network timeout (504 Gateway Timeout)'); },
    researchCompany: async () => { throw new Error('API Rate Limit Exceeded (429 Too Many Requests)'); },
    researchTechnology: async () => { throw new Error('Service Unavailable'); },
    researchMarket: async () => { throw new Error('Internal Server Error'); },
  };

  setResearchProvider(failingProvider);
  try {
    const toolResult = await defaultRegistry.executeTool('company_research', {
      companyName: 'NonExistent Corp',
    });

    assert.equal(toolResult.success, false);
    assert.ok(toolResult.error?.includes('Rate Limit') || toolResult.error?.includes('Company research failed'));
  } finally {
    setResearchProvider(null);
  }
});

test('Objective 3: 5. Source metadata preservation retains titles, URLs, domains, and timestamps', async () => {
  const provider = new MockResearchProvider();
  const searchResult = await provider.search('TypeScript Next.js');

  assert.ok(searchResult.sources.length > 0);
  const src = searchResult.sources[0];
  assert.ok(src.title.length > 0, 'Must have title');
  assert.ok(src.url.startsWith('http'), 'Must have valid HTTP URL');
  assert.ok(src.domain.length > 0, 'Must extract domain');
  assert.ok(src.excerpt.length > 0, 'Must have relevant excerpt');
  assert.ok(src.retrievedAt, 'Must have timestamp');
});

test('Objective 3: 6. Opportunity source normalization produces valid NormalizedOpportunity', async () => {
  const source = new MockOpportunitySource();
  const opps = await source.fetchOpportunities();

  assert.ok(opps.length > 0);
  const first = opps[0];
  const parseResult = NormalizedOpportunitySchema.safeParse(first);
  assert.equal(parseResult.success, true, 'Normalized opportunity must pass schema validation');
});

test('Objective 3: 7. Opportunity deduplication merges duplicate URLs and IDs deterministically', () => {
  const pipeline = new OpportunityPipeline();
  const duplicates: NormalizedOpportunity[] = [
    {
      id: 'opp-1',
      title: 'Senior AI Engineer',
      company: 'Nova AI',
      location: 'Remote',
      workModel: 'remote',
      description: 'Role A',
      requiredSkills: ['TypeScript'],
      url: 'https://nova.ai/jobs/senior-ai?utm_source=linkedin&ref=123',
      source: 'remotive',
      externalId: 'ext-101',
      retrievedAt: new Date().toISOString(),
    },
    {
      id: 'opp-2',
      title: 'Senior AI Engineer',
      company: 'Nova AI',
      location: 'Remote',
      workModel: 'remote',
      description: 'Role A duplicate from other board',
      requiredSkills: ['TypeScript'],
      url: 'https://nova.ai/jobs/senior-ai?utm_source=twitter',
      source: 'remotive',
      externalId: 'ext-101', // Same source + externalId
      retrievedAt: new Date().toISOString(),
    },
    {
      id: 'opp-3',
      title: 'Staff Systems Developer',
      company: 'Apex Labs',
      location: 'Remote',
      workModel: 'remote',
      description: 'Unique Role B',
      requiredSkills: ['Python'],
      url: 'https://apexlabs.io/careers/staff-dev',
      source: 'arbeitnow',
      externalId: 'ext-202',
      retrievedAt: new Date().toISOString(),
    },
  ];

  const deduplicated = pipeline.deduplicateOpportunities(duplicates);
  assert.equal(deduplicated.length, 2, 'Must collapse duplicates sharing the same externalId/URL');
  assert.equal(deduplicated[0].id, 'opp-1');
  assert.equal(deduplicated[1].id, 'opp-3');
});

test('Objective 3: 8. Opportunity validation rejects corrupted or incomplete records', () => {
  const pipeline = new OpportunityPipeline();

  const invalidOpp = {
    id: 'corrupted-1',
    // Missing title
    company: 'Ghost Corp',
    location: 'Remote',
    workModel: 'invalid-model', // invalid enum
    url: 'not-a-valid-url',
  };

  const validated = pipeline.validateOpportunity(invalidOpp);
  assert.equal(validated, null, 'Must reject malformed opportunity');
});

test('Objective 3: 9. Profile-based opportunity matching evaluates matched and missing skills', async () => {
  await ensureDatabaseReady();
  const profile = await getProfile();
  const pipeline = new OpportunityPipeline();

  const candidateSkills = profile.skills.flatMap((c) => c.skills.map((s) => s.name));
  const candidateRoles = profile.careerPreferences.targetRoles;

  const testOpp: NormalizedOpportunity = {
    id: 'test-match-1',
    title: 'Senior AI Systems Engineer',
    company: 'Quantum Stack Labs',
    location: 'Remote',
    workModel: 'remote',
    description: 'High-scale multi-agent orchestration platform.',
    requiredSkills: ['TypeScript', 'Python', 'LLM Orchestration', 'Haskell', 'Quantum Algorithms'],
    url: 'https://quantumstack.io/jobs/senior-ai',
    source: 'test-source',
    retrievedAt: new Date().toISOString(),
  };

  const matched = pipeline.matchOpportunityAgainstProfile(testOpp, candidateSkills, candidateRoles);

  assert.ok(matched.matchScore > 50, 'Should score high match for overlapping skills');
  assert.ok(matched.matchScore < 100, 'Must not claim 100% guaranteed fit');
  assert.ok(matched.matchDetails.matchedSkills.includes('TypeScript'));
  assert.ok(matched.matchDetails.missingSkills.includes('Haskell'));
  assert.ok(matched.matchDetails.summary.includes('match based on available verified profile information'));
});

test('Objective 3: 10. Real opportunity persistence writes to SQLite database', async () => {
  await ensureDatabaseReady();

  const uniqueSuffix = Date.now().toString();
  const testCompany = `Persistent Pipeline Labs ${uniqueSuffix}`;

  const customSource = new MockOpportunitySource([
    {
      id: `opp-test-${uniqueSuffix}`,
      externalId: `ext-${uniqueSuffix}`,
      title: 'Principal AI Architecture Lead',
      company: testCompany,
      location: 'Remote (Worldwide)',
      workModel: 'remote',
      description: 'Direct persistence verification in SQLite.',
      requiredSkills: ['TypeScript', 'Next.js', 'PostgreSQL', 'Docker'],
      salaryRange: '$190,000 - $230,000 USD',
      url: `https://persistent-test-${uniqueSuffix}.com/jobs/lead`,
      source: 'sqlite-verification-source',
      retrievedAt: new Date().toISOString(),
    },
  ]);

  const pipeline = new OpportunityPipeline([customSource]);
  const results = await pipeline.executePipeline({ skipExternalFetch: false });

  assert.ok(results.some((r) => r.company === testCompany), 'Pipeline must return persisted opportunity');

  // Verify directly from SQLite
  const dbRows = await db
    .select()
    .from(opportunitiesTable)
    .where(eq(opportunitiesTable.company, testCompany));

  assert.equal(dbRows.length, 1, 'Must persist opportunity to SQLite database');
  assert.equal(dbRows[0].company, testCompany);
  assert.equal(dbRows[0].source, 'sqlite-verification-source');
  assert.ok(dbRows[0].retrievedAt, 'Must persist retrievedAt timestamp');
});

test('Objective 3: 11. Central Assistant invokes Research Agent through native tool calling', async () => {
  await ensureDatabaseReady();

  const provider = new MockProvider();
  provider.queueToolCalls([
    {
      id: 'call_res_1',
      name: 'company_research',
      arguments: {
        companyName: 'Microsoft',
        context: 'AI Systems Architect applicant',
      },
    },
  ]);

  const assistant = new CentralAssistant(defaultRegistry);
  const result = await assistant.run([
    { role: 'user', content: 'Research Microsoft before I apply' },
  ], provider);

  assert.ok(result.answer, 'Must synthesize response');
  const toolStep = result.steps.find((s) => s.type === 'tool_call');
  assert.ok(toolStep, 'Must execute tool call');
  assert.ok(toolStep.title.includes('company_research'));

  const delegationStep = result.steps.find((s) => s.type === 'reasoning' && s.title.includes('Research Agent'));
  assert.ok(delegationStep, 'Must delegate to Research Agent');
});

test('Objective 3: 12. Central Assistant invokes Opportunity Agent through native tool calling', async () => {
  await ensureDatabaseReady();

  const provider = new MockProvider();
  provider.queueToolCalls([
    {
      id: 'call_opp_obj3',
      name: 'discover_opportunities',
      arguments: {
        roleQuery: 'AI Systems',
        workModel: 'remote',
      },
    },
  ]);

  const assistant = new CentralAssistant(defaultRegistry);
  const result = await assistant.run([
    { role: 'user', content: 'Find remote AI Systems opportunities matching my skills' },
  ], provider);

  assert.ok(result.answer, 'Must return answer');
  const toolStep = result.steps.find((s) => s.type === 'tool_call');
  assert.ok(toolStep, 'Must execute discover_opportunities tool');
  assert.ok(toolStep.title.includes('discover_opportunities'));
});

test('Objective 3: 13. Multi-agent workflow: opportunity discovery -> company research -> synthesis', async () => {
  await ensureDatabaseReady();

  const provider = new MockProvider();
  // Turn 1: discover opportunities; Turn 2: research the top matching company
  provider.queueToolCalls([
    {
      id: 'call_multi_1',
      name: 'discover_opportunities',
      arguments: { roleQuery: 'AI Engineer' },
    },
    {
      id: 'call_multi_2',
      name: 'company_research',
      arguments: { companyName: 'Cognitive Dynamics' },
    },
  ]);

  const assistant = new CentralAssistant(defaultRegistry);
  const result = await assistant.run([
    { role: 'user', content: 'Find opportunities and research the company behind the best one' },
  ], provider);

  assert.ok(result.answer, 'Must complete multi-agent execution');
  const toolCalls = result.steps.filter((s) => s.type === 'tool_call');
  assert.equal(toolCalls.length, 2, 'Must execute both specialized agents in sequence');
  assert.ok(toolCalls[0].title.includes('discover_opportunities'));
  assert.ok(toolCalls[1].title.includes('company_research'));
});

test('Objective 3: 14. Existing human approval safeguards remain intact for protected mutations', async () => {
  await ensureDatabaseReady();

  const provider = new MockProvider();
  provider.queueToolCalls([
    {
      id: 'call_protect_1',
      name: 'create_application',
      arguments: {
        company: 'Unapproved AI Security Test Corp',
        role: 'Lead Architect',
        location: 'Remote',
        workModel: 'remote',
      },
    },
  ]);

  const assistant = new CentralAssistant(defaultRegistry);
  const result = await assistant.run([
    { role: 'user', content: 'Create application for Unapproved AI Security Test Corp' },
  ], provider);

  // Must halt for approval
  assert.ok(result.approvalRequest, 'Must require human authorization before mutation');
  assert.equal(result.approvalRequest.actionType, 'create_application');
});
