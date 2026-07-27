// Agent access: AI agents and scripts can't hold a browser session cookie,
// so the machine-readable surfaces (llms.txt, llms-full.txt, *.md, /api/mcp,
// /api/search) also accept a bearer token.
//
//   Authorization: Bearer $DOCS_AGENT_TOKEN
//
// Token requests act as the `member` role by default (no admin content),
// configurable via DOCS_AGENT_ROLE=admin.
import type { NextRequest } from 'next/server';
import type { Role } from './config';
import { SESSION_COOKIE, SessionUser, verifySessionToken } from './session';

export function getAgentToken(): string {
  return process.env.DOCS_AGENT_TOKEN ?? 'smilify-agent-dev-token';
}

export function getAgentRole(): Role {
  return process.env.DOCS_AGENT_ROLE === 'admin' ? 'admin' : 'member';
}

export interface Actor {
  kind: 'user' | 'agent';
  email: string;
  role: Role;
}

/** Resolve the caller from either a session cookie or the agent bearer token. */
export async function getActor(req: NextRequest): Promise<Actor | null> {
  const auth = req.headers.get('authorization') ?? '';
  if (auth.startsWith('Bearer ') && auth.slice(7) === getAgentToken()) {
    return { kind: 'agent', email: 'agent-token', role: getAgentRole() };
  }
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    const user: SessionUser | null = await verifySessionToken(token);
    if (user) return { kind: 'user', email: user.email, role: user.role };
  }
  return null;
}

/** Edge-safe check used by middleware for agent-accessible paths. */
export function hasAgentToken(authorizationHeader: string | null): boolean {
  return (
    !!authorizationHeader &&
    authorizationHeader.startsWith('Bearer ') &&
    authorizationHeader.slice(7) === getAgentToken()
  );
}
