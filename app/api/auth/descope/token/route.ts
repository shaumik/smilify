import { NextRequest, NextResponse } from 'next/server';
import { getDescopeConfig, verifyDescopeSession } from '@/lib/descope';
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from '@/lib/session';

// Called by the login page after the embedded Descope flow succeeds:
// validates the Descope session JWT and mints our first-party session.
export async function POST(req: NextRequest) {
  const cfg = getDescopeConfig();
  if (!cfg) return NextResponse.json({ error: 'sso_not_configured' }, { status: 400 });
  let body: { jwt?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  if (typeof body.jwt !== 'string' || !body.jwt) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  try {
    const user = await verifyDescopeSession(cfg, body.jwt);
    const token = await createSessionToken(user);
    const res = NextResponse.json({ ok: true, user });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
    return res;
  } catch (e) {
    console.error('descope token rejected:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'invalid_session' }, { status: 401 });
  }
}
