import { NextResponse } from 'next/server';
import { buildClearCookie } from '@/lib/supabase/auth';

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.headers.set('Set-Cookie', buildClearCookie());
  return res;
}
