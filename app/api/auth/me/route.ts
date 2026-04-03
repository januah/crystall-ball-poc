import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, CRYSTAL_BALL_COOKIE_NAME } from '@/lib/supabase/auth';
import { getUserById } from '@/lib/supabase/users';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(CRYSTAL_BALL_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  const session = await getCurrentUser(token);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Invalid or expired session' }, { status: 401 });
  }

  // Fetch fresh profile (full_name, avatar_url not in JWT)
  const user = await getUserById(session.id);
  if (!user) {
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      avatar_url: user.avatar_url,
      role: session.role,
      role_id: session.role_id,
    },
  });
}
