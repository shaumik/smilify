import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import {
  defaultVersion,
  getConfig,
  getNavigationForRole,
  getVersions,
  NavEntry,
  NavGroup,
} from '@/lib/config';
import { getPage } from '@/lib/content';
import Topbar from '@/components/Topbar';
import Sidebar from '@/components/Sidebar';

export const VERSION_COOKIE = 'smilify_version';

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

function toGroupData(g: NavGroup): NavGroupData {
  const items = g.pages.map((entry: NavEntry): NavPageData | NavGroupData => {
    if (typeof entry === 'string') {
      const page = getPage(entry);
      return {
        kind: 'page',
        slug: entry,
        title: page?.frontmatter.title ?? entry.split('/').pop() ?? entry,
        icon: page?.frontmatter.icon,
      };
    }
    return toGroupData(entry);
  });
  return { kind: 'group', group: g.group, access: g.access, items };
}

export default async function DocsLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  const config = getConfig();

  const versions = getVersions();
  const cookieVersion = cookies().get(VERSION_COOKIE)?.value;
  const version =
    versions.length > 0
      ? versions.includes(cookieVersion ?? '')
        ? cookieVersion!
        : defaultVersion()
      : undefined;

  const nav: NavTabData[] = getNavigationForRole(user.role, version).map((tab) => ({
    tab: tab.tab,
    groups: tab.groups.map(toGroupData),
  }));

  return (
    <div className="docs-shell">
      <Topbar
        name={config.name}
        nav={nav}
        links={config.navbar?.links ?? []}
        user={user}
        versions={versions}
        version={version}
      />
      <div className="docs-body">
        <Sidebar
          nav={nav}
          anchors={config.navigation.global?.anchors ?? []}
          socials={config.footer?.socials ?? {}}
        />
        <div className="docs-main">{children}</div>
      </div>
    </div>
  );
}
