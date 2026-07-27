// Descope SSO.
//
// The login page embeds Descope's Flow component (official @descope/react-sdk),
// so the entire sign-in UX — MFA, passkeys, magic links, social login — is
// configured in the Descope console with no code changes here.
//
// On successful sign-in the browser posts Descope's session JWT to
// /api/auth/descope/token. This module validates it (signature via Descope's
// JWKS, expiry, issuer) and maps it to a docs user; the route then mints the
// same first-party session cookie the local password flow uses, so
// middleware, role gating, and search filtering are identical for both.
//
// Enabled by setting DESCOPE_PROJECT_ID. See .env.example for all options.
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { SessionUser } from './session';

export interface DescopeConfig {
  projectId: string;
  baseUrl: string;
  /** Descope Flow to embed on the login page. */
  flowId: string;
  /** Claim holding the user's roles in the session JWT. */
  rolesClaim: string;
  /** Any of these role names grants the docs `admin` role. */
  adminRoles: string[];
  /** Emails always treated as admin, regardless of roles. */
  adminEmails: string[];
}

export function getDescopeConfig(): DescopeConfig | null {
  const projectId = process.env.DESCOPE_PROJECT_ID;
  if (!projectId) return null;
  const csv = (v: string | undefined, fallback: string[]) =>
    v ? v.split(',').map((s) => s.trim()).filter(Boolean) : fallback;
  return {
    projectId,
    baseUrl: (process.env.DESCOPE_BASE_URL ?? 'https://api.descope.com').replace(/\/$/, ''),
    flowId: process.env.DESCOPE_FLOW_ID ?? 'sign-up-or-in',
    rolesClaim: process.env.DESCOPE_ROLES_CLAIM ?? 'roles',
    adminRoles: csv(process.env.DESCOPE_ADMIN_ROLES, ['admin', 'docs-admin']),
    adminEmails: csv(process.env.DESCOPE_ADMIN_EMAILS, []).map((e) => e.toLowerCase()),
  };
}

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(cfg: DescopeConfig) {
  const url = `${cfg.baseUrl}/${cfg.projectId}/.well-known/jwks.json`;
  let jwks = jwksCache.get(url);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(url));
    jwksCache.set(url, jwks);
  }
  return jwks;
}

/**
 * Validate a Descope session JWT and map it to a docs session user.
 * Profile fields missing from the JWT are fetched from Descope's /v1/auth/me
 * using the (already validated) session token.
 */
export async function verifyDescopeSession(
  cfg: DescopeConfig,
  sessionJwt: string
): Promise<SessionUser> {
  const { payload } = await jwtVerify(sessionJwt, getJwks(cfg));
  const iss = typeof payload.iss === 'string' ? payload.iss : '';
  if (!iss.includes(cfg.projectId)) throw new Error('unexpected issuer');

  let email = typeof payload.email === 'string' ? payload.email.toLowerCase() : null;
  let name = typeof payload.name === 'string' && payload.name ? payload.name : null;
  const claimed = payload[cfg.rolesClaim];
  let roles = Array.isArray(claimed)
    ? claimed.filter((r): r is string => typeof r === 'string')
    : [];

  if (!email) {
    const res = await fetch(`${cfg.baseUrl}/v1/auth/me`, {
      headers: { authorization: `Bearer ${cfg.projectId}:${sessionJwt}` },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`profile lookup failed: HTTP ${res.status}`);
    const me = (await res.json()) as { email?: string; name?: string; roleNames?: string[] };
    email = typeof me.email === 'string' ? me.email.toLowerCase() : null;
    name = name ?? (typeof me.name === 'string' && me.name ? me.name : null);
    if (roles.length === 0 && Array.isArray(me.roleNames)) roles = me.roleNames;
  }
  if (!email) throw new Error('no email on session');

  const isAdmin =
    cfg.adminEmails.includes(email) || roles.some((r) => cfg.adminRoles.includes(r));
  return { email, name: name ?? email.split('@')[0], role: isAdmin ? 'admin' : 'member' };
}
