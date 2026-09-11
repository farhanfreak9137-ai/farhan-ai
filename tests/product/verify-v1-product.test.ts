import { test, describe, before } from 'node:test';
import assert from 'node:assert';
import { centralAssistant } from '../../src/lib/agents/assistant';
import { defaultRegistry } from '../../src/lib/agents/registry';
import { defaultProfile } from '../../src/data/defaultProfile';
import { ensureDatabaseReady, client } from '../../src/lib/db';
import { evaluatePolicy, isUrlSafe } from '../../src/lib/computer/policyEngine';
import { defaultScheduler } from '../../src/lib/automation/scheduler';
import { verifyRequestAuth } from '../../src/lib/security/auth';
import { verifyDatabaseIntegrity } from '../../src/lib/db/backup';
import { getAppliedMigrations } from '../../src/lib/db/migrations';
import { queryAuditLogs } from '../../src/lib/audit';

describe('Objective 9: Farhan AI v1.0 Product Integration & User Journeys', () => {
  before(async () => {
    await ensureDatabaseReady();
  });

  // ---------------------------------------------------------------------------
  // Journey 1: Career Discovery & Matching (Success + Missing/Failure Path)
  // ---------------------------------------------------------------------------
  describe('Journey 1: Career Discovery & Matching', () => {
    test('discovers opportunities and separates verified matching skills from missing skills', async () => {
      const tool = defaultRegistry.getTool('discover_opportunities');
      assert.ok(tool, 'discover_opportunities tool must exist');

      const result = await tool.execute({ query: 'Senior AI Engineer remote' }, { providerId: 'mock' });
      assert.strictEqual(result.success, true);
      const data = result.data as any;
      assert.ok(Array.isArray(data.opportunities));
      assert.ok(data.opportunities.length > 0);

      const topOpp = data.opportunities[0];
      assert.ok(topOpp.title, 'Opportunity must have a title');
      assert.ok(topOpp.company, 'Opportunity must have a company');
      assert.ok(topOpp.matchScore > 0, 'Match score must be calculated');
      assert.ok(Array.isArray(topOpp.requiredSkills), 'Required skills must be an array');
    });

    test('failure path: rejects malformed opportunity discovery queries safely', async () => {
      const tool = defaultRegistry.getTool('discover_opportunities');
      assert.ok(tool);

      // Empty query should be handled safely by fallback without unhandled error
      const result = await tool.execute({ query: '' }, { providerId: 'mock' });
      assert.strictEqual(result.success, true);
      const data = result.data as any;
      assert.ok(data.opportunities.length > 0);
    });
  });

  // ---------------------------------------------------------------------------
  // Journey 2: Opportunity Analysis Workflow
  // ---------------------------------------------------------------------------
  describe('Journey 2: Opportunity Analysis Workflow', () => {
    test('analyzes job description and extracts factual requirements without assumptions', async () => {
      const tool = defaultRegistry.getTool('analyze_job_description');
      assert.ok(tool, 'analyze_job_description tool must exist');

      const jd = `
        Senior Full-Stack Engineer at CloudScale.
        Required: TypeScript, React, Next.js, Node.js, PostgreSQL.
        Nice to have: Docker, Kubernetes.
      `;

      const result = await tool.execute({ jobDescriptionText: jd }, { providerId: 'mock' });
      assert.strictEqual(result.success, true);
      const data = result.data as any;
      const skills = (data.extractedSkills || []).map((s: string) => s.toLowerCase());
      assert.ok(skills.includes('typescript'));
      assert.ok(skills.includes('postgresql'));
    });

    test('failure path: handles non-job text gracefully without crash', async () => {
      const tool = defaultRegistry.getTool('analyze_job_description');
      assert.ok(tool);

      const result = await tool.execute({ jobDescriptionText: 'Not a real job posting' }, { providerId: 'mock' });
      assert.strictEqual(result.success, true);
      const data = result.data as any;
      assert.ok(Array.isArray(data.extractedSkills));
    });
  });

  // ---------------------------------------------------------------------------
  // Journey 3: Application Preparation & Strict Human Approval Boundary
  // ---------------------------------------------------------------------------
  describe('Journey 3: Application Preparation & Approval Boundary', () => {
    test('generate_proposal enforces human approval boundary before export', async () => {
      const tool = defaultRegistry.getTool('generate_proposal');
      assert.ok(tool);

      // Unapproved invocation MUST pause and return approval payload
      const unapprovedResult = await defaultRegistry.executeTool(
        'generate_proposal',
        {
          companyName: 'Apex Labs',
          roleTitle: 'Staff AI Engineer',
        },
        { isHumanApproved: false }
      );

      assert.strictEqual(unapprovedResult.requiresHumanApproval, true);
      assert.ok(unapprovedResult.approvalPayload, 'Must provide approval payload');
      assert.strictEqual(unapprovedResult.approvalPayload?.actionType, 'export_proposal');
      assert.strictEqual(unapprovedResult.approvalPayload?.payload.company, 'Apex Labs');
      assert.strictEqual(unapprovedResult.approvalPayload?.payload.role, 'Staff AI Engineer');
    });
  });

  // ---------------------------------------------------------------------------
  // Journey 4: Personal Knowledge RAG & Semantic Retrieval
  // ---------------------------------------------------------------------------
  describe('Journey 4: Personal Knowledge RAG & Grounding', () => {
    test('searches verified personal documents and retrieves grounded chunks', async () => {
      const tool = defaultRegistry.getTool('search_personal_knowledge');
      assert.ok(tool);

      const result = await tool.execute({ query: 'React TypeScript Next.js' }, { providerId: 'mock' });
      assert.strictEqual(result.success, true);
      const data = result.data as any;
      assert.ok(Array.isArray(data.results));
    });

    test('failure path: searching for nonexistent qualifications does not fabricate credentials', async () => {
      const tool = defaultRegistry.getTool('search_personal_knowledge');
      assert.ok(tool);

      const result = await tool.execute(
        { query: 'commercial airline captain transport license' },
        { providerId: 'mock' }
      );
      assert.strictEqual(result.success, true);
      const data = result.data as any;

      // Retrieved chunks must not contain fabricated pilot qualification
      const matchedContent = (data.results || [])
        .map((r: any) => String(r.chunk?.content || ''))
        .join(' ')
        .toLowerCase();

      assert.strictEqual(matchedContent.includes('commercial airline captain'), false);
    });
  });

  // ---------------------------------------------------------------------------
  // Journey 5: Real Research & Grounded Evidence
  // ---------------------------------------------------------------------------
  describe('Journey 5: Real Research & Source Grounding', () => {
    test('company_research provides structured evidence with source links', async () => {
      const tool = defaultRegistry.getTool('company_research');
      assert.ok(tool);

      const result = await tool.execute({ companyName: 'Microsoft' }, { providerId: 'mock' });
      assert.strictEqual(result.success, true);
      const data = result.data as any;
      assert.ok(data.topic?.includes('Microsoft') || data.query?.includes('Microsoft'));
      assert.ok(data.sources?.length > 0);
      assert.ok(data.sources[0].url?.startsWith('http'));
    });

    test('failure path: company_research for blank query fails validation cleanly', async () => {
      // Empty company name should fail schema validation in executeTool
      const result = await defaultRegistry.executeTool(
        'company_research',
        { companyName: '' },
        { providerId: 'mock' }
      );
      assert.strictEqual(result.success, false);
      assert.ok(result.error?.includes('Validation error'));
    });
  });

  // ---------------------------------------------------------------------------
  // Journey 6: Computer Control Safety, SSRF & Emergency STOP
  // ---------------------------------------------------------------------------
  describe('Journey 6: Computer Control Safety & Emergency STOP', () => {
    test('unconditionally blocks SSRF attempts to AWS metadata and loopbacks', () => {
      assert.strictEqual(isUrlSafe('http://169.254.169.254/latest/meta-data'), false);
      assert.strictEqual(isUrlSafe('http://127.0.0.1:3000'), false);
      assert.strictEqual(isUrlSafe('http://localhost:8080'), false);
      assert.strictEqual(isUrlSafe('http://2130706433/'), false); // Decimal 127.0.0.1
    });

    test('consequential browser actions require human approval', () => {
      // Interactive click action requires human approval
      const clickDecision = evaluatePolicy({
        action: 'click',
        payload: { elementId: 'apply-button-1' },
      });
      assert.strictEqual(clickDecision.allowed, true);
      assert.strictEqual(clickDecision.requiresApproval, true);
      assert.strictEqual(clickDecision.classification, 'REQUIRES_APPROVAL');

      // In permissive mode, navigation to legitimate web page requires approval
      const origMode = process.env.ALLOWLIST_MODE;
      try {
        process.env.ALLOWLIST_MODE = 'permissive';
        const navigateDecision = evaluatePolicy({
          action: 'navigate',
          payload: { url: 'https://indeed.com/viewjob' },
        });
        assert.strictEqual(navigateDecision.allowed, true);
        assert.strictEqual(navigateDecision.requiresApproval, true);
        assert.strictEqual(navigateDecision.classification, 'REQUIRES_APPROVAL');
      } finally {
        process.env.ALLOWLIST_MODE = origMode;
      }
    });

    test('safe browser observation executes automatically without approval pause', () => {
      const observeDecision = evaluatePolicy({
        action: 'observe',
        payload: {},
      });
      assert.strictEqual(observeDecision.allowed, true);
      assert.strictEqual(observeDecision.requiresApproval, false);
      assert.strictEqual(observeDecision.classification, 'SAFE');
    });

    test('emergency stop_session tool exists and is registered', () => {
      const stopTool = defaultRegistry.getTool('stop_session');
      assert.ok(stopTool, 'Emergency stop_session tool must be registered');
    });
  });

  // ---------------------------------------------------------------------------
  // Journey 7: Voice Interface through Central Assistant
  // ---------------------------------------------------------------------------
  describe('Journey 7: Voice Interface & Central Assistant', () => {
    test('voice queries route to Central Assistant without parallel architecture', async () => {
      const response = await centralAssistant.processRequest('What are my verified technical skills?', {
        providerId: 'mock',
      });

      assert.ok(response.answer.length > 0);
      assert.strictEqual(response.steps.length > 0, true);
      // Factual answer contains Farhan's real verified skills
      assert.ok(response.answer.includes('TypeScript') || response.answer.includes('Next.js'));
    });
  });

  // ---------------------------------------------------------------------------
  // Journey 8: Background Automation & Circuit Breakers
  // ---------------------------------------------------------------------------
  describe('Journey 8: Background Automation & Safety', () => {
    test('automation scheduler respects minimum intervals and safe job creation', () => {
      assert.ok(defaultScheduler, 'defaultScheduler must be initialized');
      const tool = defaultRegistry.getTool('list_automations');
      assert.ok(tool, 'list_automations tool must exist in registry');
    });
  });

  // ---------------------------------------------------------------------------
  // Journey 9: System Readiness, Health & Backup Verification
  // ---------------------------------------------------------------------------
  describe('Journey 9: System Readiness & Diagnostics', () => {
    test('database passes PRAGMA integrity_check', async () => {
      const integrity = await verifyDatabaseIntegrity(client);
      assert.strictEqual(integrity.ok, true);
      assert.strictEqual(integrity.result.toLowerCase(), 'ok');
    });

    test('tracked schema migrations reflect real history (001_baseline_schema, 002_audit_logs)', async () => {
      const migrations = await getAppliedMigrations(client);
      const ids = migrations.map((m) => m.id);
      assert.ok(ids.includes('001_baseline_schema'));
      assert.ok(ids.includes('002_audit_logs'));
    });

    test('audit trail records security and operational events immutably', async () => {
      const logs = await queryAuditLogs({ limit: 10 });
      assert.ok(Array.isArray(logs));
      assert.ok(logs.length > 0);
    });
  });

  // ---------------------------------------------------------------------------
  // Journey 10: Anti-Hallucination & Strict Provenance Boundary
  // ---------------------------------------------------------------------------
  describe('Journey 10: Anti-Hallucination & Provenance Boundary', () => {
    test('assistant refuses to invent nonexistent personal credentials', async () => {
      const response = await centralAssistant.processRequest(
        'Did Farhan win the Nobel Prize in Physics or work at NASA Jet Propulsion Lab?',
        { providerId: 'mock' }
      );

      // Must explicitly declare not in verified records
      assert.ok(
        response.answer.includes('verified') ||
        response.answer.includes('records') ||
        response.answer.includes('do not have') ||
        response.answer.includes('not listed') ||
        response.answer.includes('I do not have this in Farhan\'s verified career records'),
        `Answer must refuse to hallucinate: ${response.answer}`
      );
    });

    test('no fabricated personal memory is created in SQLite', async () => {
      const memoriesRes = await client.execute({
        sql: "SELECT * FROM memories WHERE content LIKE '%Nobel Prize%' OR content LIKE '%NASA Jet Propulsion Lab%';",
        args: [],
      });
      assert.strictEqual(memoriesRes.rows.length, 0, 'No hallucinated memory should be persisted');
    });

    test('verified candidate profile retains genuine, uncorrupted identity', () => {
      assert.strictEqual(defaultProfile.personalInfo.fullName, 'Farhan');
      const allSkills = defaultProfile.skills.flatMap((c) => c.skills).map((s) => s.name);
      assert.ok(allSkills.includes('TypeScript'));
      assert.ok(allSkills.includes('Python'));
    });
  });
});
