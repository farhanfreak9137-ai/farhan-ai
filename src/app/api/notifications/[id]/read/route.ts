// src/app/api/notifications/[id]/read/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { notificationService } from '@/lib/notifications/service';

export const runtime = 'nodejs';

/**
 * POST /api/notifications/[id]/read
 * Marks a notification as read.
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (id === 'all') {
      await notificationService.markAllRead();
      return NextResponse.json({ success: true }, { status: 200 });
    }

    const success = await notificationService.markRead(id);
    return NextResponse.json({ success }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to mark notification read' }, { status: 500 });
  }
}
