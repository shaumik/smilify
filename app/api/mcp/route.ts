import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/lib/agent-auth';
import { canAccessPage, getConfig, getOrderedPages } from '@/lib/config';
import { getPage } from '@/lib/content';
import { search } from '@/lib/search';
import { classifyAgent, logEvent } from '@/lib/analytics';

// MCP server for the docs (Streamable HTTP transport, stateless JSON mode).
// Connect with any MCP client:
//   url:    https://<docs-host>/api/mcp
//   header: Authorization: Bearer $DOCS_AGENT_TOKEN
// Tools: search_docs, read_page, list_pages.

const PROTOCOL_VERSION = '2025-06-18';

const TOOLS = [
  {
    name: 'search_docs',
    description:
      'Full-text search across the documentation. Returns matching pages with title, slug, section, and a snippet.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Search query' } },
      required: ['query'],
    },
  },
  {
    name: 'read_page',
    description:
      'Read a documentation page as markdown by its slug (e.g. "quickstart" or "api-reference/introduction").',
    inputSchema: {
      type: 'object',
      properties: { slug: { type: 'string', description: 'Page slug without leading slash' } },
      required: ['slug'],
    },
  },
  {
    name: 'list_pages',
    description: 'List every documentation page with slug, title, description, and section.',
    inputSchema: { type: 'object', properties: {} },
  },
];

type Rpc = { jsonrpc: '2.0'; id?: number | string | null; method: string; params?: any };

function rpcResult(id: Rpc['id'], result: unknown) {
  return NextResponse.json({ jsonrpc: '2.0', id: id ?? null, result });
}

function rpcError(id: Rpc['id'], code: number, message: string) {
  return NextResponse.json({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });
}

function textContent(text: string) {
  return { content: [{ type: 'text', text }], isError: false };
}

export async function GET() {
  return NextResponse.json(
    { error: 'method_not_allowed', hint: 'POST JSON-RPC messages to this endpoint' },
    { status: 405 }
  );
}

export async function POST(req: NextRequest) {
  const actor = await getActor(req);
  if (!actor) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let msg: Rpc;
  try {
    msg = await req.json();
  } catch {
    return rpcError(null, -32700, 'Parse error');
  }
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
    return rpcError(msg?.id ?? null, -32600, 'Invalid request');
  }

  // Notifications get no response body.
  if (msg.id === undefined && msg.method.startsWith('notifications/')) {
    return new NextResponse(null, { status: 202 });
  }

  switch (msg.method) {
    case 'initialize':
      return rpcResult(msg.id, {
        protocolVersion:
          typeof msg.params?.protocolVersion === 'string'
            ? msg.params.protocolVersion
            : PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: `${getConfig().name.toLowerCase()}-docs`, version: '1.0.0' },
        instructions:
          'Documentation server. Use search_docs to find relevant pages, read_page to fetch full content, list_pages for the table of contents.',
      });

    case 'ping':
      return rpcResult(msg.id, {});

    case 'tools/list':
      return rpcResult(msg.id, { tools: TOOLS });

    case 'tools/call': {
      const name = msg.params?.name;
      const args = msg.params?.arguments ?? {};
      logEvent({
        type: 'mcp',
        path: `tool:${name}`,
        query: typeof args.query === 'string' ? args.query : undefined,
        actor: actor.email,
        ...classifyAgent(req.headers.get('user-agent')),
      });

      if (name === 'search_docs') {
        if (typeof args.query !== 'string' || !args.query.trim()) {
          return rpcResult(msg.id, { content: [{ type: 'text', text: 'query is required' }], isError: true });
        }
        const results = search(args.query, actor.role, 8);
        const text =
          results.length === 0
            ? 'No results.'
            : results
                .map(
                  (r) =>
                    `## ${r.title}\nslug: ${r.slug}\nsection: ${r.tab} › ${r.group}\n${r.snippet}`
                )
                .join('\n\n');
        return rpcResult(msg.id, textContent(text));
      }

      if (name === 'read_page') {
        const slug = typeof args.slug === 'string' ? args.slug.replace(/^\//, '') : '';
        const page = slug ? getPage(slug) : null;
        if (!page || !canAccessPage(slug, actor.role)) {
          return rpcResult(msg.id, {
            content: [{ type: 'text', text: `No page found for slug "${slug}".` }],
            isError: true,
          });
        }
        return rpcResult(
          msg.id,
          textContent(`# ${page.frontmatter.title ?? slug}\n\n${page.content.trim()}`)
        );
      }

      if (name === 'list_pages') {
        const lines = getOrderedPages(actor.role).map(({ slug, tab, group }) => {
          const page = getPage(slug);
          const desc = page?.frontmatter.description ? ` — ${page.frontmatter.description}` : '';
          return `- ${slug} (${tab} › ${group}): ${page?.frontmatter.title ?? slug}${desc}`;
        });
        return rpcResult(msg.id, textContent(lines.join('\n')));
      }

      return rpcResult(msg.id, {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      });
    }

    default:
      return rpcError(msg.id, -32601, `Method not found: ${msg.method}`);
  }
}
