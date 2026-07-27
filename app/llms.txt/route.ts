import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/lib/agent-auth';
import { getConfig, getOrderedPages } from '@/lib/config';
import { getPage } from '@/lib/content';
import { getSite, SELF_SLUG } from '@/lib/sites';
import { classifyAgent, logEvent } from '@/lib/analytics';

// Mintlify-parity llms.txt: an LLM-friendly index of a site's docs.
// Reached at /<site>/llms.txt (middleware rewrite) or /llms.txt?site=<slug>.
// Session cookie or `Authorization: Bearer $DOCS_AGENT_TOKEN`.
export async function GET(req: NextRequest) {
  const actor = await getActor(req);
  if (!actor) return new NextResponse('unauthorized', { status: 401 });
  const site =
    req.nextUrl.searchParams.get('site')?.trim() ||
    req.headers.get('x-docs-site')?.trim() ||
    SELF_SLUG;
  if (!getSite(site)) return new NextResponse('unknown site\n', { status: 404 });
  logEvent({
    type: 'llms_txt',
    path: `/${site}/llms.txt`,
    actor: actor.email,
    ...classifyAgent(req.headers.get('user-agent')),
  });
  const config = getConfig(site);
  const lines: string[] = [`# ${config.name}`, '', `> ${config.description ?? ''}`, ''];
  let currentTab = '';
  for (const { slug, tab } of getOrderedPages(site, actor.role)) {
    if (tab !== currentTab) {
      currentTab = tab;
      lines.push(`## ${tab}`, '');
    }
    const page = getPage(site, slug);
    if (!page) continue;
    const desc = page.frontmatter.description ? `: ${page.frontmatter.description}` : '';
    lines.push(`- [${page.frontmatter.title ?? slug}](/${site}/${slug}.md)${desc}`);
  }
  lines.push(
    '',
    '## Access',
    '',
    `- Full content: /${site}/llms-full.txt`,
    `- Any page as markdown: /${site}/<slug>.md`,
    '- MCP endpoint: POST /api/mcp'
  );
  return new NextResponse(lines.join('\n') + '\n', {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
