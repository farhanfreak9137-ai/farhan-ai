// src/app/api/automation/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { automationEngine } from '@/lib/automation/engine';

export const runtime = 'nodejs';

const CreateJobSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  type: z.enum(['interval', 'cron', 'once']),
  schedule: z.string().min(1, 'Schedule is required'),
  taskType: z.enum([
    'opportunity_monitor',
    'research_monitor',
    'workflow_monitor',
    'personal_summary',
    'custom',
  ]),
  taskPayload: z.record(z.string(), z.unknown()).default({}),
  enabled: z.boolean().optional().default(true),
});

/**
 * GET /api/automation
 * Lists all configured background automation jobs.
 */
export async function GET() {
  try {
    const jobs = await automationEngine.listJobs();
    return NextResponse.json({ jobs }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to list automation jobs' }, { status: 500 });
  }
}

/**
 * POST /api/automation
 * Creates a new scheduled or interval automation job.
 */
export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const parse = CreateJobSchema.safeParse(raw);
    if (!parse.success) {
      return NextResponse.json(
        { error: 'Invalid automation job payload', details: parse.error.format() },
        { status: 400 }
      );
    }

    const job = await automationEngine.createJob(parse.data);
    return NextResponse.json({ job }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create automation job' }, { status: 500 });
  }
}
