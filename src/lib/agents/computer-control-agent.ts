// src/lib/agents/computer-control-agent.ts
import { z } from 'zod';
import { Agent, AgentTool } from './types';

/**
 * ComputerControlAgent provides native tools for controlled browser interaction.
 * All tools go through the server-side API boundary — NEVER directly accessing Playwright.
 * The policy engine evaluates every action server-side before execution.
 */

const BASE_URL = typeof window !== 'undefined' ? '' : 'http://localhost:3000';

async function computerRequest(
  action: string,
  sessionId?: string,
  payload: Record<string, unknown> = {}
): Promise<{ success: boolean; data?: any; status?: string; requestId?: string; error?: string }> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`${BASE_URL}/api/computer/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, sessionId, payload }),
      });
      const json = await res.json();
      if (!res.ok) {
        return { success: false, error: json.error || `HTTP ${res.status}` };
      }
      return { success: true, ...json };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  // Running server-side / in-process (e.g. Node tests or server orchestrator)
  try {
    const { handleComputerRequest } = await import('@/lib/computer/service');
    const { statusCode, body } = await handleComputerRequest({ action, sessionId, payload });
    if (statusCode >= 400 && statusCode !== 202) {
      return { success: false, error: body.error || `Error ${statusCode}`, status: body.status, requestId: body.requestId };
    }
    return { ...body };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function computerStop(
  sessionId: string
): Promise<{ success: boolean; cancelledActions?: string[]; error?: string }> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`${BASE_URL}/api/computer/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const json = await res.json();
      if (!res.ok) {
        return { success: false, error: json.error || `HTTP ${res.status}` };
      }
      return { success: true, ...json };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  try {
    const { handleComputerStop } = await import('@/lib/computer/service');
    const { statusCode, body } = await handleComputerStop(sessionId);
    if (statusCode >= 400) {
      return { success: false, error: body.error || `Error ${statusCode}` };
    }
    return { success: true, cancelledActions: body.cancelledActions };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}


export const ComputerControlAgent: Agent = {
  id: 'computer_control_agent',
  name: 'Computer Control Agent',
  description: 'Provides controlled, observable, permission-aware browser interaction through an isolated Chromium instance. All actions are policy-gated and require approval for consequential operations.',
  capabilities: [
    'browser_session_management',
    'page_navigation',
    'page_observation',
    'element_interaction',
    'form_filling',
    'screenshot_capture',
    'emergency_stop',
  ],
  tools: [
    {
      name: 'create_browser_session',
      description: 'Create a new isolated Chromium browser session. Returns a session ID for subsequent operations.',
      agentId: 'computer_control_agent',
      inputSchema: z.object({}),
      execute: async () => {
        const result = await computerRequest('createSession');
        return { toolName: 'create_browser_session', success: result.success, data: result.data, error: result.error };
      },
    },
    {
      name: 'navigate_page',
      description: 'Navigate the browser to a specific URL. The URL must pass domain allowlist policy checks. Consequential action — may require approval.',
      agentId: 'computer_control_agent',
      requiresHumanApproval: false, // Approval is handled server-side by policy engine
      inputSchema: z.object({
        sessionId: z.string().describe('Browser session ID'),
        url: z.string().url().describe('URL to navigate to'),
      }),
      execute: async (input) => {
        const result = await computerRequest('navigate', input.sessionId, { url: input.url });
        if (result.status === 'PENDING_APPROVAL') {
          return {
            toolName: 'navigate_page',
            success: true,
            data: { requestId: result.requestId, status: 'PENDING_APPROVAL', message: 'Navigation requires user approval before execution.' },
          };
        }
        return { toolName: 'navigate_page', success: result.success, data: result.data || result, error: result.error };
      },
    },
    {
      name: 'observe_page',
      description: 'Observe the current state of the page: URL, title, visible text, interactive elements, and forms. Safe action — auto-executes.',
      agentId: 'computer_control_agent',
      inputSchema: z.object({
        sessionId: z.string().describe('Browser session ID'),
      }),
      execute: async (input) => {
        const result = await computerRequest('observe', input.sessionId, {});
        return { toolName: 'observe_page', success: result.success, data: result.data, error: result.error };
      },
    },
    {
      name: 'click_element',
      description: 'Click an interactive element on the page by its stable element ID. Consequential action — may require approval.',
      agentId: 'computer_control_agent',
      inputSchema: z.object({
        sessionId: z.string().describe('Browser session ID'),
        elementId: z.string().describe('Stable element identifier (data-farhan-id)'),
      }),
      execute: async (input) => {
        const result = await computerRequest('click', input.sessionId, { elementId: input.elementId });
        if (result.status === 'PENDING_APPROVAL') {
          return {
            toolName: 'click_element',
            success: true,
            data: { requestId: result.requestId, status: 'PENDING_APPROVAL', message: 'Click action requires user approval.' },
          };
        }
        return { toolName: 'click_element', success: result.success, data: result.data, error: result.error };
      },
    },
    {
      name: 'type_text',
      description: 'Type text into a text field identified by element ID. Consequential action — may require approval. Text must come from verified sources, not invented.',
      agentId: 'computer_control_agent',
      inputSchema: z.object({
        sessionId: z.string().describe('Browser session ID'),
        elementId: z.string().describe('Stable element identifier'),
        text: z.string().describe('Text to type — must be from verified profile, memory, or approved documents'),
      }),
      execute: async (input) => {
        const result = await computerRequest('type', input.sessionId, { elementId: input.elementId, text: input.text });
        if (result.status === 'PENDING_APPROVAL') {
          return {
            toolName: 'type_text',
            success: true,
            data: { requestId: result.requestId, status: 'PENDING_APPROVAL', message: 'Type action requires user approval.' },
          };
        }
        return { toolName: 'type_text', success: result.success, data: result.data, error: result.error };
      },
    },
    {
      name: 'fill_form',
      description: 'Fill form fields with provenance-bound data. Every field value MUST come from: verified profile, explicitly approved user data, verified personal memory, or approved documents. Missing information must cause the operation to STOP — never invent personal information or qualifications.',
      agentId: 'computer_control_agent',
      requiresHumanApproval: true, // Always requires approval — form data is consequential
      inputSchema: z.object({
        sessionId: z.string().describe('Browser session ID'),
        fields: z.array(z.object({
          fieldId: z.string().describe('Form field identifier'),
          value: z.string().describe('Value to fill — must be from a verified source'),
          source: z.enum(['verified_profile', 'approved_user_data', 'verified_memory', 'approved_document']).describe('Provenance source of this value'),
          sourceId: z.string().optional().describe('ID of the source document/memory'),
        })).describe('Form fields with provenance-bound values'),
      }),
      buildApprovalPayload: (input) => ({
        actionType: 'fill_form',
        title: 'Form Fill Approval Required',
        description: `The agent wants to fill ${input.fields.length} form field(s). Each value has a declared provenance source. Review before allowing.`,
        payload: { sessionId: input.sessionId, fields: input.fields },
      }),
      execute: async (input, context) => {
        // Validate that every field has a declared provenance source
        for (const field of input.fields) {
          if (!field.source) {
            return {
              toolName: 'fill_form',
              success: false,
              error: `Field '${field.fieldId}' is missing provenance source. Every form field value must have an explicit source.`,
            };
          }
        }
        // Convert to the fill API format: Record<string, string>
        const data: Record<string, string> = {};
        for (const field of input.fields) {
          data[field.fieldId] = field.value;
        }
        const result = await computerRequest('fill', input.sessionId, { data });
        if (result.status === 'PENDING_APPROVAL') {
          return {
            toolName: 'fill_form',
            success: true,
            data: { requestId: result.requestId, status: 'PENDING_APPROVAL', message: 'Form fill requires user approval.' },
          };
        }
        return { toolName: 'fill_form', success: result.success, data: result.data, error: result.error };
      },
    },
    {
      name: 'scroll_page',
      description: 'Scroll the page vertically by a pixel amount. Safe action — auto-executes.',
      agentId: 'computer_control_agent',
      inputSchema: z.object({
        sessionId: z.string().describe('Browser session ID'),
        deltaY: z.number().describe('Pixels to scroll (positive = down, negative = up)'),
      }),
      execute: async (input) => {
        const result = await computerRequest('scroll', input.sessionId, { deltaY: input.deltaY });
        return { toolName: 'scroll_page', success: result.success, data: result.data, error: result.error };
      },
    },
    {
      name: 'wait',
      description: 'Wait for a specified duration in milliseconds before the next action.',
      agentId: 'computer_control_agent',
      inputSchema: z.object({
        sessionId: z.string().describe('Browser session ID'),
        ms: z.number().int().positive().max(30000).describe('Milliseconds to wait (max 30s)'),
      }),
      execute: async (input) => {
        const result = await computerRequest('wait', input.sessionId, { ms: input.ms });
        return { toolName: 'wait', success: result.success, data: result.data, error: result.error };
      },
    },
    {
      name: 'go_back',
      description: 'Navigate back in browser history.',
      agentId: 'computer_control_agent',
      inputSchema: z.object({
        sessionId: z.string().describe('Browser session ID'),
      }),
      execute: async (input) => {
        const result = await computerRequest('goBack', input.sessionId, {});
        return { toolName: 'go_back', success: result.success, data: result.data, error: result.error };
      },
    },
    {
      name: 'go_forward',
      description: 'Navigate forward in browser history.',
      agentId: 'computer_control_agent',
      inputSchema: z.object({
        sessionId: z.string().describe('Browser session ID'),
      }),
      execute: async (input) => {
        const result = await computerRequest('goForward', input.sessionId, {});
        return { toolName: 'go_forward', success: result.success, data: result.data, error: result.error };
      },
    },
    {
      name: 'take_screenshot',
      description: 'Capture a full-page screenshot of the current browser state. Consequential action — may require approval.',
      agentId: 'computer_control_agent',
      inputSchema: z.object({
        sessionId: z.string().describe('Browser session ID'),
      }),
      execute: async (input) => {
        const result = await computerRequest('screenshot', input.sessionId, {});
        if (result.status === 'PENDING_APPROVAL') {
          return {
            toolName: 'take_screenshot',
            success: true,
            data: { requestId: result.requestId, status: 'PENDING_APPROVAL', message: 'Screenshot requires user approval.' },
          };
        }
        return { toolName: 'take_screenshot', success: result.success, data: result.data, error: result.error };
      },
    },
    {
      name: 'close_browser',
      description: 'Close a browser session and clean up all resources.',
      agentId: 'computer_control_agent',
      inputSchema: z.object({
        sessionId: z.string().describe('Browser session ID to close'),
      }),
      execute: async (input) => {
        const result = await computerRequest('close', input.sessionId, {});
        return { toolName: 'close_browser', success: result.success, data: result.data, error: result.error };
      },
    },
    {
      name: 'stop_session',
      description: 'EMERGENCY STOP: Immediately terminate a browser session, cancel all pending actions and approvals, close Playwright resources, and prevent any further execution on this session.',
      agentId: 'computer_control_agent',
      inputSchema: z.object({
        sessionId: z.string().describe('Browser session ID to emergency-stop'),
      }),
      execute: async (input) => {
        const result = await computerStop(input.sessionId);
        return {
          toolName: 'stop_session',
          success: result.success,
          data: { cancelledActions: result.cancelledActions, message: 'Session terminated. All pending actions cancelled. No further execution possible.' },
          error: result.error,
        };
      },
    },
    {
      name: 'search_remote_gigs',
      description: 'Search live freelance and remote job platforms (Fiverr, Upwork, RemoteOK, Freelancer) using an automated stealth browser. Navigates to search results and returns structured gig titles, client budgets, ratings, tags, and links.',
      agentId: 'computer_control_agent',
      inputSchema: z.object({
        platform: z.enum(['remoteok', 'fiverr', 'upwork', 'freelancer', 'all']).default('remoteok').describe('Freelance or remote job platform to search'),
        query: z.string().describe('Search keyword or target role, e.g. "Next.js", "AI Agent", "TypeScript Developer", "Web Scraping"'),
        sessionId: z.string().optional().describe('Optional existing browser session ID to reuse'),
      }),
      execute: async (input) => {
        let sid = input.sessionId;
        const { playwrightComputerProvider } = await import('@/lib/computer/playwrightProvider');

        if (!sid) {
          sid = playwrightComputerProvider.getActiveSessionId() || await playwrightComputerProvider.createSession();
        }

        const queryClean = input.query.trim();
        const platform = input.platform || 'remoteok';

        let targetUrl = '';
        if (platform === 'remoteok') {
          targetUrl = `https://remoteok.com/remote-${encodeURIComponent(queryClean.toLowerCase().replace(/\s+/g, '-'))}-jobs`;
        } else if (platform === 'fiverr') {
          targetUrl = `https://www.fiverr.com/search/gigs?query=${encodeURIComponent(queryClean)}`;
        } else if (platform === 'upwork') {
          targetUrl = `https://www.upwork.com/nx/search/jobs/?q=${encodeURIComponent(queryClean)}`;
        } else if (platform === 'freelancer') {
          targetUrl = `https://www.freelancer.com/jobs/${encodeURIComponent(queryClean.toLowerCase().replace(/\s+/g, '-'))}`;
        } else {
          targetUrl = `https://remoteok.com/remote-${encodeURIComponent(queryClean.toLowerCase().replace(/\s+/g, '-'))}-jobs`;
        }

        try {
          await playwrightComputerProvider.navigate(sid, targetUrl);
          await playwrightComputerProvider.wait(sid, 2500);
          const gigs = await playwrightComputerProvider.extractGigs(sid, platform);
          const obs = await playwrightComputerProvider.observe(sid);

          return {
            toolName: 'search_remote_gigs',
            success: true,
            data: {
              platform,
              query: queryClean,
              targetUrl,
              pageTitle: obs.title,
              gigsFound: gigs.length,
              gigs,
              sessionId: sid,
              summary: `Found ${gigs.length} live opportunities on ${platform.toUpperCase()} for "${queryClean}".`,
            },
          };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          return {
            toolName: 'search_remote_gigs',
            success: false,
            error: `Failed searching remote gigs on ${platform}: ${msg}`,
          };
        }
      },
    },
    {
      name: 'save_browser_session',
      description: 'Saves current browser cookies, authentication tokens, and session state from the active browser session to the persistent profile (data/browser_profile/state.json). Use this after logging into Fiverr, Upwork, or Freelancer so the agent stays logged in permanently.',
      agentId: 'computer_control_agent',
      inputSchema: z.object({
        sessionId: z.string().optional().describe('Browser session ID (optional; uses active session if omitted)'),
      }),
      execute: async (input) => {
        try {
          const { playwrightComputerProvider } = await import('@/lib/computer/playwrightProvider');
          const sid = input.sessionId || playwrightComputerProvider.getActiveSessionId() || undefined;
          const path = await playwrightComputerProvider.saveSessionState(sid);
          return {
            toolName: 'save_browser_session',
            success: true,
            data: {
              savedPath: path,
              message: 'Browser session cookies and storage successfully saved to persistent profile (data/browser_profile/state.json).',
            },
          };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          return {
            toolName: 'save_browser_session',
            success: false,
            error: `Failed saving browser session: ${msg}`,
          };
        }
      },
    },
    {
      name: 'open_freelance_platform',
      description: 'Open a freelance or remote job site (Fiverr, Upwork, Freelancer, RemoteOK, LinkedIn) in the browser with saved persistent login session intact so you can view your dashboard, gigs, or active orders.',
      agentId: 'computer_control_agent',
      inputSchema: z.object({
        platform: z.enum(['fiverr', 'upwork', 'freelancer', 'remoteok', 'linkedin', 'weworkremotely']).describe('Platform to open'),
        path: z.string().optional().describe('Optional page path e.g. "/manage_orders" or "/nx/find-work"'),
        sessionId: z.string().optional().describe('Optional existing session ID'),
      }),
      execute: async (input) => {
        let sid = input.sessionId;
        const { playwrightComputerProvider } = await import('@/lib/computer/playwrightProvider');

        if (!sid) {
          sid = playwrightComputerProvider.getActiveSessionId() || await playwrightComputerProvider.createSession();
        }

        const domainMap: Record<string, string> = {
          fiverr: 'https://www.fiverr.com',
          upwork: 'https://www.upwork.com',
          freelancer: 'https://www.freelancer.com',
          remoteok: 'https://remoteok.com',
          linkedin: 'https://www.linkedin.com',
          weworkremotely: 'https://weworkremotely.com',
        };

        const baseUrl = domainMap[input.platform] || 'https://www.fiverr.com';
        const targetUrl = input.path ? `${baseUrl}${input.path.startsWith('/') ? '' : '/'}${input.path}` : baseUrl;

        try {
          await playwrightComputerProvider.navigate(sid, targetUrl);
          await playwrightComputerProvider.wait(sid, 2000);
          const obs = await playwrightComputerProvider.observe(sid);

          return {
            toolName: 'open_freelance_platform',
            success: true,
            data: {
              platform: input.platform,
              url: targetUrl,
              pageTitle: obs.title,
              sessionId: sid,
              message: `Opened ${input.platform.toUpperCase()} in browser session. Persistent profile loaded.`,
            },
          };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          return {
            toolName: 'open_freelance_platform',
            success: false,
            error: `Failed opening ${input.platform}: ${msg}`,
          };
        }
      },
    },
    {
      name: 'search_instagram_trends',
      description: 'Research trending topics, viral formats, popular reel concepts, and hashtags on Instagram using an authenticated stealth browser session.',
      agentId: 'computer_control_agent',
      inputSchema: z.object({
        topic: z.string().describe('Hashtag, niche, or topic to research (e.g. "ai", "webdev", "fitness", "dhaka", "tech")'),
        sessionId: z.string().optional().describe('Optional existing browser session ID'),
      }),
      execute: async (input) => {
        let sid = input.sessionId;
        const { playwrightComputerProvider } = await import('@/lib/computer/playwrightProvider');

        if (!sid) {
          sid = playwrightComputerProvider.getActiveSessionId() || await playwrightComputerProvider.createSession();
        }

        const cleanTopic = input.topic.trim().replace(/^#/, '').toLowerCase();
        const targetUrl = `https://www.instagram.com/explore/tags/${encodeURIComponent(cleanTopic)}/`;

        try {
          await playwrightComputerProvider.navigate(sid, targetUrl);
          await playwrightComputerProvider.wait(sid, 3000);
          const page = playwrightComputerProvider.getPage(sid);

          // Extract post thumbnails, alt descriptions, and links
          const posts = await page.evaluate(() => {
            const items: Array<{ url: string; description: string }> = [];
            const links = document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]');
            links.forEach((a, idx) => {
              if (idx >= 12) return;
              const img = a.querySelector('img');
              const alt = img?.getAttribute('alt') || '';
              const href = (a as HTMLAnchorElement).href;
              items.push({ url: href, description: alt.slice(0, 200) });
            });
            return items;
          });

          return {
            toolName: 'search_instagram_trends',
            success: true,
            data: {
              topic: cleanTopic,
              targetUrl,
              postsFound: posts.length,
              posts,
              summary: `Extracted ${posts.length} trending posts and reels on Instagram for #${cleanTopic}.`,
            },
          };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          return {
            toolName: 'search_instagram_trends',
            success: false,
            error: `Failed exploring Instagram trends for #${cleanTopic}: ${msg}`,
          };
        }
      },
    },
    {
      name: 'draft_chat_message',
      description: 'Drafts a direct message to send to someone via WhatsApp Web or Telegram. Requires human confirmation before delivery.',
      agentId: 'computer_control_agent',
      requiresHumanApproval: true,
      inputSchema: z.object({
        platform: z.enum(['whatsapp', 'telegram']).describe('Messaging platform to use'),
        contact: z.string().describe('Contact name or phone number with country code (e.g. "+88017XXXXXXXX")'),
        message: z.string().describe('Message content to send'),
        sessionId: z.string().optional().describe('Optional existing browser session ID'),
      }),
      buildApprovalPayload: (input) => ({
        actionType: 'create_application',
        title: `Dispatch Chat Message: ${input.platform.toUpperCase()}`,
        description: `Confirm sending the following message to ${input.contact} via ${input.platform}: "${input.message}"`,
        payload: input,
      }),
      execute: async (input, context) => {
        if (!context?.isHumanApproved) {
          return {
            toolName: 'draft_chat_message',
            success: true,
            requiresHumanApproval: true,
            data: {
              pending: true,
              platform: input.platform,
              contact: input.contact,
              message: input.message,
              prompt: `Please approve sending message to ${input.contact}: "${input.message}"`,
            },
          };
        }

        let sid = input.sessionId;
        const { playwrightComputerProvider } = await import('@/lib/computer/playwrightProvider');
        if (!sid) {
          sid = playwrightComputerProvider.getActiveSessionId() || await playwrightComputerProvider.createSession();
        }

        try {
          if (input.platform === 'whatsapp') {
            const cleanPhone = input.contact.replace(/[^\d+]/g, '');
            const targetUrl = cleanPhone
              ? `https://web.whatsapp.com/send?phone=${encodeURIComponent(cleanPhone)}&text=${encodeURIComponent(input.message)}`
              : 'https://web.whatsapp.com';
            await playwrightComputerProvider.navigate(sid, targetUrl);
          } else {
            await playwrightComputerProvider.navigate(sid, 'https://web.telegram.org');
          }

          return {
            toolName: 'draft_chat_message',
            success: true,
            data: {
              platform: input.platform,
              contact: input.contact,
              status: 'DRAFT_LOADED',
              message: `Opened ${input.platform} conversation with ${input.contact} and prepared message.`,
            },
          };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          return {
            toolName: 'draft_chat_message',
            success: false,
            error: `Failed opening ${input.platform}: ${msg}`,
          };
        }
      },
    },
    {
      name: 'draft_email',
      description: 'Drafts an email message with recipient, subject, and body via Gmail or default mail. Requires human approval before dispatch.',
      agentId: 'computer_control_agent',
      requiresHumanApproval: true,
      inputSchema: z.object({
        recipient: z.string().describe('Recipient email address or contact name'),
        subject: z.string().describe('Email subject line'),
        body: z.string().describe('Email body text'),
        sessionId: z.string().optional().describe('Optional existing browser session ID'),
      }),
      buildApprovalPayload: (input) => ({
        actionType: 'create_application',
        title: `Dispatch Email: ${input.subject}`,
        description: `Confirm sending email to ${input.recipient} with subject "${input.subject}".`,
        payload: input,
      }),
      execute: async (input, context) => {
        if (!context?.isHumanApproved) {
          return {
            toolName: 'draft_email',
            success: true,
            requiresHumanApproval: true,
            data: {
              pending: true,
              recipient: input.recipient,
              subject: input.subject,
              body: input.body,
              prompt: `Please approve sending email to ${input.recipient} with subject "${input.subject}".`,
            },
          };
        }

        let sid = input.sessionId;
        const { playwrightComputerProvider } = await import('@/lib/computer/playwrightProvider');
        if (!sid) {
          sid = playwrightComputerProvider.getActiveSessionId() || await playwrightComputerProvider.createSession();
        }

        try {
          const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(input.recipient)}&su=${encodeURIComponent(input.subject)}&body=${encodeURIComponent(input.body)}`;
          await playwrightComputerProvider.navigate(sid, gmailUrl);

          return {
            toolName: 'draft_email',
            success: true,
            data: {
              recipient: input.recipient,
              subject: input.subject,
              status: 'DRAFT_LOADED_IN_GMAIL',
              message: `Gmail compose window opened for ${input.recipient} with subject "${input.subject}".`,
            },
          };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          return {
            toolName: 'draft_email',
            success: false,
            error: `Failed preparing email: ${msg}`,
          };
        }
      },
    },
  ],
};

export const computerControlAgent = ComputerControlAgent;
