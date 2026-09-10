import { NextRequest, NextResponse } from 'next/server';
import { executeToolByName } from '@/lib/tools/registry';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { toolName, args } = body as {
      toolName: string;
      args?: Record<string, unknown>;
    };

    if (!toolName) {
      return NextResponse.json({ error: 'toolName is required' }, { status: 400 });
    }

    const result = await executeToolByName(toolName, args || {});
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to execute tool';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
