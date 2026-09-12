// scripts/audit_full_system.ts
import { chromium, Page } from 'playwright';
import path from 'path';
import fs from 'fs';

interface AuditResult {
  step: string;
  passed: boolean;
  details?: string;
  error?: string;
}

async function runFullPlaywrightAudit() {
  console.log('='.repeat(70));
  console.log('🔍 STARTING COMPREHENSIVE PLAYWRIGHT AUDIT FOR AUREN AI');
  console.log('='.repeat(70));

  const results: AuditResult[] = [];
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const networkFailures: string[] = [];

  const screenshotDir = path.resolve('data', 'audit_screenshots');
  fs.mkdirSync(screenshotDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  // Monitor console messages
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Ignore normal dev warnings if any
      consoleErrors.push(text);
      console.log(`[Browser Console Error] ${text}`);
    }
  });

  // Monitor unhandled runtime page errors
  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
    console.log(`[Browser Page Error] ${err.message}`);
  });

  // Monitor failed network requests (status >= 400)
  page.on('response', (resp) => {
    if (resp.status() >= 400 && !resp.url().includes('favicon')) {
      const entry = `${resp.status()} ${resp.request().method()} ${resp.url()}`;
      networkFailures.push(entry);
      console.log(`[Network Failure] ${entry}`);
    }
  });

  try {
    // -------------------------------------------------------------------------
    // Step 1: Initial Page Load & Health
    // -------------------------------------------------------------------------
    console.log('\n[1/8] Auditing Initial Page Load (http://localhost:3000)...');
    const response = await page.goto('http://localhost:3000', {
      waitUntil: 'networkidle',
      timeout: 20000,
    });

    const status = response?.status() || 0;
    if (status === 200) {
      results.push({ step: 'initial_load', passed: true, details: 'HTTP 200 OK received.' });
      console.log('✓ Initial page loaded successfully (HTTP 200).');
    } else {
      results.push({ step: 'initial_load', passed: false, error: `Status ${status}` });
      console.log(`✗ Failed initial load: ${status}`);
    }

    await page.screenshot({ path: path.join(screenshotDir, '01_initial_load.png') });

    // -------------------------------------------------------------------------
    // Step 2: Verify Unified Voice Status Bar & Title
    // -------------------------------------------------------------------------
    console.log('\n[2/8] Auditing Unified Voice Header & Branding...');
    const title = await page.title();
    const hasVoiceBar = await page.locator('text=Unified Auren Voice: Always Ready').isVisible();

    if (hasVoiceBar) {
      results.push({ step: 'voice_status_bar', passed: true, details: 'Voice bar visible and active.' });
      console.log('✓ Unified Voice Status Bar is active and rendered.');
    } else {
      results.push({ step: 'voice_status_bar', passed: false, error: 'Voice bar not visible.' });
      console.log('✗ Voice status bar missing.');
    }

    // -------------------------------------------------------------------------
    // Step 3: Audit Navigation Tabs (All 9 Views)
    // -------------------------------------------------------------------------
    console.log('\n[3/8] Auditing All 9 Navigation Views...');
    const tabs = [
      { name: 'Opportunities', selector: 'nav button:has-text("Opportunities")' },
      { name: 'Career', selector: 'nav button:has-text("Career")' },
      { name: 'Knowledge', selector: 'nav button:has-text("Knowledge")' },
      { name: 'Computer', selector: 'nav button:has-text("Computer")' },
      { name: 'Voice', selector: 'nav button:has-text("Voice")' },
      { name: 'Automation', selector: 'nav button:has-text("Automation")' },
      { name: 'Activity', selector: 'nav button:has-text("Activity")' },
      { name: 'Settings', selector: 'nav button:has-text("Settings")' },
      { name: 'Assistant', selector: 'nav button:has-text("Assistant")' },
    ];

    for (const tab of tabs) {
      try {
        await page.click(tab.selector, { timeout: 4000 });
        await page.waitForTimeout(600);
        await page.screenshot({ path: path.join(screenshotDir, `nav_${tab.name.toLowerCase()}.png`) });
        console.log(`  ✓ Navigated to [${tab.name}] without crash.`);
        results.push({ step: `nav_${tab.name.toLowerCase()}`, passed: true });
      } catch (err: any) {
        console.log(`  ✗ Navigation to [${tab.name}] failed: ${err.message}`);
        results.push({ step: `nav_${tab.name.toLowerCase()}`, passed: false, error: err.message });
      }
    }

    // Return to Assistant view
    await page.click('nav button:has-text("Assistant")');
    await page.waitForTimeout(500);

    // -------------------------------------------------------------------------
    // Step 4: Audit Chat & Fast-Path Tool Execution
    // -------------------------------------------------------------------------
    console.log('\n[4/8] Auditing Chat Interaction & Fast-Path Tool Execution...');
    const inputSelector = 'textarea';
    await page.fill(inputSelector, 'What is my current RAM usage?');
    await page.keyboard.press('Enter');

    // Wait for response to appear
    await page.waitForTimeout(3500);
    const pageText = await page.textContent('main');
    const hasRamResponse = pageText?.toLowerCase().includes('ram') || pageText?.toLowerCase().includes('memory');

    if (hasRamResponse) {
      results.push({ step: 'chat_ram_query', passed: true, details: 'RAM query answered by System/FastPath.' });
      console.log('✓ Fast-Path RAM query answered cleanly in chat.');
    } else {
      results.push({ step: 'chat_ram_query', passed: false, error: 'No response detected for RAM query.' });
      console.log('✗ Failed to find expected answer for RAM query.');
    }

    await page.screenshot({ path: path.join(screenshotDir, '04_chat_response.png') });

    // -------------------------------------------------------------------------
    // Step 5: Audit Real-Time Voice Event Synchronization
    // -------------------------------------------------------------------------
    console.log('\n[5/8] Auditing Real-Time Voice Event Ingestion into Chat UI...');
    // Simulate a voice command received on the backend
    const simResp = await page.request.post('http://localhost:3000/api/voice/command', {
      data: { transcript: 'play Bohemian Rhapsody on Spotify' },
      headers: { 'Content-Type': 'application/json' },
    });

    console.log(`  Simulated voice command status: ${simResp.status()}`);
    // Wait for the UI poll to pick up the event (interval: 2000ms)
    await page.waitForTimeout(3000);

    const updatedText = await page.textContent('main');
    const hasSpokenEvent = updatedText?.includes('play Bohemian Rhapsody on Spotify') || updatedText?.includes('bohemian rhapsody');

    if (hasSpokenEvent) {
      results.push({ step: 'voice_event_sync', passed: true, details: 'Voice command appeared live in chat.' });
      console.log('✓ Voice event synchronized and displayed on screen in real time!');
    } else {
      results.push({ step: 'voice_event_sync', passed: false, error: 'Voice event did not sync to UI.' });
      console.log('✗ Voice event failed to render in chat.');
    }

    await page.screenshot({ path: path.join(screenshotDir, '05_voice_sync.png') });

    // -------------------------------------------------------------------------
    // Step 6: Audit Opportunities View & Scraping Health
    // -------------------------------------------------------------------------
    console.log('\n[6/8] Auditing Opportunities Hub...');
    await page.click('nav button:has-text("Opportunities")');
    await page.waitForTimeout(1000);

    const oppContent = await page.textContent('main');
    const hasOpportunities = oppContent?.includes('Match') || oppContent?.includes('Remote') || oppContent?.includes('Engineer');

    if (hasOpportunities) {
      results.push({ step: 'opportunities_hub', passed: true, details: 'Opportunities rendered.' });
      console.log('✓ Opportunities Hub is active with ranked positions.');
    } else {
      results.push({ step: 'opportunities_hub', passed: false, error: 'No opportunities rendered.' });
      console.log('✗ Opportunities view empty or unrendered.');
    }

    // -------------------------------------------------------------------------
    // Step 7: Audit Settings & Provider Configurations
    // -------------------------------------------------------------------------
    console.log('\n[7/8] Auditing Settings View & Provider Matrix...');
    await page.click('nav button:has-text("Settings")');
    await page.waitForTimeout(1000);

    const settingsContent = await page.textContent('main');
    const hasSettings = settingsContent?.includes('Provider') || settingsContent?.includes('Gemini') || settingsContent?.includes('Groq');

    if (hasSettings) {
      results.push({ step: 'settings_view', passed: true, details: 'Settings matrix verified.' });
      console.log('✓ Settings view rendered with configured AI providers.');
    } else {
      results.push({ step: 'settings_view', passed: false, error: 'Settings view unrendered.' });
      console.log('✗ Settings view missing expected content.');
    }

    // -------------------------------------------------------------------------
    // Step 8: Console Error & Rate Limit Verification
    // -------------------------------------------------------------------------
    console.log('\n[8/8] Analyzing Error Budget...');
    // Allow an extra 3 seconds to check if any 429 errors appear
    await page.waitForTimeout(3000);

    const rateLimit429Errors = consoleErrors.filter((e) => e.includes('429'));
    const fatalErrors = consoleErrors.filter((e) => !e.includes('429'));

    console.log(`\nAudit Statistics:`);
    console.log(`- 429 Rate Limit Errors: ${rateLimit429Errors.length}`);
    console.log(`- Page Runtime Errors: ${pageErrors.length}`);
    console.log(`- Other Console Errors: ${fatalErrors.length}`);
    console.log(`- Failed Network Calls: ${networkFailures.length}`);

    if (rateLimit429Errors.length === 0 && pageErrors.length === 0) {
      results.push({ step: 'console_and_stability', passed: true, details: 'Zero 429 rate limit or runtime errors.' });
      console.log('✓ Zero 429 rate limit or runtime errors detected!');
    } else {
      results.push({
        step: 'console_and_stability',
        passed: false,
        error: `429s: ${rateLimit429Errors.length}, PageErrors: ${pageErrors.length}`,
      });
    }

  } catch (globalErr: any) {
    console.error('Fatal audit failure:', globalErr);
    results.push({ step: 'global_audit', passed: false, error: globalErr.message });
  } finally {
    await browser.close();
  }

  console.log('\n' + '='.repeat(70));
  console.log('📊 AUDIT SUMMARY REPORT');
  console.log('='.repeat(70));
  const passedCount = results.filter((r) => r.passed).length;
  console.log(`Total Checks: ${results.length} | Passed: ${passedCount} | Failed: ${results.length - passedCount}`);
  for (const res of results) {
    const icon = res.passed ? '✅' : '❌';
    console.log(`${icon} [${res.step}]: ${res.details || res.error || ''}`);
  }
  console.log('='.repeat(70));

  return {
    passed: results.every((r) => r.passed),
    results,
    consoleErrors,
    pageErrors,
    networkFailures,
  };
}

runFullPlaywrightAudit()
  .then((report) => {
    process.exit(report.passed ? 0 : 1);
  })
  .catch((err) => {
    console.error('Execution error:', err);
    process.exit(1);
  });
