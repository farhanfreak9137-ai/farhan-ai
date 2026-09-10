import { NextResponse } from 'next/server';
import { getAvailableProviders } from '@/lib/ai/factory';

export async function GET() {
  try {
    const providers = getAvailableProviders();
    return NextResponse.json({ providers });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to list providers';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
