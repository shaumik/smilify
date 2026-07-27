import fs from 'fs';
import path from 'path';

// Mintlify-style reusable snippet: <Snippet file="api-key-note" /> renders
// content/snippets/api-key-note.mdx inline with the full component set.
// The compiler is imported lazily to avoid a module cycle with the
// component map (mdx/index -> Snippet -> lib/mdx -> mdx/index).
export default async function Snippet({ file }: { file: string }) {
  const name = file.endsWith('.mdx') ? file : `${file}.mdx`;
  const dir = path.join(process.cwd(), 'content', 'snippets');
  const full = path.join(dir, name.replace(/\.\.+/g, '.'));
  if (!full.startsWith(dir) || !fs.existsSync(full)) {
    return (
      <div className="callout callout-warning">
        <div className="callout-body">
          Missing snippet: <code>snippets/{name}</code>
        </div>
      </div>
    );
  }
  const source = fs.readFileSync(full, 'utf8');
  const { compileDocMDX } = await import('@/lib/mdx');
  const content = await compileDocMDX(source);
  return <>{content}</>;
}
