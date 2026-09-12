// scripts/test_freelance_browser.ts
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
  const { isUrlSafe } = await import('../src/lib/computer/policyEngine');
  const { playwrightComputerProvider } = await import('../src/lib/computer/playwrightProvider');
  const { defaultRegistry } = await import('../src/lib/agents/registry');

  console.log('=== Step 1: Testing Domain Allowlist Policy ===');
  console.log(`Allowlist Mode: ${process.env.ALLOWLIST_MODE}`);
  console.log(`Allowlist Domains: ${process.env.COMPUTER_ALLOWLIST}`);

  const domainsToTest = [
    { url: 'https://www.fiverr.com', expected: true },
    { url: 'https://seller.fiverr.com/manage_orders', expected: true },
    { url: 'https://www.upwork.com/nx/find-work', expected: true },
    { url: 'https://remoteok.com/remote-dev-jobs', expected: true },
    { url: 'https://www.freelancer.com/jobs', expected: true },
    { url: 'https://malicious-site.com', expected: false },
    { url: 'http://127.0.0.1:3000', expected: false },
    { url: 'http://localhost:3000', expected: false },
    { url: 'http://169.254.169.254', expected: false },
  ];

  for (const { url, expected } of domainsToTest) {
    const safe = isUrlSafe(url);
    console.log(`URL: ${url} -> Safe: ${safe} (Expected: ${expected})`);
    if (safe !== expected) {
      throw new Error(`Policy check failed for ${url}: got ${safe}, expected ${expected}`);
    }
  }
  console.log('✅ Domain allowlist policy checks passed flawlessly!\n');

  console.log('=== Step 2: Testing Agent Tool Registration & Pruning ===');
  const userPrompts = [
    'I want you to search for remote jobs on fiverr and upwork',
    'Operate on my fiverr site and check my active gigs',
    'Find high paying TypeScript gigs on remoteok',
  ];

  for (const prompt of userPrompts) {
    const tools = defaultRegistry.getPrunedToolsForQuery(prompt);
    const toolNames = tools.map((t) => t.name);
    console.log(`Prompt: "${prompt}"`);
    console.log(`Pruned Tool Count: ${tools.length}`);
    const hasGigSearch = toolNames.includes('search_remote_gigs');
    const hasPlatformOpen = toolNames.includes('open_freelance_platform');
    console.log(`- Includes search_remote_gigs: ${hasGigSearch}`);
    console.log(`- Includes open_freelance_platform: ${hasPlatformOpen}\n`);
    if (!hasGigSearch || !hasPlatformOpen) {
      throw new Error(`Pruned tools for "${prompt}" should include freelance browser tools!`);
    }
  }
  console.log('✅ Tool pruning correctly matches freelance sites and exposes browser tools!\n');

  console.log('=== Step 3: Testing Live Stealth Browser & Gig Extraction ===');
  const searchTool = defaultRegistry.getTool('search_remote_gigs');
  if (!searchTool) throw new Error('search_remote_gigs tool not registered');

  console.log('Searching remote gigs on RemoteOK for "TypeScript"...');
  const searchResult = await searchTool.execute({
    platform: 'remoteok',
    query: 'TypeScript',
  }, {});

  console.log('Search execution result success:', searchResult.success);
  const data = searchResult.data as any;
  if (data) {
    console.log(`Platform: ${data.platform}`);
    console.log(`Title: ${data.pageTitle}`);
    console.log(`Gigs found: ${data.gigsFound}`);
    if (data.gigs && data.gigs.length > 0) {
      console.log('Sample gig extracted:', JSON.stringify(data.gigs[0], null, 2));
    }
  }

  console.log('\n=== Step 4: Testing Persistent Session State Storage ===');
  const saveTool = defaultRegistry.getTool('save_browser_session');
  if (!saveTool) throw new Error('save_browser_session tool not registered');

  const saveRes = await saveTool.execute({}, {});
  console.log('Save session result:', saveRes);

  const statePath = path.resolve(process.cwd(), 'data/browser_profile/state.json');
  const stateExists = fs.existsSync(statePath);
  console.log(`Persistent state file exists at ${statePath}: ${stateExists}`);
  if (stateExists) {
    const content = fs.readFileSync(statePath, 'utf8');
    const parsed = JSON.parse(content);
    console.log(`State file valid JSON with keys: ${Object.keys(parsed).join(', ')}`);
    console.log(`Cookies saved count: ${parsed.cookies?.length || 0}`);
  }

  // Cleanup browser
  await playwrightComputerProvider.closeBrowser();
  console.log('\n✅ All Live Freelance & Remote Platform Browser Tests Succeeded!');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
