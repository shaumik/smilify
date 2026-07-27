import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { compileDocMDX } from '@/lib/mdx';
import { cookies } from 'next/headers';
import { getSessionUser } from '@/lib/auth';
import { canAccessPage, getConfig, getVersions } from '@/lib/config';
import { logEvent } from '@/lib/analytics';
import { extractToc, getPage, getPager } from '@/lib/content';
import { mdxComponents } from '@/components/mdx';
import Toc from '@/components/Toc';
import Breadcrumbs from '@/components/Breadcrumbs';
import PageFooter from '@/components/PageFooter';
import ApiPage from '@/components/api/ApiPage';
import AsyncApiPage from '@/components/api/AsyncApiPage';

export const dynamic = 'force-dynamic';

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
  logEvent({ type: 'page_view', path: `/${slug}`, actor: user.email, agent: 'human' });

  const versions = getVersions();
  const cookieVersion = cookies().get('smilify_version')?.value;
  const version =
    versions.length > 0
      ? versions.includes(cookieVersion ?? '')
        ? cookieVersion
        : versions[0]
      : undefined;
  const pager = getPager(slug, user.role, version);

  // Event reference pages delegate to the AsyncAPI renderer.
  if (page.frontmatter.asyncapi) {
    return (
      <AsyncApiPage
        slug={slug}
        asyncapiRef={page.frontmatter.asyncapi}
        frontmatter={page.frontmatter}
        intro={page.content}
        pager={pager}
      />
    );
  }

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
  const content = await compileDocMDX(page.content);

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
