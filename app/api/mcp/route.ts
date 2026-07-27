import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/lib/agent-auth';
import { canAccessPage, getOrderedPages } from '@/lib/config';
import { getPage } from '@/lib/content';
import { getSite, getSites, SELF_SLUG } from '@/lib/sites';
import { search } from '@/lib/search';
import { classifyAgent, logEvent } from '@/lib/analytics';

// MCP server for every docs site on this deployment (Streamable HTTP
// transport, stateless JSON mode). Connect with any MCP client:
//   url:    https://<docs-host>/api/mcp
//   header: Authorization: Bearer $DOCS_AGENT_TOKEN
// Tools: search_docs, read_page, list_pages. Pages are addressed as
// "<site>/<slug>" so one endpoint serves every connected repo.

const PROTOCOL_VERSION = '2025-06-18';

const TOOLS = [
  {
    name: 'search_docs',
    description:
      'Full-text search across the documentation. Returns matching pages with title, path ("<site>/<slug>"), section, and a snippet. Pass `site` to scope the search to one docs site; omit it to search every site.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        site: { type: 'string', description: 'Optional site slug to scope the search' },
      },
      required: ['query'],
    },
  },
  {
    name: 'read_page',
    description:
      'Read a documentation page as markdown by its path: "<site>/<slug>" (e.g. "docs/quickstart" or "acme/api-reference/introduction").',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Page path "<site>/<slug>" without leading slash' },
      },
      required: ['slug'],
    },
  },
  {
    name: 'list_pages',
    description:
      'List documentation pages with path, title, description, and section. Pass `site` to list one docs site; omit it to list every site.',
    inputSchema: {
      type: 'object',
      properties: {
        site: { type: 'string', description: 'Optional site slug to scope the listing' },
      },
    },
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

function resolveSites(siteArg: unknown): string[] | null {
  if (typeof siteArg === 'string' && siteArg.trim()) {
    return getSite(siteArg.trim()) ? [siteArg.trim()] : null;
  }
  return getSites().map((s) => s.slug);
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
        serverInfo: { name: 'smilify-docs', version: '1.0.0' },
        instructions:
          'Documentation server hosting one or more docs sites. Pages are addressed as "<site>/<slug>". Use search_docs to find relevant pages, read_page to fetch full content, list_pages for the table of contents.',
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
        const sites = resolveSites(args.site);
        if (!sites) {
          return rpcResult(msg.id, {
            content: [{ type: 'text', text: `Unknown site "${args.site}".` }],
            isError: true,
          });
        }
        const results = sites.flatMap((s) => {
          try {
            return search(s, args.query, actor.role, 8).map((r) => ({ ...r, site: s }));
          } catch {
            return []; // site not synced yet
          }
        });
        const text =
          results.length === 0
            ? 'No results.'
            : results
                .slice(0, 8)
                .map(
                  (r) =>
                    `## ${r.title}\npath: ${r.site}/${r.slug}\nsection: ${r.tab} › ${r.group}\n${r.snippet}`
                )
                .join('\n\n');
        return rpcResult(msg.id, textContent(text));
      }

      if (name === 'read_page') {
        const raw = typeof args.slug === 'string' ? args.slug.replace(/^\//, '') : '';
        const [site, ...rest] = raw.split('/');
        // Bare slugs keep working for the built-in site.
        const [siteSlug, pageSlug] =
          getSite(site) && rest.length > 0 ? [site, rest.join('/')] : [SELF_SLUG, raw];
        const page = pageSlug ? getPage(siteSlug, pageSlug) : null;
        if (!page || !canAccessPage(siteSlug, pageSlug, actor.role)) {
          return rpcResult(msg.id, {
            content: [{ type: 'text', text: `No page found for "${raw}". Use "<site>/<slug>" paths from list_pages.` }],
            isError: true,
          });
        }
        return rpcResult(
          msg.id,
          textContent(`# ${page.frontmatter.title ?? pageSlug}\n\n${page.content.trim()}`)
        );
      }

      if (name === 'list_pages') {
        const sites = resolveSites(args.site);
        if (!sites) {
          return rpcResult(msg.id, {
            content: [{ type: 'text', text: `Unknown site "${args.site}".` }],
            isError: true,
          });
        }
        const lines = sites.flatMap((s) => {
          try {
            return getOrderedPages(s, actor.role).map(({ slug, tab, group }) => {
              const page = getPage(s, slug);
              const desc = page?.frontmatter.description
                ? ` — ${page.frontmatter.description}`
                : '';
              return `- ${s}/${slug} (${tab} › ${group}): ${page?.frontmatter.title ?? slug}${desc}`;
            });
          } catch {
            return [`- ${s}: (not synced yet)`];
          }
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
