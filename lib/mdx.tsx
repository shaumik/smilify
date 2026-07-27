import { compileMDX } from 'next-mdx-remote/rsc';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import rehypePrettyCode from 'rehype-pretty-code';
import { makeMdxComponents } from '@/components/mdx';

export const prettyCodeOptions = {
  theme: { dark: 'github-dark-default', light: 'github-light-default' },
  keepBackground: false,
  defaultLang: 'txt',
};

/**
 * Compile doc MDX with the standard plugin pipeline. Components are bound to
 * the site so internal links, cards, and snippets resolve within it —
 * content authors write site-relative paths (`/quickstart`), Mintlify-style.
 */
export async function compileDocMDX(source: string, site: string) {
  const { content } = await compileMDX({
    source,
    components: makeMdxComponents(site),
    options: {
      mdxOptions: {
        remarkPlugins: [remarkGfm],
        rehypePlugins: [rehypeSlug, [rehypePrettyCode, prettyCodeOptions] as any],
      },
    },
  });
  return content;
}
