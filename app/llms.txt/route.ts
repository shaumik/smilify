import { NextResponse } from 'next/server';
import { getConfig } from '@/lib/config';
import { getSessionUser } from '@/lib/auth';
import { getOrderedPages } from '@/lib/config';
import { getPage } from '@/lib/content';

// Mintlify-parity /llms.txt: an LLM-friendly index of the docs.
// Requires auth like everything else (enforced by middleware too).
export async function GET() {
  const user = await getSessionUser();
  if (!user) return new NextResponse('unauthorized', { status: 401 });
  const config = getConfig();
  const lines: string[] = [`# ${config.name}`, '', `> ${config.description ?? ''}`, ''];
  let currentTab = '';
  for (const { slug, tab } of getOrderedPages(user.role)) {
    if (tab !== currentTab) {
      currentTab = tab;
      lines.push(`## ${tab}`, '');
    }
    const page = getPage(slug);
    if (!page) continue;
    const desc = page.frontmatter.description ? `: ${page.frontmatter.description}` : '';
    lines.push(`- [${page.frontmatter.title ?? slug}](/${slug})${desc}`);
  }
  return new NextResponse(lines.join('\n') + '\n', {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
