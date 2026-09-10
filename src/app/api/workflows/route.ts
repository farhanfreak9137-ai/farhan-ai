import { NextRequest, NextResponse } from 'next/server';
import { defaultWorkflowEngine } from '@/lib/workflows/engine';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50;
    const status = searchParams.get('status') || undefined;

    const workflows = await defaultWorkflowEngine.listWorkflows({ limit, status });
    return NextResponse.json({
      success: true,
      workflows,
      total: workflows.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to list workflows';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const type = body.workflowType || body.type;
    const input = body.input || {};
    const isHumanApproved = Boolean(body.isHumanApproved);

    if (!type) {
      return NextResponse.json(
        {
          success: false,
          error: 'workflowType is required (career_discovery, opportunity_analysis, application_preparation)',
        },
        { status: 400 }
      );
    }

    const workflow = await defaultWorkflowEngine.startWorkflow(type, input, { isHumanApproved });
    return NextResponse.json({
      success: true,
      workflow,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to start workflow';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
