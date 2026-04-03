import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { toggleUserActive } from '@/lib/supabase/users';

// PATCH /api/users/[id]/status — admin only
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    getSessionUser(req);
    const user = await toggleUserActive(params.id);
    return NextResponse.json({ success: true, data: user });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
