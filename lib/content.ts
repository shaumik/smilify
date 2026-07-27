import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { getOrderedPages, Role } from './config';

const CONTENT_DIR = path.join(process.cwd(), 'content');

export interface PageFrontmatter {
  title?: string;
  description?: string;
  icon?: string;
  openapi?: string;
  asyncapi?: string;
  mode?: 'wide' | 'default';
}

export interface DocPage {
  slug: string;
  frontmatter: PageFrontmatter;
  content: string;
}

export function pageFilePath(slug: string): string | null {
  // snippets/ holds reusable fragments, not routable pages
  if (slug.startsWith('snippets/')) return null;
  const safe = slug.replace(/\.+/g, '.');
  const candidate = path.join(CONTENT_DIR, `${safe}.mdx`);
  if (!candidate.startsWith(CONTENT_DIR)) return null;
  return fs.existsSync(candidate) ? candidate : null;
}

export function getPage(slug: string): DocPage | null {
  const file = pageFilePath(slug);
  if (!file) return null;
  const raw = fs.readFileSync(file, 'utf8');
  const { data, content } = matter(raw);
  return { slug, frontmatter: data as PageFrontmatter, content };
}

export function getAllSlugs(): string[] {
  const slugs: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.mdx')) {
        slugs.push(path.relative(CONTENT_DIR, full).replace(/\.mdx$/, '').split(path.sep).join('/'));
      }
    }
  };
  walk(CONTENT_DIR);
  return slugs;
}

export interface PagerLink {
  slug: string;
  title: string;
}

/** Previous/next links within the role's visible navigation order. */
export function getPager(
  slug: string,
  role: Role,
  version?: string
): { prev: PagerLink | null; next: PagerLink | null } {
  const ordered = getOrderedPages(role, version);
  const idx = ordered.findIndex((p) => p.slug === slug);
  if (idx === -1) return { prev: null, next: null };
  const titleOf = (s: string) => getPage(s)?.frontmatter.title ?? s.split('/').pop() ?? s;
  const prev = idx > 0 ? ordered[idx - 1] : null;
  const next = idx < ordered.length - 1 ? ordered[idx + 1] : null;
  return {
    prev: prev ? { slug: prev.slug, title: titleOf(prev.slug) } : null,
    next: next ? { slug: next.slug, title: titleOf(next.slug) } : null,
  };
}

export interface TocEntry {
  id: string;
  text: string;
  depth: 2 | 3;
}

/** GitHub-style slugger matching rehype-slug's output. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');
}

/** Extract h2/h3 headings for the table of contents, skipping code fences. */
export function extractToc(content: string): TocEntry[] {
  const entries: TocEntry[] = [];
  const seen = new Map<string, number>();
  let inFence = false;
  for (const line of content.split('\n')) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
    if (!m) continue;
    const text = m[2].replace(/[*_`]/g, '');
    let id = slugify(text);
    const count = seen.get(id) ?? 0;
    seen.set(id, count + 1);
    if (count > 0) id = `${id}-${count}`;
    entries.push({ id, text, depth: m[1].length as 2 | 3 });
  }
  return entries;
}

/** Strip markdown/MDX syntax to plain text for search indexing. */
export function stripMarkdown(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
