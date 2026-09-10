// src/app/api/automation/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { automationEngine } from '@/lib/automation/engine';

export const runtime = 'nodejs';

const UpdateJobSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  schedule: z.string().optional(),
  type: z.enum(['interval', 'cron', 'once']).optional(),
  taskType: z.enum([
    'opportunity_monitor',
    'research_monitor',
    'workflow_monitor',
    'personal_summary',
    'custom',
  ]).optional(),
  taskPayload: z.record(z.string(), z.unknown()).optional(),
  enabled: z.boolean().optional(),
});

/**
 * GET /api/automation/[id]
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const job = await automationEngine.getJob(id);
    if (!job) {
      return NextResponse.json({ error: `Automation job ${id} not found` }, { status: 404 });
    }
    return NextResponse.json({ job }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to retrieve automation job' }, { status: 500 });
  }
}

/**
 * PATCH /api/automation/[id]
 */
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const raw = await req.json();
    const parse = UpdateJobSchema.safeParse(raw);
    if (!parse.success) {
      return NextResponse.json(
        { error: 'Invalid update payload', details: parse.error.format() },
        { status: 400 }
      );
    }

    const job = await automationEngine.updateJob(id, parse.data);
    return NextResponse.json({ job }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update automation job' }, { status: 500 });
  }
}

/**
 * DELETE /api/automation/[id]
 */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    await automationEngine.deleteJob(id);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to delete automation job' }, { status: 500 });
  }
}
