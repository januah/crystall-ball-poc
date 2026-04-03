import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { listAllUsers, createUser } from '@/lib/supabase/users';
import { supabaseAdmin } from '@/lib/supabase/client';

// GET /api/users — admin only (enforced by middleware)
export async function GET(req: NextRequest) {
  try {
    getSessionUser(req);
    const users = await listAllUsers();
    return NextResponse.json({ success: true, data: users });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST /api/users — admin only
export async function POST(req: NextRequest) {
  try {
    const admin = getSessionUser(req);
    const { email, password, fullName, department, roleId } = await req.json();

    if (!email || !password || !roleId) {
      return NextResponse.json(
        { success: false, error: 'email, password, and roleId are required.' },
        { status: 400 }
      );
    }

    const user = await createUser({
      email,
      password,
      full_name: fullName ?? null,
      department: department ?? null,
      role_id: roleId,
      created_by: admin.id,
    });

    return NextResponse.json({ success: true, data: user }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
