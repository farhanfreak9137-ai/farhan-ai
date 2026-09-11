// Live HTTP verification for Objective 4: Autonomous Career Workflows
const http = require('http');

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runLiveVerification() {
  console.log('=== Objective 4: Live HTTP Verification ===\n');

  // 1. GET /api/workflows
  console.log('[1] Testing GET /api/workflows...');
  const listRes = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/workflows',
    method: 'GET',
  });
  console.log(`Status: ${listRes.status}`);
  console.log(`Success: ${listRes.data?.success}, Workflows count: ${listRes.data?.workflows?.length}`);
  if (listRes.status !== 200 || !listRes.data?.success) {
    throw new Error('GET /api/workflows failed');
  }

  // 2. POST /api/workflows (career_discovery)
  console.log('\n[2] Testing POST /api/workflows (career_discovery)...');
  const cdRes = await request(
    {
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/workflows',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      type: 'career_discovery',
      input: {
        query: 'Full Stack Engineer Next.js',
        location: 'Remote',
        maxOpportunities: 2,
      },
    }
  );
  console.log(`Status: ${cdRes.status}`);
  console.log(`Workflow ID: ${cdRes.data?.workflow?.id}`);
  console.log(`Workflow Status: ${cdRes.data?.workflow?.status}`);
  console.log(`Workflow Steps: ${cdRes.data?.workflow?.steps?.length}`);
  if (cdRes.status !== 200 || cdRes.data?.workflow?.status !== 'completed') {
    throw new Error('POST career_discovery failed or did not complete');
  }

  // 3. POST /api/workflows (application_preparation with human approval gate)
  console.log('\n[3] Testing POST /api/workflows (application_preparation with human approval gate)...');
  const apRes = await request(
    {
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/workflows',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      type: 'application_preparation',
      input: {
        company: 'Vercel Live Test Inc',
        role: 'Senior Next.js Architect',
        description: 'Building edge runtime infrastructure and AI SDK integrations with TypeScript and React.',
        location: 'Remote',
        workModel: 'remote',
      },
    }
  );
  console.log(`Status: ${apRes.status}`);
  const apWf = apRes.data?.workflow;
  console.log(`Workflow ID: ${apWf?.id}`);
  console.log(`Workflow Status: ${apWf?.status} (Expected: waiting_for_approval)`);
  if (apWf?.status !== 'waiting_for_approval') {
    throw new Error(`Expected status waiting_for_approval, got ${apWf?.status}`);
  }

  // 4. POST /api/workflows/[id]/approve
  console.log(`\n[4] Testing POST /api/workflows/${apWf.id}/approve...`);
  const approveRes = await request(
    {
      hostname: '127.0.0.1',
      port: 3000,
      path: `/api/workflows/${apWf.id}/approve`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    {}
  );
  console.log(`Status: ${approveRes.status}`);
  console.log(`Approved Workflow Status: ${approveRes.data?.workflow?.status}`);
  if (approveRes.status !== 200 || approveRes.data?.workflow?.status !== 'completed') {
    throw new Error('Approval route did not advance workflow to completed');
  }

  // 5. POST /api/orchestrate with CentralAssistant tool calling
  console.log('\n[5] Testing POST /api/orchestrate with natural language workflow invocation...');
  const orchRes = await request(
    {
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/orchestrate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      messages: [
        {
          role: 'user',
          content: 'Can you run a career discovery workflow for senior TypeScript engineer positions?',
        },
      ],
    }
  );
  console.log(`Status: ${orchRes.status}`);
  console.log(`Tool Steps Executed: ${orchRes.data?.steps?.map((s) => s.tool).join(', ')}`);
  console.log(`Response Snippet: ${orchRes.data?.answer?.substring(0, 150)}...`);
  if (orchRes.status !== 200 || !orchRes.data?.answer) {
    throw new Error('POST /api/orchestrate failed');
  }

  console.log('\n=== ALL LIVE WORKFLOW VERIFICATIONS PASSED SUCCESSFULLY! ===');
}

runLiveVerification().catch((err) => {
  console.error('\nVerification FAILED:', err);
  process.exit(1);
});
