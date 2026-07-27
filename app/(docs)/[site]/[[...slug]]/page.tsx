import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { compileDocMDX } from '@/lib/mdx';
import { getSessionUser } from '@/lib/auth';
import { canAccessPage, getConfig, getVersions } from '@/lib/config';
import { extractToc, getPage, getPager } from '@/lib/content';
import { getSite } from '@/lib/sites';
import { logEvent } from '@/lib/analytics';
import Toc from '@/components/Toc';
import Breadcrumbs from '@/components/Breadcrumbs';
import PageFooter from '@/components/PageFooter';
import ApiPage from '@/components/api/ApiPage';
import AsyncApiPage from '@/components/api/AsyncApiPage';

export const dynamic = 'force-dynamic';

// The site root serves the repo's landing page: index.mdx if present,
// else introduction.mdx (this platform's convention), else the first
// navigation page.
function slugFromParams(site: string, params: { slug?: string[] }): string {
  if (params.slug?.length) return params.slug.join('/');
  for (const candidate of ['index', 'introduction']) {
    if (getPage(site, candidate)) return candidate;
  }
  return getConfig(site).navigation.tabs[0]?.groups[0]?.pages.find(
    (p): p is string => typeof p === 'string'
  ) ?? 'index';
}

export async function generateMetadata({
  params,
}: {
  params: { site: string; slug?: string[] };
}): Promise<Metadata> {
  if (!getSite(params.site)) return {};
  const page = getPage(params.site, slugFromParams(params.site, params));
  if (!page) return {};
  return {
    title: page.frontmatter.title,
    description: page.frontmatter.description,
  };
}

export default async function DocPage({
  params,
}: {
  params: { site: string; slug?: string[] };
}) {
  const user = await getSessionUser();
  if (!user) return null; // layout redirects; keep types happy
  const site = params.site;
  if (!getSite(site)) notFound();
  const slug = slugFromParams(site, params);
  const page = getPage(site, slug);
  // Hide pages that don't exist or that this role may not see.
  if (!page || !canAccessPage(site, slug, user.role)) notFound();
  logEvent({ type: 'page_view', path: `/${site}/${slug}`, actor: user.email, agent: 'human' });

  const versions = getVersions(site);
  const cookieVersion = cookies().get('smilify_version')?.value;
  const version =
    versions.length > 0
      ? versions.includes(cookieVersion ?? '')
        ? cookieVersion
        : versions[0]
      : undefined;
  const pager = getPager(site, slug, user.role, version);

  // Event reference pages delegate to the AsyncAPI renderer.
  if (page.frontmatter.asyncapi) {
    return (
      <AsyncApiPage
        site={site}
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
        site={site}
        slug={slug}
        openapiRef={page.frontmatter.openapi}
        frontmatter={page.frontmatter}
        intro={page.content}
        pager={pager}
      />
    );
  }

  const toc = extractToc(page.content);
  const content = await compileDocMDX(page.content, site);

  const feedback = getConfig(site).feedback?.thumbsRating !== false;

  return (
    <>
      <article className="doc-article">
        <Breadcrumbs site={site} slug={slug} />
        <header className="doc-header">
          <h1>{page.frontmatter.title ?? slug}</h1>
          {page.frontmatter.description && <p>{page.frontmatter.description}</p>}
        </header>
        <div className="prose">{content}</div>
        <PageFooter site={site} slug={slug} pager={pager} feedback={feedback} />
      </article>
      <Toc entries={toc} />
    </>
  );
}
