import fs from 'fs';
import path from 'path';

export interface NavGroup {
  group: string;
  pages: string[];
  access?: 'admin';
  icon?: string;
}

export interface NavTab {
  tab: string;
  groups: NavGroup[];
}

export interface DocsConfig {
  name: string;
  description?: string;
  colors: { primary: string; light?: string; dark?: string };
  navigation: { tabs: NavTab[] };
  navbar?: { links?: { label: string; href: string }[] };
  footer?: { socials?: Record<string, string> };
  api?: { openapi?: string; playground?: { display?: string } };
  feedback?: { thumbsRating?: boolean };
}

let cached: DocsConfig | null = null;

export function getConfig(): DocsConfig {
  if (cached && process.env.NODE_ENV === 'production') return cached;
  const raw = fs.readFileSync(path.join(process.cwd(), 'docs.json'), 'utf8');
  cached = JSON.parse(raw) as DocsConfig;
  return cached;
}

export type Role = 'admin' | 'member';

/** Navigation filtered down to what the given role is allowed to see. */
export function getNavigationForRole(role: Role): NavTab[] {
  const { navigation } = getConfig();
  return navigation.tabs
    .map((tab) => ({
      ...tab,
      groups: tab.groups.filter((g) => !g.access || g.access === role),
    }))
    .filter((tab) => tab.groups.length > 0);
}

/** All page slugs visible to a role, in navigation order. */
export function getOrderedPages(role: Role): { slug: string; group: string; tab: string }[] {
  const out: { slug: string; group: string; tab: string }[] = [];
  for (const tab of getNavigationForRole(role)) {
    for (const group of tab.groups) {
      for (const slug of group.pages) {
        out.push({ slug, group: group.group, tab: tab.tab });
      }
    }
  }
  return out;
}

/** Whether a slug exists in navigation, and if the role may view it. */
export function canAccessPage(slug: string, role: Role): boolean {
  for (const tab of getConfig().navigation.tabs) {
    for (const group of tab.groups) {
      if (group.pages.includes(slug)) {
        return !group.access || group.access === role;
      }
    }
  }
  // Pages not listed in navigation are viewable by anyone authenticated.
  return true;
}
