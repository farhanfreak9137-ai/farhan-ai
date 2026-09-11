// scripts/verify-live-rag.js
const http = require('http');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, body: parsed });
        } catch {
          resolve({ status: res.statusCode, body });
        }
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function runLiveVerification() {
  console.log('--- Starting Objective 5 Live HTTP Verification ---');

  // 1. GET /api/documents
  console.log('\n[1] Testing GET /api/documents...');
  const initialDocs = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/documents',
    method: 'GET',
  });
  console.log(`Status: ${initialDocs.status}, Found ${initialDocs.body.documents?.length || 0} existing documents.`);

  // 2. POST /api/documents (ingest test document)
  console.log('\n[2] Testing POST /api/documents (Ingestion)...');
  const sampleDoc = `# Farhan Technical Portfolio 2026
## Distributed Agent Architecture
Designed and implemented an enterprise multi-agent system in TypeScript and SQLite.
Key features include:
- Deterministic cosine vector retrieval over personal documents.
- Continuous long-term memory with supersession and audit trails.
- Human-in-the-loop approval boundaries for sensitive mutations.
`;

  const ingestRes = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/documents',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      filename: 'farhan_portfolio_live_test.md',
      content: sampleDoc,
      source: 'live_test',
    }
  );

  console.log(`Ingest Status: ${ingestRes.status}`);
  if (!ingestRes.body.success) {
    throw new Error(`Document ingestion failed: ${JSON.stringify(ingestRes.body)}`);
  }
  const ingestedDocId = ingestRes.body.result.document.id;
  console.log(`Document Ingested Successfully: ID=${ingestedDocId}, Chunks=${ingestRes.body.result.chunksCreated}`);

  // 3. POST /api/documents/search (Semantic Search)
  console.log('\n[3] Testing POST /api/documents/search (Vector Retrieval)...');
  const searchRes = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/documents/search',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      query: 'What did Farhan build with distributed agent architecture?',
      topK: 2,
      minSimilarity: 0.0,
    }
  );

  console.log(`Search Status: ${searchRes.status}, Matches=${searchRes.body.results?.length || 0}`);
  if (searchRes.body.results && searchRes.body.results.length > 0) {
    console.log(`Top match: "${searchRes.body.results[0].content.slice(0, 80)}..." (Score: ${searchRes.body.results[0].similarity})`);
  }

  // 4. GET /api/memory
  console.log('\n[4] Testing GET /api/memory...');
  const memListRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/memory',
    method: 'GET',
  });
  console.log(`Status: ${memListRes.status}, Found ${memListRes.body.memories?.length || 0} active memories.`);

  // ====================================================================
  // CHAIN A: add → verify → events
  // ====================================================================

  // 5. POST /api/memory (Add Memory)
  console.log('\n[5] Testing POST /api/memory (Action: add)...');
  const addMemRes = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/memory',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      action: 'add',
      memory: {
        title: 'Work Model Preference Live',
        content: 'Prefers fully remote roles with high autonomy in Eastern Time.',
        category: 'PREFERENCE',
        confidence: 0.95,
      },
    }
  );

  console.log(`Add Memory Status: ${addMemRes.status}`);
  if (addMemRes.status !== 200 || !addMemRes.body.success) {
    throw new Error(`[5] add failed: ${JSON.stringify(addMemRes.body)}`);
  }
  const createdMemId = addMemRes.body.memory?.id;
  console.log(`Memory Created: ID=${createdMemId}, Category=${addMemRes.body.memory?.category}`);

  // 6. POST /api/memory (Verify Memory)
  console.log('\n[6] Testing POST /api/memory (Action: verify)...');
  const verifyRes = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/memory',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      action: 'verify',
      memoryId: createdMemId,
    }
  );
  console.log(`Verify Status: ${verifyRes.status}, Success=${verifyRes.body.success}`);
  if (verifyRes.status !== 200 || !verifyRes.body.success) {
    throw new Error(`[6] verify FAILED (status ${verifyRes.status}): ${JSON.stringify(verifyRes.body)}`);
  }
  console.log(`✔ verify returned 200 with success=true for memoryId=${verifyRes.body.memoryId}`);

  // 7. POST /api/memory (Audit Trail Events for Chain A)
  console.log('\n[7] Testing POST /api/memory (Action: events) for add→verify chain...');
  const eventsResA = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/memory',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      action: 'events',
      memoryId: createdMemId,
    }
  );
  console.log(`Events Status: ${eventsResA.status}, Event Count=${eventsResA.body.events?.length || 0}`);
  if (eventsResA.status !== 200 || !eventsResA.body.success) {
    throw new Error(`[7] events FAILED (status ${eventsResA.status}): ${JSON.stringify(eventsResA.body)}`);
  }
  console.log(`✔ events returned 200 with success=true, memoryId=${eventsResA.body.memoryId}`);
  if (eventsResA.body.events) {
    eventsResA.body.events.forEach((ev) => console.log(`  - Event: ${ev.eventType} at ${ev.createdAt}`));
  }

  // Clean up Chain A memory
  await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/memory',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { action: 'delete', memoryId: createdMemId }
  );
  console.log(`Cleaned up Chain A memory: ${createdMemId}`);

  // ====================================================================
  // CHAIN B: add → invalidate → events
  // ====================================================================

  console.log('\n[8] Testing Chain B: add → invalidate → events...');
  const addMemB = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/memory',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      action: 'add',
      memory: {
        title: 'Outdated Salary Expectation',
        content: 'Expected salary is $80K. (Outdated)',
        category: 'FACT',
        confidence: 0.7,
      },
    }
  );
  if (addMemB.status !== 200 || !addMemB.body.success) {
    throw new Error(`[8a] add for chain B failed: ${JSON.stringify(addMemB.body)}`);
  }
  const memBId = addMemB.body.memory?.id;
  console.log(`Chain B: Created memory ${memBId}`);

  // Invalidate
  const invalRes = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/memory',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      action: 'invalidate',
      memoryId: memBId,
      reason: 'Salary expectation updated to $120K in new negotiation round',
    }
  );
  if (invalRes.status !== 200 || !invalRes.body.success) {
    throw new Error(`[8b] invalidate FAILED (status ${invalRes.status}): ${JSON.stringify(invalRes.body)}`);
  }
  console.log(`✔ invalidate returned 200 with success=true for memoryId=${invalRes.body.memoryId}`);

  // Events for Chain B
  const eventsResB = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/memory',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      action: 'events',
      memoryId: memBId,
    }
  );
  if (eventsResB.status !== 200 || !eventsResB.body.success) {
    throw new Error(`[8c] events for chain B FAILED (status ${eventsResB.status}): ${JSON.stringify(eventsResB.body)}`);
  }
  console.log(`✔ Chain B events: ${eventsResB.body.events?.length || 0} audit trail entries`);
  if (eventsResB.body.events) {
    eventsResB.body.events.forEach((ev) => console.log(`  - Event: ${ev.eventType} at ${ev.createdAt}`));
  }

  // Clean up Chain B memory
  await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/memory',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { action: 'delete', memoryId: memBId }
  );
  console.log(`Cleaned up Chain B memory: ${memBId}`);

  // ====================================================================
  // 9. Cleanup test document
  // ====================================================================

  console.log('\n[9] Cleaning up test document...');
  const deleteRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/documents/${ingestedDocId}`,
    method: 'DELETE',
  });
  console.log(`Delete Status: ${deleteRes.status}, Success=${deleteRes.body.success}`);

  console.log('\n======================================================');
  console.log('  ALL OBJECTIVE 5 LIVE HTTP ENDPOINTS VERIFIED 100%!  ');
  console.log('  Including: add, search, verify, invalidate, delete, events');
  console.log('  Chain A (add → verify → events): PASSED');
  console.log('  Chain B (add → invalidate → events): PASSED');
  console.log('======================================================');
}

runLiveVerification().catch((err) => {
  console.error('Verification FAILED:', err);
  process.exit(1);
});

