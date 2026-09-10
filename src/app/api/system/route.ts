import { NextRequest, NextResponse } from 'next/server';
import { defaultRegistry } from '@/lib/agents/registry';
import { verifyRequestAuth } from '@/lib/security/auth';
import { z } from 'zod';

const SystemActionRequestSchema = z.object({
  action: z.enum(['execute_command', 'file_operations', 'launch_application', 'system_diagnostics']),
  payload: z.record(z.string(), z.any()).default({}),
  isHumanApproved: z.boolean().default(false),
});

/**
 * GET /api/system: Retrieves real-time OS diagnostics.
 */
export async function GET(request: NextRequest) {
  const authResult = await verifyRequestAuth(request);
  if (!authResult.authorized) {
    return NextResponse.json({ error: authResult.reason }, { status: 401 });
  }

  const result = await defaultRegistry.executeTool('system_diagnostics', {});
  return NextResponse.json(result);
}

/**
 * POST /api/system: Executes an OS / computer control tool.
 */
export async function POST(request: NextRequest) {
  const authResult = await verifyRequestAuth(request);
  if (!authResult.authorized) {
    return NextResponse.json({ error: authResult.reason }, { status: 401 });
  }

  try {
    const rawBody = await request.json();
    const parseResult = SystemActionRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request payload',
          issues: parseResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { action, payload, isHumanApproved } = parseResult.data;

    const result = await defaultRegistry.executeTool(
      action,
      payload,
      {
        isHumanApproved,
        userId: 'operator',
      }
    );

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'System operation failed' },
      { status: 500 }
    );
  }
}
