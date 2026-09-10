import { NextRequest, NextResponse } from 'next/server';
import { defaultWorkflowEngine } from '@/lib/workflows/engine';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const params = await context.params;
    const { id } = params;

    const workflow = await defaultWorkflowEngine.cancelWorkflow(id);

    return NextResponse.json({
      success: true,
      workflow,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to cancel workflow';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
