// Extracts the session user from request headers set by middleware.
// Use in API route handlers only — never in Client Components.
import { NextRequest } from 'next/server';
import type { SessionUser } from '@/lib/supabase/types';

export function getSessionUser(req: NextRequest): SessionUser {
  const id = req.headers.get('x-user-id');
  const email = req.headers.get('x-user-email');
  const role = req.headers.get('x-user-role') as SessionUser['role'] | null;
  const full_name = req.headers.get('x-user-full-name');

  if (!id || !email || !role) {
    throw new Error('Unauthenticated');
  }

  return { id, email, role, full_name, role_id: '', is_active: true };
}

export function tryGetSessionUser(req: NextRequest): SessionUser | null {
  try {
    return getSessionUser(req);
  } catch {
    return null;
  }
}
