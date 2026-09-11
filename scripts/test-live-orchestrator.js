const fs = require('fs');

async function testQuery(name, message) {
  console.log(`\n=== Running Test: ${name} ===`);
  const t0 = Date.now();
  const res = await fetch('http://127.0.0.1:3000/api/orchestrate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: message }],
    }),
  });

  const durationMs = Date.now() - t0;
  console.log(`HTTP ${res.status} in ${durationMs}ms`);

  const data = await res.json();
  console.log('Agent Used:', data.agentUsed);
  console.log('Steps Count:', data.steps?.length);
  if (data.steps && data.steps.length > 0) {
    data.steps.forEach((s, idx) => {
      console.log(`  Step ${idx}: [${s.type}] ${s.title}`);
    });
  }
  console.log('Answer Preview:\n', String(data.answer).slice(0, 400));
  return { name, durationMs, status: res.status, data };
}

(async () => {
  try {
    const results = [];

    // Query 1: Company research
    const r1 = await testQuery(
      'Company Research',
      'Research Microsoft and summarize what matters for an AI and software candidate.'
    );
    results.push(r1);

    // Query 2: Opportunity discovery
    const r2 = await testQuery(
      'Opportunity Discovery',
      'Discover high-match remote tech and AI career opportunities suited to Farhan.'
    );
    results.push(r2);

    fs.writeFileSync('scripts/live-test-results.json', JSON.stringify(results, null, 2));
    console.log('\nAll tests written to scripts/live-test-results.json successfully!');
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
})();
