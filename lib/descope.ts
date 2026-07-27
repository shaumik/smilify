// Descope SSO via standard OIDC + PKCE.
//
// Descope acts purely as the identity source: after the OIDC handshake we
// mint the same first-party session cookie the password flow uses, so
// middleware, roles, and search filtering are identical for both paths.
//
// Enabled by setting DESCOPE_PROJECT_ID. See .env.example for all options.
import { createHash, randomBytes } from 'crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { SessionUser } from './session';

export interface DescopeConfig {
  projectId: string;
  /** OIDC client_id; defaults to the project ID (Descope's default OIDC app). */
  clientId: string;
  clientSecret?: string;
  baseUrl: string;
  appUrl: string;
  /** Claim holding the user's roles in the ID token. */
  rolesClaim: string;
  /** Any of these role names grants the docs `admin` role. */
  adminRoles: string[];
  /** Emails always treated as admin, regardless of roles claim. */
  adminEmails: string[];
}

export function getDescopeConfig(): DescopeConfig | null {
  const projectId = process.env.DESCOPE_PROJECT_ID;
  if (!projectId) return null;
  const csv = (v: string | undefined, fallback: string[]) =>
    v ? v.split(',').map((s) => s.trim()).filter(Boolean) : fallback;
  return {
    projectId,
    clientId: process.env.DESCOPE_CLIENT_ID ?? projectId,
    clientSecret: process.env.DESCOPE_CLIENT_SECRET || undefined,
    baseUrl: (process.env.DESCOPE_BASE_URL ?? 'https://api.descope.com').replace(/\/$/, ''),
    appUrl: (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
    rolesClaim: process.env.DESCOPE_ROLES_CLAIM ?? 'roles',
    adminRoles: csv(process.env.DESCOPE_ADMIN_ROLES, ['admin', 'docs-admin']),
    adminEmails: csv(process.env.DESCOPE_ADMIN_EMAILS, []).map((e) => e.toLowerCase()),
  };
}

/** Short-lived cookie carrying OIDC state + PKCE verifier between redirects. */
export const OAUTH_COOKIE = 'smilify_oauth';

export function redirectUri(cfg: DescopeConfig): string {
  return `${cfg.appUrl}/api/auth/descope/callback`;
}

interface Discovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
}

let discoveryCache: { key: string; value: Discovery; at: number } | null = null;

/** OIDC discovery, cached for 10 minutes. */
export async function getDiscovery(cfg: DescopeConfig): Promise<Discovery> {
  const key = `${cfg.baseUrl}/${cfg.projectId}`;
  if (discoveryCache && discoveryCache.key === key && Date.now() - discoveryCache.at < 600_000) {
    return discoveryCache.value;
  }
  const res = await fetch(`${cfg.baseUrl}/${cfg.projectId}/.well-known/openid-configuration`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`OIDC discovery failed: HTTP ${res.status}`);
  const value = (await res.json()) as Discovery;
  discoveryCache = { key, value, at: Date.now() };
  return value;
}

export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

export async function buildAuthUrl(
  cfg: DescopeConfig,
  state: string,
  codeChallenge: string
): Promise<string> {
  const discovery = await getDiscovery(cfg);
  const url = new URL(discovery.authorization_endpoint);
  url.searchParams.set('client_id', cfg.clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('redirect_uri', redirectUri(cfg));
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

export async function exchangeCode(
  cfg: DescopeConfig,
  code: string,
  codeVerifier: string
): Promise<string> {
  const discovery = await getDiscovery(cfg);
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri(cfg),
    client_id: cfg.clientId,
    code_verifier: codeVerifier,
  });
  if (cfg.clientSecret) body.set('client_secret', cfg.clientSecret);
  const res = await fetch(discovery.token_endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Token exchange failed: HTTP ${res.status}`);
  const data = (await res.json()) as { id_token?: string };
  if (!data.id_token) throw new Error('Token response missing id_token');
  return data.id_token;
}

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

/** Verify the ID token signature/claims and map it to a docs session user. */
export async function verifyIdToken(cfg: DescopeConfig, idToken: string): Promise<SessionUser> {
  const discovery = await getDiscovery(cfg);
  let jwks = jwksCache.get(discovery.jwks_uri);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(discovery.jwks_uri));
    jwksCache.set(discovery.jwks_uri, jwks);
  }
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: discovery.issuer,
    audience: cfg.clientId,
  });
  const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : null;
  if (!email) throw new Error('ID token missing email claim');
  const name =
    typeof payload.name === 'string' && payload.name
      ? payload.name
      : email.split('@')[0];
  const claimed = payload[cfg.rolesClaim];
  const roles = Array.isArray(claimed) ? claimed.filter((r): r is string => typeof r === 'string') : [];
  const isAdmin =
    cfg.adminEmails.includes(email) || roles.some((r) => cfg.adminRoles.includes(r));
  return { email, name, role: isAdmin ? 'admin' : 'member' };
}
