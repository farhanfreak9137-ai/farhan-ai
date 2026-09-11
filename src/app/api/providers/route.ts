import { NextResponse } from 'next/server';
import { getAvailableProvidersAsync } from '@/lib/ai/factory';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const providers = await getAvailableProvidersAsync();
    return NextResponse.json({ providers });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to list providers';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
