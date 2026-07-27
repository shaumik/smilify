import { NextRequest, NextResponse } from 'next/server';
import { exchangeCode, getDescopeConfig, OAUTH_COOKIE, verifyIdToken } from '@/lib/descope';
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from '@/lib/session';

export async function GET(req: NextRequest) {
  const fail = (reason: string) => {
    console.error(`descope callback rejected: ${reason}`);
    const res = NextResponse.redirect(new URL('/login?error=sso_failed', req.nextUrl));
    res.cookies.set(OAUTH_COOKIE, '', { path: '/', maxAge: 0 });
    return res;
  };

  const cfg = getDescopeConfig();
  if (!cfg) return fail('not configured');

  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const raw = req.cookies.get(OAUTH_COOKIE)?.value;
  if (!code || !state || !raw) return fail('missing code/state/cookie');

  let stored: { state?: string; verifier?: string; next?: string };
  try {
    stored = JSON.parse(raw);
  } catch {
    return fail('malformed state cookie');
  }
  if (!stored.state || !stored.verifier || stored.state !== state) {
    return fail('state mismatch');
  }

  try {
    const idToken = await exchangeCode(cfg, code, stored.verifier);
    const user = await verifyIdToken(cfg, idToken);
    const token = await createSessionToken(user);
    const next =
      stored.next && stored.next.startsWith('/') && !stored.next.startsWith('//')
        ? stored.next
        : '/';
    const res = NextResponse.redirect(new URL(next, req.nextUrl));
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
    res.cookies.set(OAUTH_COOKIE, '', { path: '/', maxAge: 0 });
    return res;
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'unknown error');
  }
}
