import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/lib/agent-auth';
import { getConfig, getOrderedPages } from '@/lib/config';
import { getPage } from '@/lib/content';
import { classifyAgent, logEvent } from '@/lib/analytics';

// Mintlify-parity /llms.txt: an LLM-friendly index of the docs.
// Session cookie or `Authorization: Bearer $DOCS_AGENT_TOKEN`.
export async function GET(req: NextRequest) {
  const actor = await getActor(req);
  if (!actor) return new NextResponse('unauthorized', { status: 401 });
  logEvent({
    type: 'llms_txt',
    path: '/llms.txt',
    actor: actor.email,
    ...classifyAgent(req.headers.get('user-agent')),
  });
  const config = getConfig();
  const lines: string[] = [`# ${config.name}`, '', `> ${config.description ?? ''}`, ''];
  let currentTab = '';
  for (const { slug, tab } of getOrderedPages(actor.role)) {
    if (tab !== currentTab) {
      currentTab = tab;
      lines.push(`## ${tab}`, '');
    }
    const page = getPage(slug);
    if (!page) continue;
    const desc = page.frontmatter.description ? `: ${page.frontmatter.description}` : '';
    lines.push(`- [${page.frontmatter.title ?? slug}](/${slug}.md)${desc}`);
  }
  lines.push('', '## Access', '', '- Full content: /llms-full.txt', '- Any page as markdown: /<slug>.md', '- MCP endpoint: POST /api/mcp');
  return new NextResponse(lines.join('\n') + '\n', {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
