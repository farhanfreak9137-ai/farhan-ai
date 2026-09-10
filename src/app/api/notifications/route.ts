// src/app/api/notifications/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { notificationService } from '@/lib/notifications/service';

export const runtime = 'nodejs';

/**
 * GET /api/notifications
 * Returns recent notifications.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get('unread') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const items = await notificationService.listNotifications({ unreadOnly, limit });
    return NextResponse.json({ notifications: items }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to list notifications' }, { status: 500 });
  }
}
