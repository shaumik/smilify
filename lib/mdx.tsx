import { compileMDX } from 'next-mdx-remote/rsc';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import rehypePrettyCode from 'rehype-pretty-code';
import { mdxComponents } from '@/components/mdx';

export const prettyCodeOptions = {
  theme: { dark: 'github-dark-default', light: 'github-light-default' },
  keepBackground: false,
  defaultLang: 'txt',
};

/** Compile doc MDX with the standard plugin pipeline and component set. */
export async function compileDocMDX(source: string) {
  const { content } = await compileMDX({
    source,
    components: mdxComponents,
    options: {
      mdxOptions: {
        remarkPlugins: [remarkGfm],
        rehypePlugins: [rehypeSlug, [rehypePrettyCode, prettyCodeOptions] as any],
      },
    },
  });
  return content;
}
