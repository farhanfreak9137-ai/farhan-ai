import type { Browser, BrowserContext, Page } from 'playwright';
import { v4 as uuidv4 } from 'uuid';
import { ComputerControlProvider, Observation, ProviderState } from '@/lib/computer/provider';
import { join, resolve } from 'path';
import { mkdtemp, rm, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { tmpdir } from 'os';

export interface ExtractedGig {
  id: string;
  title: string;
  platform: string;
  companyOrSeller: string;
  priceOrBudget?: string;
  ratingOrReviews?: string;
  url: string;
  tags: string[];
  snippet: string;
}

/**
 * Playwright based implementation of ComputerControlProvider.
 * Features:
 * - Real desktop Chrome stealth User-Agent & bot masking (evades Cloudflare/CAPTCHA flag).
 * - Headed browser mode support (BROWSER_HEADLESS=false) for manual 2FA & visual confirmation.
 * - Persistent session storage (data/browser_profile/state.json) so logins on Fiverr/Upwork persist.
 * - Direct gig/job scraping for freelance and remote platforms.
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
    const isHeadless = process.env.BROWSER_HEADLESS !== 'false' && process.env.BROWSER_HEADLESS !== '0';

    this.browser = await chromium.launch({
      headless: isHeadless,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-infobars',
        '--disable-dev-shm-usage',
        '--start-maximized',
      ],
    });
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

  /**
   * Get the persistent state.json path
   */
  public getStorageStatePath(): string {
    const profileDir = resolve(process.cwd(), process.env.BROWSER_PROFILE_DIR || './data/browser_profile');
    return join(profileDir, 'state.json');
  }

  /**
   * Returns an active session ID if one is currently open.
   */
  public getActiveSessionId(): string | null {
    for (const [sid] of this.contexts) {
      return sid;
    }
    return null;
  }

  /**
   * Create a new browser session.
   * If persistent storage is enabled and state.json exists, loads stored cookies/tokens.
   */
  async createSession(): Promise<string> {
    const browser = await this.ensureBrowser();
    const tempDir = await mkdtemp(join(tmpdir(), 'computer-session-'));

    const isPersistent = process.env.BROWSER_PERSISTENT !== 'false';
    const stateFile = this.getStorageStatePath();
    const profileDir = resolve(process.cwd(), process.env.BROWSER_PROFILE_DIR || './data/browser_profile');

    if (isPersistent && !existsSync(profileDir)) {
      await mkdir(profileDir, { recursive: true });
    }

    const hasState = isPersistent && existsSync(stateFile);

    const context = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      ignoreHTTPSErrors: true,
      storageState: hasState ? stateFile : undefined,
    });

    // Mask bot indicators
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
      (window as any).chrome = {
        runtime: {},
        loadTimes: function () {},
        csi: function () {},
        app: {},
      };
    });

    const page = await context.newPage();
    const sessionId = uuidv4();
    this.contexts.set(sessionId, context);
    this.pages.set(sessionId, page);
    this.tempDirs.set(sessionId, tempDir);

    // Auto-cleanup after inactivity (15 min) - schedule timer with unref so it does not block Node exit
    setTimeout(() => this.checkInactivity(sessionId), 15 * 60 * 1000).unref();
    return sessionId;
  }

  /**
   * Saves the current cookies & localStorage state to disk so logins persist across sessions.
   */
  async saveSessionState(sessionId?: string): Promise<string> {
    const isPersistent = process.env.BROWSER_PERSISTENT !== 'false';
    if (!isPersistent) return '';

    const profileDir = resolve(process.cwd(), process.env.BROWSER_PROFILE_DIR || './data/browser_profile');
    if (!existsSync(profileDir)) {
      await mkdir(profileDir, { recursive: true });
    }
    const stateFile = join(profileDir, 'state.json');

    if (sessionId) {
      const context = this.contexts.get(sessionId);
      if (context) {
        try {
          await context.storageState({ path: stateFile });
          return stateFile;
        } catch (_) {}
      }
    }

    for (const [, ctx] of this.contexts) {
      try {
        await ctx.storageState({ path: stateFile });
        return stateFile;
      } catch (_) {}
    }

    return stateFile;
  }

  private async checkInactivity(sessionId: string) {
    if (this.contexts.has(sessionId) && !this.pages.has(sessionId)) {
      await this.close(sessionId);
    }
  }

  public getPage(sessionId: string): Page {
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
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 35000 });
    // Persist session state after page load
    await this.saveSessionState(sessionId).catch(() => {});
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
    await this.saveSessionState(sessionId).catch(() => {});
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
    await this.saveSessionState(sessionId).catch(() => {});
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
    await this.saveSessionState(sessionId).catch(() => {});
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

  /**
   * Scrapes structured gigs/job postings directly from live platform pages.
   */
  async extractGigs(sessionId: string, platformHint?: string): Promise<ExtractedGig[]> {
    const page = this.getPage(sessionId);

    return await page.evaluate((hint) => {
      const currentUrl = window.location.href.toLowerCase();
      const results: Array<{
        id: string;
        title: string;
        platform: string;
        companyOrSeller: string;
        priceOrBudget?: string;
        ratingOrReviews?: string;
        url: string;
        tags: string[];
        snippet: string;
      }> = [];

      // 1. RemoteOK extractor
      if (currentUrl.includes('remoteok') || hint === 'remoteok') {
        const rows = document.querySelectorAll('tr.job, .job');
        rows.forEach((el, idx) => {
          if (el.classList.contains('ad') || el.classList.contains('closed')) return;
          const titleEl = el.querySelector('h2[itemprop="title"], h2, .company h2');
          const title = titleEl?.textContent?.trim() || '';
          if (!title) return;

          const companyEl = el.querySelector('h3[itemprop="name"], h3, .company h3');
          const company = companyEl?.textContent?.trim() || 'Remote Company';

          const salaryEl = el.querySelector('.salary, .location');
          const salary = salaryEl?.textContent?.trim();

          const linkEl = el.querySelector('a.preventLink, a[itemprop="url"], a');
          const jobUrl = (linkEl as HTMLAnchorElement)?.href || window.location.href;

          const tagEls = el.querySelectorAll('.tag h3, .tag');
          const tags: string[] = [];
          tagEls.forEach((t) => {
            const txt = t.textContent?.trim();
            if (txt && !tags.includes(txt)) tags.push(txt);
          });

          results.push({
            id: el.getAttribute('data-id') || `remoteok-${idx + 1}`,
            title,
            platform: 'RemoteOK',
            companyOrSeller: company,
            priceOrBudget: salary || undefined,
            url: jobUrl,
            tags,
            snippet: `${company} is hiring for ${title} (${salary || 'Competitive'})`,
          });
        });

        if (results.length > 0) return results.slice(0, 20);
      }

      // 2. Fiverr extractor
      if (currentUrl.includes('fiverr') || hint === 'fiverr') {
        const gigCards = document.querySelectorAll('[data-gig-id], .gig-card-layout, article.gig-card-layout, .gig-wrapper');
        gigCards.forEach((el, idx) => {
          const gigId = el.getAttribute('data-gig-id') || `fiverr-${idx + 1}`;
          const titleEl = el.querySelector('.gig-title, h3, a[title], p[title]');
          const title = titleEl?.getAttribute('title') || titleEl?.textContent?.trim() || '';
          if (!title) return;

          const sellerEl = el.querySelector('.seller-name, .seller-info, a[href^="/"]');
          const seller = sellerEl?.textContent?.trim() || 'Fiverr Pro';

          const priceEl = el.querySelector('.price, [data-testid="price"], span[class*="price"]');
          const price = priceEl?.textContent?.trim();

          const ratingEl = el.querySelector('.rating-wrapper, [class*="rating"], .star-rating');
          const rating = ratingEl?.textContent?.trim();

          const linkEl = el.querySelector('a[href*="/gig/"], a[href*="/gigs/"], a');
          const gigUrl = (linkEl as HTMLAnchorElement)?.href || window.location.href;

          const tags: string[] = [];
          const badgeEl = el.querySelector('.gig-badge, [class*="badge"]');
          if (badgeEl?.textContent?.trim()) tags.push(badgeEl.textContent.trim());

          results.push({
            id: gigId,
            title,
            platform: 'Fiverr',
            companyOrSeller: seller,
            priceOrBudget: price || undefined,
            ratingOrReviews: rating || undefined,
            url: gigUrl,
            tags,
            snippet: `Fiverr Gig: ${title} by ${seller} (${price || 'Starting rate'})`,
          });
        });

        if (results.length > 0) return results.slice(0, 20);
      }

      // 3. Upwork extractor
      if (currentUrl.includes('upwork') || hint === 'upwork') {
        const jobCards = document.querySelectorAll('article[data-test="job-tile-list"], section.air3-card-section, [data-qa="job-tile"], article');
        jobCards.forEach((el, idx) => {
          const titleEl = el.querySelector('[data-test="job-tile-title-link"], [data-qa="job-title"] a, h2, h3');
          const title = titleEl?.textContent?.trim() || '';
          if (!title) return;

          const budgetEl = el.querySelector('[data-test="budget"], [data-test="is-hourly"], [data-test="job-type"]');
          const budget = budgetEl?.textContent?.trim();

          const linkEl = el.querySelector('[data-test="job-tile-title-link"], a[href*="/jobs/"], a');
          const jobUrl = (linkEl as HTMLAnchorElement)?.href || window.location.href;

          const snippetEl = el.querySelector('[data-test="job-description-text"], .air3-line-clamp');
          const snippet = snippetEl?.textContent?.trim() || title;

          const tagEls = el.querySelectorAll('[data-test="attr-item"], .air3-token, button[data-test="attr-item"]');
          const tags: string[] = [];
          tagEls.forEach((t) => {
            const txt = t.textContent?.trim();
            if (txt && !tags.includes(txt)) tags.push(txt);
          });

          results.push({
            id: el.getAttribute('data-job-id') || `upwork-${idx + 1}`,
            title,
            platform: 'Upwork',
            companyOrSeller: 'Upwork Client',
            priceOrBudget: budget || undefined,
            url: jobUrl,
            tags,
            snippet: snippet.slice(0, 200),
          });
        });

        if (results.length > 0) return results.slice(0, 20);
      }

      // 4. Generic Extractor (Freelancer, LinkedIn, Wellfound, WeWorkRemotely, Indeed)
      const cardElements = document.querySelectorAll('article, [class*="job-card"], [class*="jobCard"], [class*="job_listing"], li[data-job-id]');
      cardElements.forEach((el, idx) => {
        const titleEl = el.querySelector('h1, h2, h3, h4, [class*="title"]');
        const title = titleEl?.textContent?.trim() || '';
        if (!title || title.length < 4) return;

        const companyEl = el.querySelector('[class*="company"], [class*="employer"], [class*="client"], [class*="seller"]');
        const company = companyEl?.textContent?.trim() || 'Remote Employer';

        const linkEl = el.querySelector('a');
        const jobUrl = linkEl?.href || window.location.href;

        const priceEl = el.querySelector('[class*="salary"], [class*="budget"], [class*="price"], [class*="compensation"]');
        const price = priceEl?.textContent?.trim();

        results.push({
          id: `generic-${idx + 1}`,
          title,
          platform: window.location.hostname.replace(/^www\./, ''),
          companyOrSeller: company,
          priceOrBudget: price || undefined,
          url: jobUrl,
          tags: [],
          snippet: `${company} - ${title}`,
        });
      });

      return results.slice(0, 20);
    }, platformHint);
  }

  async close(sessionId: string): Promise<void> {
    await this.saveSessionState(sessionId).catch(() => {});
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
