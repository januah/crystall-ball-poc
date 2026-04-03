import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { createUser } from '@/lib/supabase/users';

// POST /api/auth/bootstrap
// Creates the first admin user. Permanently disabled once any admin exists.
// Only available when NODE_ENV !== 'production' OR no admin users exist.
export async function POST(req: NextRequest) {
  try {
    // Check if any admin already exists
    const { count, error: countErr } = await supabaseAdmin
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);

    if (countErr) throw new Error(countErr.message);

    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { success: false, error: 'Bootstrap disabled — users already exist. Use /admin/users to add more.' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { email, password, fullName } = body as {
      email?: string;
      password?: string;
      fullName?: string;
    };

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'email and password are required.' },
        { status: 400 }
      );
    }

    // Validate password complexity (min 8 chars, uppercase, lowercase, digit, special)
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
    if (!passwordRegex.test(password)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Password must be at least 8 characters with uppercase, lowercase, digit, and special character.',
        },
        { status: 400 }
      );
    }

    // Fetch the admin role id
    const { data: adminRole, error: roleErr } = await supabaseAdmin
      .from('roles')
      .select('id')
      .eq('name', 'admin')
      .single();

    if (roleErr || !adminRole) {
      return NextResponse.json(
        { success: false, error: 'Admin role not found. Run setup.sql first.' },
        { status: 500 }
      );
    }

    const user = await createUser({
      email,
      password,
      role_id:    adminRole.id,
      full_name:  fullName ?? 'Admin',
      created_by: '00000000-0000-0000-0000-000000000000', // bootstrap — no parent user
    });

    return NextResponse.json({
      success: true,
      message: 'First admin user created. Log in at /.',
      data: { id: user.id, email: user.email },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
