import type { Browser, BrowserContext, Page } from 'playwright';
import { v4 as uuidv4 } from 'uuid';
import { ComputerControlProvider, Observation, ProviderState } from '@/lib/computer/provider';
import { join } from 'path';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';

/**
 * Playwright based implementation of ComputerControlProvider.
 * Each session is an isolated Chromium BrowserContext with its own temporary user data directory.
 */
export class PlaywrightComputerProvider implements ComputerControlProvider {
  private browser: Browser | null = null;
  private contexts: Map<string, BrowserContext> = new Map();
  private pages: Map<string, Page> = new Map();
  private tempDirs: Map<string, string> = new Map();

  constructor() {}

  async init(): Promise<void> {
    if (this.browser) return;
    const { chromium } = await import('playwright');
    this.browser = await chromium.launch({ headless: true });
  }

  getState(): ProviderState {
    try {
      require.resolve('playwright');
      return ProviderState.REAL;
    } catch {
      return ProviderState.UNAVAILABLE;
    }
  }

  private async ensureBrowser(): Promise<Browser> {
    if (!this.browser) {
      await this.init();
    }
    return this.browser!;
  }

  /** Create a new isolated session and return its ID */
  async createSession(): Promise<string> {
    const browser = await this.ensureBrowser();
    const tempDir = await mkdtemp(join(tmpdir(), 'computer-session-'));
    const context = await browser.newContext({
      // No persistent storage; isolated per session
      viewport: { width: 1280, height: 720 },
      userAgent: 'FarhanAI/ComputerControl',
      ignoreHTTPSErrors: true,
      // Ensure no cookies or saved credentials are loaded
      storageState: undefined,
    });
    const page = await context.newPage();
    const sessionId = uuidv4();
    this.contexts.set(sessionId, context);
    this.pages.set(sessionId, page);
    this.tempDirs.set(sessionId, tempDir);
    // Auto-cleanup after inactivity (5 min) - schedule timer with unref so it does not block Node exit
    setTimeout(() => this.checkInactivity(sessionId), 5 * 60 * 1000).unref();
    return sessionId;
  }

  private async checkInactivity(sessionId: string) {
    // If the session still exists and has no pages, close it.
    if (this.contexts.has(sessionId) && !this.pages.has(sessionId)) {
      await this.close(sessionId);
    }
  }

  private getPage(sessionId: string): Page {
    const page = this.pages.get(sessionId);
    if (!page) throw new Error(`Session ${sessionId} not found`);
    return page;
  }

  async observe(sessionId: string): Promise<Observation> {
    const page = this.getPage(sessionId);
    const url = page.url();
    const title = await page.title();
    const visibleText = await page.evaluate(() => document.body?.innerText || '');
    
    // Auto-annotate interactive elements with stable data-farhan-id identifiers if missing
    const interactiveElements = await page.$$eval(
      'button, a, input, textarea, select, [role="button"], [role="link"], [role="textbox"], [role="checkbox"]',
      (elements) =>
        elements.map((el, index) => {
          let elementId = el.getAttribute('data-farhan-id');
          if (!elementId) {
            elementId = `el-${index + 1}`;
            el.setAttribute('data-farhan-id', elementId);
          }
          const role = el.getAttribute('role') || el.tagName.toLowerCase();
          const text = (el as HTMLElement).innerText?.trim() || undefined;
          const ariaLabel = el.getAttribute('aria-label') || undefined;
          const tag = el.tagName.toLowerCase();
          const visible = !!(
            el.getClientRects().length &&
            window.getComputedStyle(el).visibility !== 'hidden'
          );
          const enabled = !(el as HTMLInputElement).disabled;
          return { elementId, role, text, ariaLabel, tag, visible, enabled };
        })
    );

    // Auto-annotate form elements with stable data-farhan-id identifiers
    const forms = await page.$$eval('form', (forms) =>
      forms.map((f, formIndex) => {
        let formId = f.getAttribute('data-farhan-id');
        if (!formId) {
          formId = `form-${formIndex + 1}`;
          f.setAttribute('data-farhan-id', formId);
        }
        const fields = Array.from(f.querySelectorAll('input, textarea, select')).map(
          (fld, fieldIndex) => {
            let fieldId = fld.getAttribute('data-farhan-id');
            if (!fieldId) {
              fieldId = (fld as HTMLInputElement).name || (fld as HTMLInputElement).id || `field-${formIndex + 1}-${fieldIndex + 1}`;
              fld.setAttribute('data-farhan-id', fieldId);
            }
            const name = (fld as HTMLInputElement).name || '';
            const type = (fld as HTMLInputElement).type || '';
            const label = fld.getAttribute('aria-label') || '';
            return { fieldId, name, type, label };
          }
        );
        return { formId, fields };
      })
    );

    return {
      url,
      title,
      visibleText,
      interactiveElements,
      forms,
      timestamp: new Date().toISOString(),
    };
  }

  async navigate(sessionId: string, url: string): Promise<void> {
    const page = this.getPage(sessionId);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
  }

  async click(sessionId: string, elementId: string): Promise<void> {
    const page = this.getPage(sessionId);
    const selector = `[data-farhan-id="${elementId}"]`;
    const exists = await page.$(selector);
    if (exists) {
      await page.click(selector);
    } else {
      await page.click(elementId);
    }
  }

  async type(sessionId: string, elementId: string, text: string): Promise<void> {
    const page = this.getPage(sessionId);
    const selector = `[data-farhan-id="${elementId}"]`;
    const exists = await page.$(selector);
    if (exists) {
      await page.fill(selector, text);
    } else {
      await page.fill(elementId, text);
    }
  }

  async fill(sessionId: string, data: Record<string, string>): Promise<void> {
    const page = this.getPage(sessionId);
    for (const [fieldId, value] of Object.entries(data)) {
      const selector = `[data-farhan-id="${fieldId}"]`;
      const exists = await page.$(selector);
      if (exists) {
        await page.fill(selector, value);
      } else {
        const nameSelector = `[name="${fieldId}"]`;
        const nameExists = await page.$(nameSelector);
        if (nameExists) {
          await page.fill(nameSelector, value);
        } else {
          await page.fill(fieldId, value);
        }
      }
    }
  }

  async scroll(sessionId: string, deltaY: number): Promise<void> {
    const page = this.getPage(sessionId);
    await page.evaluate((dy) => window.scrollBy(0, dy), deltaY);
  }

  async wait(sessionId: string, ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  async goBack(sessionId: string): Promise<void> {
    const page = this.getPage(sessionId);
    await page.goBack();
  }

  async goForward(sessionId: string): Promise<void> {
    const page = this.getPage(sessionId);
    await page.goForward();
  }

  async screenshot(sessionId: string): Promise<string> {
    const page = this.getPage(sessionId);
    const tempDir = this.tempDirs.get(sessionId) ?? tmpdir();
    const filePath = join(tempDir, `${uuidv4()}.png`);
    await page.screenshot({ path: filePath, fullPage: true });
    return filePath;
  }

  async close(sessionId: string): Promise<void> {
    const context = this.contexts.get(sessionId);
    const tempDir = this.tempDirs.get(sessionId);
    if (context) {
      await context.close().catch(() => {});
    }
    this.contexts.delete(sessionId);
    this.pages.delete(sessionId);
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
      this.tempDirs.delete(sessionId);
    }
  }

  /** Terminate underlying Chromium browser process and free all resources */
  async closeBrowser(): Promise<void> {
    if (this.browser) {
      for (const [sid] of this.contexts) {
        await this.close(sid).catch(() => {});
      }
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }
}

// Export a singleton instance used by the API layer.
export const playwrightComputerProvider = new PlaywrightComputerProvider();
