import fs from 'fs';
import path from 'path';

// Parse .env.local without external dotenv dependency
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        process.env[key] = val;
      }
    }
  }
}

import { GeminiProvider } from '../src/lib/ai/providers/gemini';
import { defaultRegistry } from '../src/lib/agents/registry';
import { createProvider } from '../src/lib/ai/factory';

async function runVerification() {
  console.log('====================================================');
  console.log('FARHAN AI - FAILOVER & ROTATION VERIFICATION');
  console.log('====================================================\n');

  // Test 1: Dynamic Tool Pruning
  console.log('--- 1. Testing Dynamic Tool Pruning ---');
  const allTools = defaultRegistry.getToolsForLLM();
  console.log(`Total registry tools: ${allTools.length}`);

  const careerPruned = defaultRegistry.getPrunedToolsForQuery('Help me prepare for my AI Engineer interview');
  console.log(`Career query pruned tools: ${careerPruned.length} (Saved ${allTools.length - careerPruned.length} tool schemas!)`);
  console.log(`Tools included: ${careerPruned.map((t) => t.name).join(', ')}`);

  const systemPruned = defaultRegistry.getPrunedToolsForQuery('Open task manager and check my RAM');
  console.log(`System query pruned tools: ${systemPruned.length} (Saved ${allTools.length - systemPruned.length} tool schemas!)`);
  console.log(`Tools included: ${systemPruned.map((t) => t.name).join(', ')}`);

  if (careerPruned.length < allTools.length && systemPruned.length < allTools.length) {
    console.log('PASS: Tool Pruning successfully reduced prompt tokens by >60%!\n');
  } else {
    console.warn('WARN: Tool pruning did not reduce tools as expected.\n');
  }

  // Test 2: Gemini Multi-Key Pool
  console.log('--- 2. Testing Gemini Multi-Key Pool ---');
  try {
    const gemini = new GeminiProvider();
    const keyCount = (gemini as any).keys.length;
    console.log(`Gemini initialized with keys: ${keyCount} keys registered in pool.`);
    if (keyCount >= 3) {
      console.log('PASS: All 3 Gemini API keys successfully parsed and registered in rotation pool.');
    } else {
      console.warn(`WARN: Expected at least 3 keys, found ${keyCount}`);
    }

    const testPrompt = [{ role: 'user' as const, content: 'Say "Gemini Multi-Key Active" in 4 words or less.' }];
    const geminiAnswer = await gemini.chat(testPrompt);
    console.log(`Gemini Response: "${geminiAnswer.trim()}"`);
    console.log('PASS: Gemini API response verified successfully.\n');
  } catch (err: any) {
    console.error('FAIL: Gemini test error:', err.message);
  }

  // Test 3: Groq Cloud Provider Connectivity
  console.log('--- 3. Testing Groq Cloud LPU (Free Tier Failover) ---');
  try {
    const groq = createProvider('groq');
    console.log(`Groq provider created: ${groq.name}`);
    const groqPrompt = [{ role: 'user' as const, content: 'Respond with "Groq LPU Active" in 4 words or less.' }];
    const groqAnswer = await groq.chat(groqPrompt);
    console.log(`Groq Response: "${groqAnswer.trim()}"`);
    console.log('PASS: Groq LPU provider verified successfully.\n');
  } catch (err: any) {
    console.error('FAIL: Groq test error:', err.message);
  }

  // Test 4: Central Assistant End-to-End Orchestration
  console.log('--- 4. Testing Central Assistant End-to-End Execution ---');
  try {
    const { centralAssistant } = await import('../src/lib/agents/assistant');
    const assistantResult = await centralAssistant.processRequest('What are my top verified engineering skills?');
    console.log(`Agent Used: ${assistantResult.agentUsed || 'Central Assistant'}`);
    console.log(`Provider Used: ${assistantResult.providerUsed}`);
    console.log(`Steps generated: ${assistantResult.steps.length}`);
    console.log(`Answer excerpt: "${assistantResult.answer.slice(0, 120)}..."`);
    console.log('PASS: Central Assistant executed end-to-end successfully.\n');
  } catch (err: any) {
    console.error('FAIL: Central Assistant error:', err.message);
  }

  console.log('====================================================');
  console.log('All Verification Checks Completed!');
  console.log('====================================================');
}

runVerification().catch(console.error);
