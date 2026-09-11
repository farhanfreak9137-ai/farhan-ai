import test from 'node:test';
import assert from 'node:assert/strict';

// Ensure test environment simulates configured Gemini API key
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-gemini-key';

import { routeRequest } from '@/lib/ai/router';
import { runOpportunityScan, getMonitoredAlerts } from '@/lib/scanner/monitor';
import { getMemories, addMemory, formatMemoriesForContext } from '@/lib/memory/store';

test('Stage 3 Router: Directs massive documents to Gemini 1M+ token context', () => {
  const longPayload = 'A'.repeat(14000);
  const decision = routeRequest([
    { role: 'user', content: `Here is my full technical portfolio: ${longPayload}` },
  ]);

  assert.equal(decision.providerId, 'gemini');
  assert.ok(decision.rationale.includes('1M+'));
});

test('Stage 3 Router: Respects local and offline execution requests', () => {
  const decision = routeRequest([
    { role: 'user', content: 'Run this query using my local offline model for privacy.' },
  ]);

  assert.ok(decision.providerId === 'ollama' || decision.providerId === 'mock');
  assert.ok(decision.rationale.toLowerCase().includes('local'));
});

test('Stage 3 Monitor: Scheduled Opportunity Watcher discovers high-match roles', async () => {
  const scanResult = await runOpportunityScan(80);
  assert.ok(scanResult.alerts.length > 0);

  const alerts = getMonitoredAlerts();
  assert.ok(alerts.some((a) => a.opportunity.matchScore >= 80));
});

test('Stage 3 Memory: Persists long-term career notes and formats prompt context', () => {
  const initialCount = getMemories().length;

  const newMem = addMemory({
    category: 'interview_feedback',
    title: 'Staff AI Interviewer Notes',
    content: 'Emphasize production RAG latency and multi-provider failover strategies.',
  });

  assert.equal(getMemories().length, initialCount + 1);
  assert.equal(newMem.title, 'Staff AI Interviewer Notes');

  const formattedContext = formatMemoriesForContext();
  assert.ok(formattedContext.includes('LONG-TERM CONTEXTUAL MEMORY'));
  assert.ok(formattedContext.includes('Staff AI Interviewer Notes'));
});
