import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { getNoteHistory } from '@/lib/supabase/notes';

// GET /api/notes/[opportunityId] — full note history for current user
export async function GET(
  req: NextRequest,
  { params }: { params: { opportunityId: string } }
) {
  try {
    const user = getSessionUser(req);
    const notes = await getNoteHistory(params.opportunityId, user.id, user.role);
    return NextResponse.json({ success: true, data: notes });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthenticated') {
      return NextResponse.json({ success: false, error: message }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
