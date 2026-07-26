import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { compileMDX } from 'next-mdx-remote/rsc';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import rehypePrettyCode from 'rehype-pretty-code';
import { getSessionUser } from '@/lib/auth';
import { canAccessPage, getConfig } from '@/lib/config';
import { extractToc, getPage, getPager } from '@/lib/content';
import { mdxComponents } from '@/components/mdx';
import Toc from '@/components/Toc';
import Breadcrumbs from '@/components/Breadcrumbs';
import PageFooter from '@/components/PageFooter';
import ApiPage from '@/components/api/ApiPage';

export const dynamic = 'force-dynamic';

const prettyCodeOptions = {
  theme: { dark: 'github-dark-default', light: 'github-light-default' },
  keepBackground: false,
  defaultLang: 'txt',
};

function slugFromParams(params: { slug?: string[] }): string {
  return params.slug?.join('/') ?? 'introduction';
}

export async function generateMetadata({
  params,
}: {
  params: { slug?: string[] };
}): Promise<Metadata> {
  const page = getPage(slugFromParams(params));
  if (!page) return {};
  return {
    title: page.frontmatter.title,
    description: page.frontmatter.description,
  };
}

export default async function DocPage({ params }: { params: { slug?: string[] } }) {
  const user = await getSessionUser();
  if (!user) return null; // layout redirects; keep types happy
  const slug = slugFromParams(params);
  const page = getPage(slug);
  // Hide pages that don't exist or that this role may not see.
  if (!page || !canAccessPage(slug, user.role)) notFound();

  const pager = getPager(slug, user.role);

  // API reference pages delegate to the OpenAPI renderer.
  if (page.frontmatter.openapi) {
    return (
      <ApiPage
        slug={slug}
        openapiRef={page.frontmatter.openapi}
        frontmatter={page.frontmatter}
        intro={page.content}
        pager={pager}
      />
    );
  }

  const toc = extractToc(page.content);
  const { content } = await compileMDX({
    source: page.content,
    components: mdxComponents,
    options: {
      mdxOptions: {
        remarkPlugins: [remarkGfm],
        rehypePlugins: [rehypeSlug, [rehypePrettyCode, prettyCodeOptions] as any],
      },
    },
  });

  const feedback = getConfig().feedback?.thumbsRating !== false;

  return (
    <>
      <article className="doc-article">
        <Breadcrumbs slug={slug} />
        <header className="doc-header">
          <h1>{page.frontmatter.title ?? slug}</h1>
          {page.frontmatter.description && <p>{page.frontmatter.description}</p>}
        </header>
        <div className="prose">{content}</div>
        <PageFooter slug={slug} pager={pager} feedback={feedback} />
      </article>
      <Toc entries={toc} />
    </>
  );
}
