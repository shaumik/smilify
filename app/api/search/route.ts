import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/lib/agent-auth';
import { search } from '@/lib/search';
import { getSite } from '@/lib/sites';
import { classifyAgent, logEvent } from '@/lib/analytics';

export async function GET(req: NextRequest) {
  const actor = await getActor(req);
  if (!actor) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const site = req.nextUrl.searchParams.get('site')?.trim() || 'docs';
  if (!getSite(site)) return NextResponse.json({ error: 'unknown_site' }, { status: 404 });
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (!q) return NextResponse.json({ results: [] });
  logEvent({
    type: 'search',
    query: q.slice(0, 200),
    actor: actor.email,
    ...classifyAgent(req.headers.get('user-agent')),
  });
  return NextResponse.json({ results: search(site, q, actor.role) });
}
