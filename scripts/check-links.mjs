// CI link check: verify every internal link in content/*.mdx points at a
// real page slug (or a known non-page route). Exits 1 on broken links.
import fs from 'fs';
import path from 'path';

const CONTENT = path.join(process.cwd(), 'content');
const NON_PAGE_ROUTES = new Set(['llms.txt', 'llms-full.txt', 'login']);

const slugs = new Set();
const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.mdx')) {
      files.push(full);
      const rel = path.relative(CONTENT, full).replace(/\.mdx$/, '').split(path.sep).join('/');
      if (!rel.startsWith('snippets/')) slugs.add(rel);
    }
  }
})(CONTENT);

let broken = 0;
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  // strip fenced code blocks so example links aren't checked
  const prose = text.replace(/```[\s\S]*?```/g, '');
  for (const match of prose.matchAll(/\]\((\/[^)\s#]*)(?:#[^)]*)?\)/g)) {
    const target = match[1].replace(/^\//, '').replace(/\/$/, '');
    if (!target) continue;
    const asSlug = target.replace(/\.md$/, '');
    if (slugs.has(asSlug) || NON_PAGE_ROUTES.has(target)) continue;
    if (fs.existsSync(path.join(process.cwd(), 'public', target))) continue;
    console.error(`BROKEN  ${path.relative(process.cwd(), file)} -> /${target}`);
    broken++;
  }
}

if (broken > 0) {
  console.error(`\n${broken} broken internal link(s).`);
  process.exit(1);
}
console.log(`Link check passed: ${files.length} files, ${slugs.size} pages.`);
