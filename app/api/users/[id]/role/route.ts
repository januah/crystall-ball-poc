import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { updateUserRole } from '@/lib/supabase/users';

// PATCH /api/users/[id]/role — admin only
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    getSessionUser(req);
    const { roleId } = await req.json();

    if (!roleId) {
      return NextResponse.json(
        { success: false, error: 'roleId is required.' },
        { status: 400 }
      );
    }

    const user = await updateUserRole(params.id, roleId);
    return NextResponse.json({ success: true, data: user });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
