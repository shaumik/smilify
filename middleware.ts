import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from './lib/session';
import { hasAgentToken } from './lib/agent-auth';

// Every route requires an authenticated session except:
//  - the login page and auth APIs
//  - the GitHub webhook (its own HMAC signature auth)
//  - the Smilify API (its own bearer-key auth, like any product API)
//  - Next.js internals and static assets
// Machine-readable surfaces additionally accept the docs agent bearer token
// (agents don't hold browser cookies): per-site llms.txt / llms-full.txt,
// any page as .md, the MCP endpoint, and search.
const PUBLIC_PATHS = [
  /^\/login$/,
  /^\/api\/auth\/descope\/token$/,
  /^\/api\/github\/webhook$/,
  /^\/api\/v1(\/|$)/,
];

const AGENT_PATHS = [
  /^\/llms(-full)?\.txt$/,
  /^\/[^/]+\/llms(-full)?\.txt$/,
  /^\/api\/mcp$/,
  /^\/api\/search$/,
  /^\/api\/raw(\/|$)/,
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((re) => re.test(pathname))) return NextResponse.next();

  const isMarkdown = pathname.endsWith('.md') && !pathname.startsWith('/api/');
  const isAgentPath = isMarkdown || AGENT_PATHS.some((re) => re.test(pathname));

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const user = token ? await verifySessionToken(token) : null;
  const agentOk = isAgentPath && hasAgentToken(req.headers.get('authorization'));

  if (!user && !agentOk) {
    if (pathname.startsWith('/api/') || isAgentPath) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    const login = req.nextUrl.clone();
    login.pathname = '/login';
    login.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(login);
  }

  // /<site>/llms.txt and /<site>/llms-full.txt → the site-scoped route.
  // The site travels in a request header: query params set here are not
  // reliably visible to the rewritten route handler.
  const llms = pathname.match(/^\/([^/]+)\/(llms(?:-full)?\.txt)$/);
  if (llms) {
    const url = req.nextUrl.clone();
    url.pathname = `/${llms[2]}`;
    const headers = new Headers(req.headers);
    headers.set('x-docs-site', llms[1]);
    return NextResponse.rewrite(url, { request: { headers } });
  }

  // Serve any page as raw markdown at /<site>/<slug>.md (agent-friendly URLs).
  if (isMarkdown) {
    const url = req.nextUrl.clone();
    url.pathname = `/api/raw/${pathname.slice(1, -3)}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.svg).*)'],
};
