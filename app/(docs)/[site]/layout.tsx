import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import {
  defaultVersion,
  DocsConfig,
  getConfig,
  getNavigationForRole,
  getVersions,
  NavEntry,
  NavGroup,
} from '@/lib/config';
import { getPage } from '@/lib/content';
import { getSite, getSites } from '@/lib/sites';
import Topbar from '@/components/Topbar';
import Sidebar from '@/components/Sidebar';

export const VERSION_COOKIE = 'smilify_version';

export function generateMetadata({ params }: { params: { site: string } }) {
  try {
    const config = getConfig(params.site);
    return {
      title: { default: config.name, template: `%s - ${config.name}` },
      description: config.description,
    };
  } catch {
    return {};
  }
}

export interface NavPageData {
  kind: 'page';
  slug: string;
  title: string;
  icon?: string;
}

export interface NavGroupData {
  kind: 'group';
  group: string;
  access?: string;
  items: (NavPageData | NavGroupData)[];
}

export interface NavTabData {
  tab: string;
  groups: NavGroupData[];
}

function toGroupData(site: string, g: NavGroup): NavGroupData {
  const items = g.pages.map((entry: NavEntry): NavPageData | NavGroupData => {
    if (typeof entry === 'string') {
      const page = getPage(site, entry);
      return {
        kind: 'page',
        slug: entry,
        title: page?.frontmatter.title ?? entry.split('/').pop() ?? entry,
        icon: page?.frontmatter.icon,
      };
    }
    return toGroupData(site, entry);
  });
  return { kind: 'group', group: g.group, access: g.access, items };
}

export default async function DocsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { site: string };
}) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  const site = params.site;
  if (!getSite(site)) notFound();

  let config: DocsConfig;
  try {
    config = getConfig(site);
  } catch {
    // Connected repo hasn't synced successfully yet.
    notFound();
  }

  const versions = getVersions(site);
  const cookieVersion = cookies().get(VERSION_COOKIE)?.value;
  const version =
    versions.length > 0
      ? versions.includes(cookieVersion ?? '')
        ? cookieVersion!
        : defaultVersion(site)
      : undefined;

  const nav: NavTabData[] = getNavigationForRole(site, user.role, version).map((tab) => ({
    tab: tab.tab,
    groups: tab.groups.map((g) => toGroupData(site, g)),
  }));

  const sites = getSites().map((s) => ({ slug: s.slug, name: s.name }));

  const { colors } = config;
  const cssVars = `:root{--primary:${colors.primary};--primary-light:${colors.light ?? colors.primary};--primary-dark:${colors.dark ?? colors.primary};}`;

  return (
    <div className="docs-shell">
      <style dangerouslySetInnerHTML={{ __html: cssVars }} />
      <Topbar
        name={config.name}
        site={site}
        sites={sites}
        nav={nav}
        links={config.navbar?.links ?? []}
        user={user}
        versions={versions}
        version={version}
      />
      <div className="docs-body">
        <Sidebar
          site={site}
          nav={nav}
          anchors={config.navigation.global?.anchors ?? []}
          socials={config.footer?.socials ?? {}}
        />
        <div className="docs-main">{children}</div>
      </div>
    </div>
  );
}
