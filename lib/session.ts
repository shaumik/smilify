// Edge-safe session utilities: imported by middleware, route handlers,
// and server components. Must not import node-only modules.
import { SignJWT, jwtVerify } from 'jose';
import type { Role } from './config';

export const SESSION_COOKIE = 'smilify_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export interface SessionUser {
  email: string;
  name: string;
  role: Role;
}

export function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET ?? 'smilify-dev-secret-change-me-in-production';
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ email: user.email, name: user.name, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.email !== 'string' || typeof payload.role !== 'string') return null;
    return {
      email: payload.email,
      name: typeof payload.name === 'string' ? payload.name : payload.email,
      role: payload.role === 'admin' ? 'admin' : 'member',
    };
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: SESSION_TTL_SECONDS,
};
