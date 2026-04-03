// =============================================================
// Crystal Ball — Supabase Client
//
// Two clients:
//   supabase      — anon key, subject to RLS. Use for client-side
//                   queries after setting session vars via setAppSession().
//   supabaseAdmin — service role key, bypasses RLS. Use ONLY in
//                   server-side code (API routes / Server Components).
//
// Install: npm install @supabase/supabase-js
// =============================================================
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY env vars.'
  );
}

/** Anon client — respects RLS. Requires session vars to be set first. */
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

/** Service-role client — bypasses RLS. Server-side only. */
export const supabaseAdmin: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

/**
 * Sets the PostgreSQL session variables used by all RLS policies.
 * Must be called at the start of every server-side request that
 * uses the anon client with RLS active.
 *
 * Under the hood this calls the `set_app_session` Postgres function
 * which executes:
 *   set_config('app.current_user_id',  p_user_id, true)
 *   set_config('app.current_user_role', p_role,   true)
 */
export async function setAppSession(
  client: SupabaseClient,
  userId: string,
  role: string
): Promise<void> {
  const { error } = await client.rpc('set_app_session', {
    p_user_id: userId,
    p_role: role,
  });
  if (error) throw new Error(`setAppSession failed: ${error.message}`);
}

/**
 * Returns a supabase client with the app session already set.
 * Convenience wrapper for server-side handler code.
 */
export async function getAuthedClient(
  userId: string,
  role: string
): Promise<SupabaseClient> {
  await setAppSession(supabase, userId, role);
  return supabase;
}
