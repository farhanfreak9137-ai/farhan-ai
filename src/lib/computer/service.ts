// src/lib/computer/service.ts
import { db } from '@/lib/db';
import { computerActions } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import {
  evaluatePolicy,
  ComputerActionRequestSchema,
  PolicyDecision,
  ComputerActionRequest,
} from './policyEngine';
import { playwrightComputerProvider } from './playwrightProvider';

export interface ComputerExecutionResult {
  success: boolean;
  status?: string;
  requestId?: string;
  data?: any;
  result?: any;
  error?: string;
  cancelledActions?: string[];
}

/**
 * Executes an authorized computer control action against the Playwright provider.
 */
export async function executeComputerAction(
  action: string,
  sessionId?: string,
  payload: any = {}
): Promise<{ success: boolean; data?: any }> {
  try {
    switch (action) {
      case 'createSession': {
        const sid = await playwrightComputerProvider.createSession();
        return { success: true, data: { sessionId: sid } };
      }
      case 'navigate': {
        if (!sessionId) throw new Error('sessionId required for navigate');
        await playwrightComputerProvider.navigate(sessionId, payload.url);
        return { success: true, data: { url: payload.url } };
      }
      case 'observe': {
        if (!sessionId) throw new Error('sessionId required for observe');
        const obs = await playwrightComputerProvider.observe(sessionId);
        return { success: true, data: obs };
      }
      case 'click': {
        if (!sessionId) throw new Error('sessionId required for click');
        await playwrightComputerProvider.click(sessionId, payload.elementId);
        return { success: true, data: { elementId: payload.elementId } };
      }
      case 'type': {
        if (!sessionId) throw new Error('sessionId required for type');
        await playwrightComputerProvider.type(sessionId, payload.elementId, payload.text);
        return { success: true, data: { elementId: payload.elementId } };
      }
      case 'fill': {
        if (!sessionId) throw new Error('sessionId required for fill');
        await playwrightComputerProvider.fill(sessionId, payload.data);
        return { success: true, data: { fieldsCount: Object.keys(payload.data || {}).length } };
      }
      case 'scroll': {
        if (!sessionId) throw new Error('sessionId required for scroll');
        await playwrightComputerProvider.scroll(sessionId, payload.deltaY);
        return { success: true, data: { deltaY: payload.deltaY } };
      }
      case 'wait': {
        if (!sessionId) throw new Error('sessionId required for wait');
        await playwrightComputerProvider.wait(sessionId, payload.ms);
        return { success: true, data: { ms: payload.ms } };
      }
      case 'goBack': {
        if (!sessionId) throw new Error('sessionId required for goBack');
        await playwrightComputerProvider.goBack(sessionId);
        return { success: true };
      }
      case 'goForward': {
        if (!sessionId) throw new Error('sessionId required for goForward');
        await playwrightComputerProvider.goForward(sessionId);
        return { success: true };
      }
      case 'screenshot': {
        if (!sessionId) throw new Error('sessionId required for screenshot');
        const path = await playwrightComputerProvider.screenshot(sessionId);
        return { success: true, data: { path } };
      }
      case 'close': {
        if (!sessionId) throw new Error('sessionId required for close');
        await playwrightComputerProvider.close(sessionId);
        return { success: true, data: { closed: true } };
      }
      default:
        return { success: false, data: `Unsupported action '${action}'` };
    }
  } catch (err: unknown) {
    return { success: false, data: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Handles a computer control action request:
 * 1. Validate payload with Zod
 * 2. Policy evaluation (safe vs approval-required vs denied)
 * 3. Audit trail creation in SQLite
 * 4. Execution or 202 Pending Approval response
 */
export async function handleComputerRequest(rawInput: unknown): Promise<{
  statusCode: number;
  body: ComputerExecutionResult;
}> {
  const parseResult = ComputerActionRequestSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      statusCode: 400,
      body: {
        success: false,
        error: 'Invalid request format',
        data: parseResult.error.format(),
      },
    };
  }

  const request: ComputerActionRequest = parseResult.data;
  const decision: PolicyDecision = evaluatePolicy(request);

  if (!decision.allowed) {
    const actionId = uuidv4();
    await db.insert(computerActions).values({
      id: actionId,
      sessionId: request.sessionId ?? '',
      action: request.action,
      payload: request.payload,
      status: 'DENIED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return {
      statusCode: 403,
      body: {
        success: false,
        error: decision.reason ?? 'Action denied by policy',
        status: 'DENIED',
        requestId: actionId,
      },
    };
  }

  const actionId = uuidv4();
  const initialStatus = decision.requiresApproval ? 'PENDING_APPROVAL' : 'EXECUTING';

  await db.insert(computerActions).values({
    id: actionId,
    sessionId: request.sessionId ?? '',
    action: request.action,
    payload: request.payload,
    status: initialStatus,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  if (decision.requiresApproval) {
    return {
      statusCode: 202,
      body: {
        success: true,
        status: 'PENDING_APPROVAL',
        requestId: actionId,
      },
    };
  }

  // Auto-execute safe action
  const exec = await executeComputerAction(request.action, request.sessionId, request.payload);
  await db
    .update(computerActions)
    .set({
      status: exec.success ? 'COMPLETED' : 'FAILED',
      result: exec.data,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(computerActions.id, actionId));

  return {
    statusCode: exec.success ? 200 : 500,
    body: {
      success: exec.success,
      status: exec.success ? 'COMPLETED' : 'FAILED',
      requestId: actionId,
      result: exec.data,
      error: exec.success ? undefined : (typeof exec.data === 'string' ? exec.data : 'Execution failed'),
    },
  };
}

/**
 * Handles human approval or rejection of a pending consequential action:
 * - Immutable execution: uses ONLY the persisted payload and action from the database.
 * - Rejects non-pending, duplicate, or cancelled requests.
 */
export async function handleComputerApprove(
  requestId: string,
  approve: boolean,
  notes?: string
): Promise<{ statusCode: number; body: ComputerExecutionResult }> {
  // Load immutable persisted action
  const actionRow = await db
    .select()
    .from(computerActions)
    .where(eq(computerActions.id, requestId))
    .then((rows) => rows[0]);

  if (!actionRow) {
    return { statusCode: 404, body: { success: false, error: 'Request not found' } };
  }

  if (actionRow.status !== 'PENDING_APPROVAL') {
    return {
      statusCode: 400,
      body: {
        success: false,
        error: `Cannot approve action in status ${actionRow.status}`,
      },
    };
  }

  if (!approve) {
    await db
      .update(computerActions)
      .set({ status: 'DENIED', updatedAt: new Date().toISOString() })
      .where(eq(computerActions.id, requestId));

    return {
      statusCode: 200,
      body: { success: true, status: 'DENIED', requestId },
    };
  }

  // Approve -> update status to APPROVED then execute
  await db
    .update(computerActions)
    .set({ status: 'APPROVED', updatedAt: new Date().toISOString() })
    .where(eq(computerActions.id, requestId));

  // Policy check against immutable persisted data
  const decision: PolicyDecision = evaluatePolicy({
    action: actionRow.action as any,
    sessionId: actionRow.sessionId,
    payload: actionRow.payload as any,
  });

  if (!decision.allowed) {
    await db
      .update(computerActions)
      .set({ status: 'DENIED', updatedAt: new Date().toISOString() })
      .where(eq(computerActions.id, requestId));

    return {
      statusCode: 403,
      body: { success: false, error: 'Policy denies execution after approval' },
    };
  }

  await db
    .update(computerActions)
    .set({ status: 'EXECUTING', updatedAt: new Date().toISOString() })
    .where(eq(computerActions.id, requestId));

  const exec = await executeComputerAction(
    actionRow.action,
    actionRow.sessionId,
    actionRow.payload
  );

  await db
    .update(computerActions)
    .set({
      status: exec.success ? 'COMPLETED' : 'FAILED',
      result: exec.data,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(computerActions.id, requestId));

  return {
    statusCode: exec.success ? 200 : 500,
    body: {
      success: exec.success,
      status: exec.success ? 'COMPLETED' : 'FAILED',
      requestId,
      result: exec.data,
      error: exec.success ? undefined : (typeof exec.data === 'string' ? exec.data : 'Execution failed'),
    },
  };
}

/**
 * Handles Emergency STOP:
 * - Closes isolated browser context immediately
 * - Cancels all pending/executing actions in the database
 * - Guarantees no further execution can happen on this session
 */
export async function handleComputerStop(sessionId: string): Promise<{
  statusCode: number;
  body: ComputerExecutionResult;
}> {
  if (!sessionId) {
    return { statusCode: 400, body: { success: false, error: 'sessionId is required' } };
  }

  try {
    await playwrightComputerProvider.close(sessionId);
  } catch (_) {}

  // Transition all non-final actions to CANCELLED
  const pending = await db
    .select()
    .from(computerActions)
    .where(eq(computerActions.sessionId, sessionId))
    .then((rows) =>
      rows.filter((r) => !['COMPLETED', 'FAILED', 'CANCELLED', 'DENIED'].includes(r.status))
    );

  for (const act of pending) {
    await db
      .update(computerActions)
      .set({ status: 'CANCELLED', updatedAt: new Date().toISOString() })
      .where(eq(computerActions.id, act.id));
  }

  return {
    statusCode: 200,
    body: {
      success: true,
      cancelledActions: pending.map((a) => a.id),
      data: { message: `Session ${sessionId} terminated. ${pending.length} action(s) cancelled.` },
    },
  };
}
