import MiniSearch from 'minisearch';
import { getOrderedPages } from './config';
import { siteVersion } from './sites';
import { getPage, stripMarkdown } from './content';

export interface SearchDoc {
  id: string;
  title: string;
  description: string;
  group: string;
  tab: string;
  text: string;
}

interface Index {
  mini: MiniSearch<SearchDoc>;
  docs: Map<string, SearchDoc>;
}

// One index per site, keyed by sync version. Indexes everything an admin
// can see; results are filtered per-role at query time.
const indexes = new Map<string, Index>();

function buildIndex(site: string): Index {
  const mini = new MiniSearch<SearchDoc>({
    fields: ['title', 'description', 'text', 'group'],
    storeFields: ['title', 'description', 'group', 'tab'],
    searchOptions: {
      boost: { title: 4, description: 2, group: 1.5 },
      prefix: true,
      fuzzy: 0.2,
    },
  });
  const docs = new Map<string, SearchDoc>();
  for (const { slug, group, tab } of getOrderedPages(site, 'admin')) {
    const page = getPage(site, slug);
    if (!page) continue;
    const doc: SearchDoc = {
      id: slug,
      title: page.frontmatter.title ?? slug,
      description: page.frontmatter.description ?? '',
      group,
      tab,
      text: stripMarkdown(page.content),
    };
    docs.set(slug, doc);
    mini.add(doc);
  }
  return { mini, docs };
}

function getIndex(site: string): Index {
  const key = `${site}@${siteVersion(site)}`;
  if (process.env.NODE_ENV !== 'production' || !indexes.has(key)) {
    indexes.set(key, buildIndex(site));
  }
  return indexes.get(key)!;
}

export interface SearchResult {
  slug: string;
  title: string;
  description: string;
  group: string;
  tab: string;
  snippet: string;
}

function makeSnippet(text: string, terms: string[]): string {
  const lower = text.toLowerCase();
  let pos = -1;
  for (const term of terms) {
    pos = lower.indexOf(term.toLowerCase());
    if (pos !== -1) break;
  }
  if (pos === -1) return text.slice(0, 140);
  const start = Math.max(0, pos - 60);
  const snippet = text.slice(start, start + 160);
  return (start > 0 ? '…' : '') + snippet + (start + 160 < text.length ? '…' : '');
}

export function search(site: string, query: string, role: 'admin' | 'member', limit = 10): SearchResult[] {
  const { mini, docs } = getIndex(site);
  const allowed = new Set(getOrderedPages(site, role).map((p) => p.slug));
  const results = mini.search(query);
  const out: SearchResult[] = [];
  for (const r of results) {
    if (!allowed.has(r.id)) continue;
    const doc = docs.get(r.id);
    if (!doc) continue;
    out.push({
      slug: r.id,
      title: doc.title,
      description: doc.description,
      group: doc.group,
      tab: doc.tab,
      snippet: makeSnippet(doc.text, r.terms),
    });
    if (out.length >= limit) break;
  }
  return out;
}
