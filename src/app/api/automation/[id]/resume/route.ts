// src/app/api/automation/[id]/resume/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { automationEngine } from '@/lib/automation/engine';

export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const job = await automationEngine.resumeJob(id);
    return NextResponse.json({ success: true, job }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to resume job' }, { status: 500 });
  }
}
