import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/lib/agent-auth';
import { canAccessPage } from '@/lib/config';
import { getPage } from '@/lib/content';
import { getSite } from '@/lib/sites';
import { classifyAgent, logEvent } from '@/lib/analytics';

// Raw markdown for any docs page. Reached directly or via the middleware
// rewrite from /<slug>.md — the agent-friendly URL form.
export async function GET(req: NextRequest, { params }: { params: { slug: string[] } }) {
  const actor = await getActor(req);
  if (!actor) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const [site, ...rest] = params.slug;
  const slug = rest.join('/');
  if (!getSite(site) || !slug) return new NextResponse('not found\n', { status: 404 });
  const page = getPage(site, slug);
  if (!page || !canAccessPage(site, slug, actor.role)) {
    return new NextResponse('not found\n', { status: 404 });
  }
  logEvent({
    type: 'raw_md',
    path: `/${site}/${slug}.md`,
    actor: actor.email,
    ...classifyAgent(req.headers.get('user-agent')),
  });
  const fm = page.frontmatter;
  const header = [`# ${fm.title ?? slug}`, fm.description ? `\n> ${fm.description}` : ''].join('');
  return new NextResponse(`${header}\n\n${page.content.trim()}\n`, {
    headers: { 'content-type': 'text/markdown; charset=utf-8' },
  });
}
