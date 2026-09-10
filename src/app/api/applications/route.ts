import { NextRequest, NextResponse } from 'next/server';
import { getApplications, addApplication, updateApplicationStatus, deleteApplication } from '@/lib/tracker/store';

export async function GET() {
  try {
    const apps = await getApplications();
    return NextResponse.json({ applications: apps });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch applications';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.action === 'add') {
      const created = await addApplication(body.application);
      return NextResponse.json({ success: true, application: created });
    }

    if (body.action === 'updateStatus') {
      const updated = await updateApplicationStatus(body.id, body.status);
      if (!updated) {
        return NextResponse.json({ error: 'Application not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, application: updated });
    }

    if (body.action === 'delete') {
      const ok = await deleteApplication(body.id);
      return NextResponse.json({ success: ok });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Application update error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
