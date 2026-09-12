import fs from 'fs';
import path from 'path';

// Parse .env.local without external dotenv dependency
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const eqIdx = trimmed.indexOf('=');
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      process.env[key] = val;
    }
  }
}

import { centralAssistant } from '../src/lib/agents/assistant';

async function test() {
  console.log('--- Testing Central Assistant with Farhan\'s Real Details ---');
  const res = await centralAssistant.processRequest('Who am I, where do I study, and what major projects have I built?');
  console.log('\n--- AUREN RESPONSE ---');
  console.log(res.answer);
  console.log('\nProvider Used:', res.providerUsed);
  console.log('Agent Used:', res.agentUsed);
}

test().catch(console.error);
