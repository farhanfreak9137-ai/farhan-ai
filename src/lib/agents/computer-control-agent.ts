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
  ],
};

export const computerControlAgent = ComputerControlAgent;
