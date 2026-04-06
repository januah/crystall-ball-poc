import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { refreshFreeModels } from '@/lib/analyst/ai';

// POST /api/analyst/models — bust cache and re-fetch free model list from OpenRouter
export async function POST(req: NextRequest) {
  try {
    const user = getSessionUser(req);
    if (user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    const models = await refreshFreeModels();
    return NextResponse.json({ success: true, data: models, count: models.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthenticated') {
      return NextResponse.json({ success: false, error: message }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
