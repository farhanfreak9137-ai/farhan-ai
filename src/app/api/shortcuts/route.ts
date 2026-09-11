import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getCustomShortcuts,
  saveCustomShortcut,
  deleteCustomShortcut,
} from '@/lib/shortcuts';

export const runtime = 'nodejs';

const ShortcutSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  triggers: z.array(z.string()).min(1, 'At least one trigger phrase is required'),
  action: z.enum(['open_url', 'launch_app', 'command']).default('open_url'),
  target: z.string().min(1, 'Target URL or path is required'),
  browser: z.enum(['edge', 'chrome', 'default']).default('edge'),
  response: z.string().optional(),
  enabled: z.boolean().default(true),
});

/**
 * GET /api/shortcuts
 * Lists all configured custom shortcuts.
 */
export async function GET() {
  try {
    const shortcuts = getCustomShortcuts();
    return NextResponse.json({ success: true, shortcuts }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/shortcuts
 * Creates or updates a custom shortcut.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parse = ShortcutSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parse.error.format() },
        { status: 400 }
      );
    }

    const saved = saveCustomShortcut(parse.data);
    return NextResponse.json({ success: true, shortcut: saved }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/shortcuts
 * Removes a shortcut by ID.
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing shortcut ID' }, { status: 400 });
    }

    const removed = deleteCustomShortcut(id);
    return NextResponse.json({ success: removed }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
