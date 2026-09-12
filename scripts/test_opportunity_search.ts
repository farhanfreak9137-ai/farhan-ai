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

import { centralAssistant } from '../src/lib/agents/assistant';

async function runTest() {
  console.log('--- Testing Opportunity Search & Matching for Farhan ---');
  const query = 'Find remote full-stack or AI engineer job opportunities matched to my skills';
  console.log(`Prompt: "${query}"\n`);

  const res = await centralAssistant.processRequest(query);

  console.log('\n--- AUREN RESPONSE ---');
  console.log(res.answer);
  console.log('\nSteps executed:', res.steps.length);
  res.steps.forEach((s) => console.log(` - [${s.type}] ${s.title}: ${s.status}`));
  console.log('\nProvider Used:', res.providerUsed);
}

runTest().catch(console.error);
