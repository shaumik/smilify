// Node-only auth: user directory, credential verification, and the
// server-component session helper. Not imported by middleware.
import { timingSafeEqual, scryptSync } from 'crypto';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, SessionUser, verifySessionToken } from './session';
import type { Role } from './config';

export interface UserRecord {
  email: string;
  name: string;
  role: Role;
  salt: string;
  hash: string;
}

// User directory. Passwords are scrypt-hashed with per-user salts.
// Swappable for the company IdP (SSO / OIDC) — see platform/access-control.
export const USERS: UserRecord[] = [
  {
    email: 'shaumik@echelonai.com',
    name: 'Shaumik',
    role: 'admin',
    salt: '192525d1be557764faf1292eb911bc6c',
    hash: '375906c04d3e71e262cf63b7b693587ae9f21b7c73eeb1184c99689e098d75ecd3c120e591f51c20eb1bf4773dd4edaf18ba66927bb4e7975e9e21a991dd052d',
  },
  {
    email: 'guest@echelonai.com',
    name: 'Guest',
    role: 'member',
    salt: '6a60301b67cfa78308786ce337fef7dd',
    hash: '24d4ee4453c22eab20fa4200db6ed7e65ef2ccf8b84c4dec664ae5467c418ce8e7d98be732190bd7fd33cb4479edc27d2fdec1503fbfb82fa635f9cc5ddb4854',
  },
];

export function verifyCredentials(email: string, password: string): SessionUser | null {
  const user = USERS.find((u) => u.email.toLowerCase() === email.toLowerCase().trim());
  if (!user) return null;
  const attempt = scryptSync(password, user.salt, 64);
  const expected = Buffer.from(user.hash, 'hex');
  if (attempt.length !== expected.length || !timingSafeEqual(attempt, expected)) return null;
  return { email: user.email, name: user.name, role: user.role };
}

/** Server-component helper: current user from the session cookie. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
