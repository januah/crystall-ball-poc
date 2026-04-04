// =============================================================
// Crystal Ball — User Management Helpers (Admin only)
// All write operations go through supabaseAdmin (bypasses RLS).
// Password hashing: bcryptjs (npm install bcryptjs @types/bcryptjs)
// =============================================================
import bcrypt from 'bcryptjs';
import { supabaseAdmin, getAuthedClient } from './client';
import type { UserRow, UserInsert, UserSafe } from './types';

const BCRYPT_ROUNDS = 12;

function toSafeUser(row: UserRow): UserSafe {
  const { password_hash: _, ...safe } = row;
  return safe;
}

// ------------------------------------------------------------------
// createUser  — admin only
// ------------------------------------------------------------------
export type CreateUserInput = {
  email: string;
  password: string;
  role_id: string;
  full_name?: string;
  department?: string;
  avatar_url?: string;
  created_by: string;   // admin's user id
};

export async function createUser(input: CreateUserInput): Promise<UserSafe> {
  const password_hash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  // Get the actual role ID from the role name
  let actualRoleId = input.role_id;
  if (input.role_id === 'admin' || input.role_id === 'analyst' || input.role_id === 'viewer') {
    // Look up the role ID from the roles table
    const { data: role, error: roleError } = await supabaseAdmin
      .from('roles')
      .select('id')
      .eq('name', input.role_id)
      .single();

    if (roleError) throw new Error(`createUser: role lookup failed - ${roleError.message}`);
    if (!role) throw new Error(`createUser: role not found - ${input.role_id}`);

    actualRoleId = role.id;
  }

  const payload: UserInsert = {
    email:         input.email,
    password_hash,
    role_id:       actualRoleId,
    full_name:     input.full_name ?? null,
    department:    input.department ?? null,
    avatar_url:    input.avatar_url ?? null,
    is_active:     true,
    created_by:    input.created_by,
    last_login_at: null,
  };

  const { data, error } = await supabaseAdmin
    .from('users')
    .insert(payload)
    .select('*, role:role_id (*)')
    .single();

  if (error) throw new Error(`createUser: ${error.message}`);
  return toSafeUser(data as UserRow);
}

// ------------------------------------------------------------------
// getUserByEmail
// Returns the full row including password_hash (needed for login).
// Never expose this to the client — use in server-side auth only.
// ------------------------------------------------------------------
export async function getUserByEmail(email: string): Promise<UserRow | null> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*, role:role_id (*)')
    .eq('email', email)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw new Error(`getUserByEmail: ${error.message}`);
  return (data as UserRow) ?? null;
}

// ------------------------------------------------------------------
// getUserById  — returns safe user (no password_hash)
// ------------------------------------------------------------------
export async function getUserById(userId: string): Promise<UserSafe | null> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*, role:role_id (*)')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw new Error(`getUserById: ${error.message}`);
  if (!data) return null;
  return toSafeUser(data as UserRow);
}

// ------------------------------------------------------------------
// updateUserRole  — admin only
// ------------------------------------------------------------------
export async function updateUserRole(
  userId: string,
  roleId: string
): Promise<UserSafe> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .update({ role_id: roleId })
    .eq('id', userId)
    .select('*, role:role_id (*)')
    .single();

  if (error) throw new Error(`updateUserRole: ${error.message}`);
  return toSafeUser(data as UserRow);
}

// ------------------------------------------------------------------
// toggleUserActive  — admin only (soft-delete / re-activate)
// ------------------------------------------------------------------
export async function toggleUserActive(userId: string): Promise<UserSafe> {
  // Fetch current state first
  const { data: current, error: fetchErr } = await supabaseAdmin
    .from('users')
    .select('is_active')
    .eq('id', userId)
    .single();

  if (fetchErr) throw new Error(`toggleUserActive (fetch): ${fetchErr.message}`);

  const { data, error } = await supabaseAdmin
    .from('users')
    .update({ is_active: !current.is_active })
    .eq('id', userId)
    .select('*, role:role_id (*)')
    .single();

  if (error) throw new Error(`toggleUserActive: ${error.message}`);
  return toSafeUser(data as UserRow);
}

// ------------------------------------------------------------------
// listAllUsers  — admin only
// ------------------------------------------------------------------
export async function listAllUsers(): Promise<UserSafe[]> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*, role:role_id (*)')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`listAllUsers: ${error.message}`);
  return (data ?? []).map((row: UserRow) => toSafeUser(row));
}

// ------------------------------------------------------------------
// updateLastLogin  — called internally by auth.login()
// ------------------------------------------------------------------
export async function updateLastLogin(userId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) throw new Error(`updateLastLogin: ${error.message}`);
}
