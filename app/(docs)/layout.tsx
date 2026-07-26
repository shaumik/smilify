import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { getConfig, getNavigationForRole } from '@/lib/config';
import { getPage } from '@/lib/content';
import Topbar from '@/components/Topbar';
import Sidebar from '@/components/Sidebar';

export interface NavPageData {
  slug: string;
  title: string;
  icon?: string;
}

export interface NavGroupData {
  group: string;
  access?: string;
  pages: NavPageData[];
}

export interface NavTabData {
  tab: string;
  groups: NavGroupData[];
}

export default async function DocsLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  const config = getConfig();

  const nav: NavTabData[] = getNavigationForRole(user.role).map((tab) => ({
    tab: tab.tab,
    groups: tab.groups.map((g) => ({
      group: g.group,
      access: g.access,
      pages: g.pages.map((slug) => {
        const page = getPage(slug);
        return {
          slug,
          title: page?.frontmatter.title ?? slug.split('/').pop() ?? slug,
          icon: page?.frontmatter.icon,
        };
      }),
    })),
  }));

  return (
    <div className="docs-shell">
      <Topbar
        name={config.name}
        nav={nav}
        links={config.navbar?.links ?? []}
        user={user}
      />
      <div className="docs-body">
        <Sidebar nav={nav} socials={config.footer?.socials ?? {}} />
        <div className="docs-main">{children}</div>
      </div>
    </div>
  );
}
