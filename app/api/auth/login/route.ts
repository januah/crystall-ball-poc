import { NextRequest, NextResponse } from 'next/server';
import { login, buildSessionCookie } from '@/lib/supabase/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    const result = await login({ email, password });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 401 }
      );
    }

    const res = NextResponse.json({ success: true, user: result.user });
    res.headers.set('Set-Cookie', buildSessionCookie(result.token));
    return res;
  } catch (err) {
    console.error('[POST /api/auth/login]', err);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
