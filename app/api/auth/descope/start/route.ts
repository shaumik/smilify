import { NextRequest, NextResponse } from 'next/server';
import {
  buildAuthUrl,
  getDescopeConfig,
  OAUTH_COOKIE,
  pkceChallenge,
  randomToken,
} from '@/lib/descope';

function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

// Kicks off the Descope OIDC flow: stash state + PKCE verifier in a
// short-lived cookie and redirect to the hosted sign-in page.
export async function GET(req: NextRequest) {
  const cfg = getDescopeConfig();
  if (!cfg) {
    return NextResponse.redirect(new URL('/login?error=sso_not_configured', req.nextUrl));
  }
  const state = randomToken();
  const verifier = randomToken();
  const next = safeNext(req.nextUrl.searchParams.get('next'));
  try {
    const authUrl = await buildAuthUrl(cfg, state, pkceChallenge(verifier));
    const res = NextResponse.redirect(authUrl);
    res.cookies.set(OAUTH_COOKIE, JSON.stringify({ state, verifier, next }), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 600,
    });
    return res;
  } catch (e) {
    console.error('descope start failed:', e);
    return NextResponse.redirect(new URL('/login?error=sso_failed', req.nextUrl));
  }
}
