import { NextRequest, NextResponse } from 'next/server';
import { defaultWorkflowEngine } from '@/lib/workflows/engine';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const params = await context.params;
    const { id } = params;

    const workflow = await defaultWorkflowEngine.getWorkflow(id);
    if (!workflow) {
      return NextResponse.json(
        { success: false, error: `Workflow '${id}' not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      workflow,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve workflow';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
