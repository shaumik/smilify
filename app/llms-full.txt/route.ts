import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/lib/agent-auth';
import { getConfig, getOrderedPages } from '@/lib/config';
import { getPage } from '@/lib/content';
import { getSite, SELF_SLUG } from '@/lib/sites';
import { classifyAgent, logEvent } from '@/lib/analytics';

// llms-full.txt: a site's entire documentation set as one markdown document,
// role-filtered. Reached at /<site>/llms-full.txt or /llms-full.txt?site=<slug>.
export async function GET(req: NextRequest) {
  const actor = await getActor(req);
  if (!actor) return new NextResponse('unauthorized', { status: 401 });
  const site =
    req.nextUrl.searchParams.get('site')?.trim() ||
    req.headers.get('x-docs-site')?.trim() ||
    SELF_SLUG;
  if (!getSite(site)) return new NextResponse('unknown site\n', { status: 404 });
  logEvent({
    type: 'llms_full',
    path: `/${site}/llms-full.txt`,
    actor: actor.email,
    ...classifyAgent(req.headers.get('user-agent')),
  });
  const config = getConfig(site);
  const parts: string[] = [`# ${config.name}`, '', `> ${config.description ?? ''}`];
  for (const { slug, tab, group } of getOrderedPages(site, actor.role)) {
    const page = getPage(site, slug);
    if (!page) continue;
    parts.push(
      '',
      '---',
      '',
      `# ${page.frontmatter.title ?? slug}`,
      '',
      `Path: /${site}/${slug} · Section: ${tab} › ${group}`,
      page.frontmatter.description ? `\n> ${page.frontmatter.description}` : '',
      '',
      page.content.trim()
    );
  }
  return new NextResponse(parts.join('\n') + '\n', {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
