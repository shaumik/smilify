import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/lib/agent-auth';
import { getConfig, getOrderedPages } from '@/lib/config';
import { getPage } from '@/lib/content';
import { classifyAgent, logEvent } from '@/lib/analytics';

// llms-full.txt: the entire documentation set as one markdown document,
// role-filtered. Session cookie or the docs agent bearer token.
export async function GET(req: NextRequest) {
  const actor = await getActor(req);
  if (!actor) return new NextResponse('unauthorized', { status: 401 });
  logEvent({
    type: 'llms_full',
    path: '/llms-full.txt',
    actor: actor.email,
    ...classifyAgent(req.headers.get('user-agent')),
  });
  const config = getConfig();
  const parts: string[] = [`# ${config.name}`, '', `> ${config.description ?? ''}`];
  for (const { slug, tab, group } of getOrderedPages(actor.role)) {
    const page = getPage(slug);
    if (!page) continue;
    parts.push(
      '',
      '---',
      '',
      `# ${page.frontmatter.title ?? slug}`,
      '',
      `Path: /${slug} · Section: ${tab} › ${group}`,
      page.frontmatter.description ? `\n> ${page.frontmatter.description}` : '',
      '',
      page.content.trim()
    );
  }
  return new NextResponse(parts.join('\n') + '\n', {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
