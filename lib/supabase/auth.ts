// =============================================================
// Crystal Ball — Auth Helpers
//
// Custom auth against the users table (no Supabase Auth).
// JWTs are signed with jose and stored in HTTP-only cookies.
//
// Dependencies:
//   npm install bcryptjs jose
//   npm install --save-dev @types/bcryptjs
//
// Required env vars:
//   JWT_SECRET — at least 32 characters
//   JWT_EXPIRES_IN — e.g. '8h' (optional, defaults below)
// =============================================================
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { getUserByEmail, updateLastLogin } from './users';
import type { AuthResult, SessionUser, LoginCredentials } from './types';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '8h';
const COOKIE_NAME = 'cb_session';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET env var must be at least 32 characters.');
}

// ------------------------------------------------------------------
// Internal JWT helpers
// ------------------------------------------------------------------
type JwtClaims = JWTPayload & {
  sub: string;         // user id
  email: string;
  role: string;
  role_id: string;
};

async function signToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    sub:     user.id,
    email:   user.email,
    role:    user.role,
    role_id: user.role_id,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRES_IN)
    .sign(JWT_SECRET);
}

async function verifyToken(token: string): Promise<JwtClaims | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as JwtClaims;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------
// login
// Validates credentials against the custom users table.
// Returns a signed JWT on success.
// ------------------------------------------------------------------
export async function login(credentials: LoginCredentials): Promise<AuthResult> {
  const { email, password } = credentials;

  const user = await getUserByEmail(email);
  if (!user) {
    return { success: false, error: 'Invalid email or password.' };
  }

  if (!user.is_active) {
    return { success: false, error: 'Account is inactive. Contact your administrator.' };
  }

  const passwordValid = await bcrypt.compare(password, user.password_hash);
  if (!passwordValid) {
    return { success: false, error: 'Invalid email or password.' };
  }

  // Fetch role name from joined data (getUserByEmail selects role:role_id (*))
  const roleRow = (user as any).role as { name: string; id: string } | null;
  if (!roleRow) {
    return { success: false, error: 'User has no assigned role. Contact your administrator.' };
  }

  const sessionUser: SessionUser = {
    id:        user.id,
    email:     user.email,
    full_name: user.full_name,
    role:      roleRow.name as SessionUser['role'],
    role_id:   user.role_id!,
    is_active: user.is_active,
  };

  const token = await signToken(sessionUser);

  // Update last_login_at (fire-and-forget — don't block the response)
  updateLastLogin(user.id).catch(console.error);

  return { success: true, user: sessionUser, token };
}

// ------------------------------------------------------------------
// getCurrentUser
// Verifies a JWT and returns the embedded session user.
// Pass the token extracted from the HTTP-only cookie.
// ------------------------------------------------------------------
export async function getCurrentUser(token: string): Promise<SessionUser | null> {
  const claims = await verifyToken(token);
  if (!claims || !claims.sub) return null;

  return {
    id:        claims.sub,
    email:     claims.email,
    full_name: null,      // not embedded in token to keep it small
    role:      claims.role as SessionUser['role'],
    role_id:   claims.role_id,
    is_active: true,      // token only issued to active users
  };
}

// ------------------------------------------------------------------
// logout
// Returns the Set-Cookie header string that clears the session cookie.
// Apply this in your Next.js API route / middleware response.
//
// Usage (Next.js App Router):
//   import { cookies } from 'next/headers';
//   cookies().delete(CRYSTAL_BALL_COOKIE_NAME);
// ------------------------------------------------------------------
export const CRYSTAL_BALL_COOKIE_NAME = COOKIE_NAME;

export function buildSessionCookie(token: string): string {
  return [
    `${COOKIE_NAME}=${token}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Strict',
    process.env.NODE_ENV === 'production' ? 'Secure' : '',
    `Max-Age=${8 * 60 * 60}`,  // 8 hours in seconds
  ]
    .filter(Boolean)
    .join('; ');
}

export function buildClearCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0`;
}

export function logout(): string {
  return buildClearCookie();
}
