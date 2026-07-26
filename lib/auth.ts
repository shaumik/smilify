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

// Demo user directory. In production, swap for your identity provider
// (SSO / OIDC) — see docs page platform/access-control.
export const USERS: UserRecord[] = [
  {
    email: 'admin@smilify.dev',
    name: 'Ada Admin',
    role: 'admin',
    salt: 'cc3f3e12de222ae3823e8cadb578b866',
    hash: '1c79831883a7e5833731e3d5f2e3382865ab782155f7dd25afaea33c7becd396b1d8a039adc9c7aa2d553ed8eeeba4813f25d64ac14d06d907d21eec6be50cbe',
  },
  {
    email: 'docs@smilify.dev',
    name: 'Devon Docs',
    role: 'member',
    salt: 'db2d772bfc7ca4c0a27849e4b94a2229',
    hash: '866d4197dcaae379c99ad1cbda8e37f70472a417ba4191f14f0b6007feee1d72c18466384c6c09c59f38031c2be461492988dd94dbc560dd650949645d7755a6',
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
