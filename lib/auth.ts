// Server-component session helper. Identity is Descope-only — see
// lib/descope.ts for the SSO flow that mints the session cookie.
import { cookies } from 'next/headers';
import { SESSION_COOKIE, SessionUser, verifySessionToken } from './session';

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
