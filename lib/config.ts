import fs from 'fs';
import path from 'path';

/** A group's pages can be plain slugs or nested sub-groups (recursive). */
export type NavEntry = string | NavGroup;

export interface NavGroup {
  group: string;
  pages: NavEntry[];
  access?: 'admin';
  version?: string;
  icon?: string;
}

export interface NavTab {
  tab: string;
  groups: NavGroup[];
}

export interface NavAnchor {
  anchor: string;
  href: string;
  icon?: string;
}

export interface DocsConfig {
  name: string;
  description?: string;
  colors: { primary: string; light?: string; dark?: string };
  navigation: {
    versions?: string[];
    global?: { anchors?: NavAnchor[] };
    tabs: NavTab[];
  };
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

export function getVersions(): string[] {
  return getConfig().navigation.versions ?? [];
}

export function defaultVersion(): string | undefined {
  return getVersions()[0];
}

function isGroup(entry: NavEntry): entry is NavGroup {
  return typeof entry !== 'string';
}

/** A group is visible if the role may see it and it matches the version (unversioned = all). */
function groupVisible(g: NavGroup, role: Role, version?: string): boolean {
  if (g.access && g.access !== role) return false;
  if (version && g.version && g.version !== version) return false;
  return true;
}

function filterGroup(g: NavGroup, role: Role, version?: string): NavGroup | null {
  if (!groupVisible(g, role, version)) return null;
  const pages: NavEntry[] = [];
  for (const entry of g.pages) {
    if (isGroup(entry)) {
      const sub = filterGroup(entry, role, version);
      if (sub && sub.pages.length > 0) pages.push(sub);
    } else {
      pages.push(entry);
    }
  }
  return { ...g, pages };
}

/**
 * Navigation filtered to what the role may see, optionally scoped to a
 * version. Pass no version to include every version (search, llms, pager).
 */
export function getNavigationForRole(role: Role, version?: string): NavTab[] {
  const { navigation } = getConfig();
  return navigation.tabs
    .map((tab) => ({
      ...tab,
      groups: tab.groups
        .map((g) => filterGroup(g, role, version))
        .filter((g): g is NavGroup => g !== null && g.pages.length > 0),
    }))
    .filter((tab) => tab.groups.length > 0);
}

export interface OrderedPage {
  slug: string;
  group: string;
  tab: string;
}

function collectPages(g: NavGroup, tab: string, out: OrderedPage[]) {
  for (const entry of g.pages) {
    if (isGroup(entry)) collectPages(entry, tab, out);
    else out.push({ slug: entry, group: g.group, tab });
  }
}

/** All page slugs visible to a role (and optional version), in nav order. */
export function getOrderedPages(role: Role, version?: string): OrderedPage[] {
  const out: OrderedPage[] = [];
  for (const tab of getNavigationForRole(role, version)) {
    for (const group of tab.groups) collectPages(group, tab.tab, out);
  }
  return out;
}

function findAccess(g: NavGroup, slug: string, inherited?: 'admin'): 'admin' | 'any' | null {
  const access = g.access ?? inherited;
  for (const entry of g.pages) {
    if (isGroup(entry)) {
      const found = findAccess(entry, slug, access);
      if (found) return found;
    } else if (entry === slug) {
      return access ?? 'any';
    }
  }
  return null;
}

/** Whether a role may view a slug. Access is inherited from ancestor groups. */
export function canAccessPage(slug: string, role: Role): boolean {
  for (const tab of getConfig().navigation.tabs) {
    for (const group of tab.groups) {
      const found = findAccess(group, slug);
      if (found) return found === 'any' || found === role;
    }
  }
  // Pages not listed in navigation are viewable by anyone authenticated.
  return true;
}
