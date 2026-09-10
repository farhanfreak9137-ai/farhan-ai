import { NextRequest, NextResponse } from 'next/server';
import { getProfile, updateProfile, addDocument } from '@/lib/profile/store';

export async function GET() {
  try {
    const profile = await getProfile();
    return NextResponse.json(profile);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch profile';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.action === 'addDocument') {
      const { title, type, content } = body.document || {};
      if (!title || !content) {
        return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
      }
      const updated = await addDocument({ title, type: type || 'cv', content });
      return NextResponse.json({ success: true, profile: updated });
    }

    if (body.action === 'updateProfile') {
      const updated = await updateProfile(body.profile);
      return NextResponse.json({ success: true, profile: updated });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update profile';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
