// scripts/test_assistant_freelance.ts
import fs from 'fs';
import path from 'path';

// Parse .env.local
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

async function main() {
  const { CentralAssistant } = await import('../src/lib/agents/assistant');
  const { playwrightComputerProvider } = await import('../src/lib/computer/playwrightProvider');

  console.log('--- Initializing Central Assistant ---');
  const assistant = new CentralAssistant();

  const userPrompt = 'Search for live remote Next.js or TypeScript jobs on RemoteOK and summarize the top opportunities for me.';
  console.log(`User: "${userPrompt}"\n`);

  console.log('Sending message to assistant...');
  const result = await assistant.processRequest(userPrompt, {});

  console.log('\n--- Assistant Result ---');
  console.log(`Agent: ${result.agentUsed}`);
  console.log(`Provider: ${result.providerUsed}`);
  console.log(`Answer:\n${result.answer}`);

  // Close browser cleanly
  await playwrightComputerProvider.closeBrowser();
  console.log('\n✅ Assistant Live Freelance Operation Test Passed!');
}

main().catch((err) => {
  console.error('Assistant test error:', err);
  process.exit(1);
});
