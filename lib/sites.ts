// Site registry: each connected repo is a docs site. Sites are runtime data
// (data/sites.json, managed from the admin dashboard) — the platform repo
// contains no customer content. The platform's own manual ships as the
// built-in "docs" site so a fresh deployment works with zero connections.
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { installationToken, isAppConfigured } from './github-app';

export const SELF_SLUG = 'docs';

// Slugs that would collide with platform routes.
export const RESERVED_SLUGS = new Set([
  'api', 'login', 'admin', 'llms.txt', 'llms-full.txt', '_next', 'favicon.ico', 'logo.svg',
]);

export interface SiteRecord {
  slug: string;
  name: string;
  /** "owner/repo" for GitHub App repos; a git URL or absolute path in dev. */
  repo: string | null;
  branch: string;
  /** Subdirectory inside the repo holding docs.json (default: repo root). */
  path: string;
  addedAt: string;
  lastSyncAt?: string;
  lastCommit?: string;
  lastError?: string;
}

const SITES_FILE = path.join(process.cwd(), 'data', 'sites.json');
const REPOS_DIR = path.join(process.cwd(), 'data', 'repos');

// Bumped on every sync so per-site caches invalidate.
const versions = new Map<string, number>();

export function siteVersion(slug: string): number {
  return versions.get(slug) ?? 0;
}

function bumpVersion(slug: string) {
  versions.set(slug, siteVersion(slug) + 1);
}

function selfSite(): SiteRecord {
  return {
    slug: SELF_SLUG,
    name: 'Platform docs',
    repo: null,
    branch: 'main',
    path: '',
    addedAt: '',
  };
}

function readRegistry(): SiteRecord[] {
  try {
    return JSON.parse(fs.readFileSync(SITES_FILE, 'utf8')) as SiteRecord[];
  } catch {
    return [];
  }
}

function writeRegistry(sites: SiteRecord[]) {
  fs.mkdirSync(path.dirname(SITES_FILE), { recursive: true });
  fs.writeFileSync(SITES_FILE, JSON.stringify(sites, null, 2) + '\n');
}

export function getSites(): SiteRecord[] {
  return [selfSite(), ...readRegistry()];
}

export function getSite(slug: string): SiteRecord | null {
  return getSites().find((s) => s.slug === slug) ?? null;
}

/** Filesystem root a site's docs.json/content/ are read from. */
export function contentRoot(slug: string): string {
  if (slug === SELF_SLUG) return process.cwd();
  const site = getSite(slug);
  const sub = site?.path ? site.path.replace(/^\/+|\/+$/g, '') : '';
  return path.join(REPOS_DIR, slug, sub);
}

function workspace(slug: string): string {
  return path.join(REPOS_DIR, slug);
}

function git(args: string[], cwd?: string): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    timeout: 120_000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  }).trim();
}

/** Resolve a clone URL, minting a GitHub App installation token when needed. */
async function cloneUrl(site: SiteRecord): Promise<string> {
  const repo = site.repo!;
  const ghMatch = /^([\w.-]+)\/([\w.-]+)$/.exec(repo);
  if (ghMatch) {
    if (!isAppConfigured()) {
      throw new Error(
        'GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY are not set — configure the GitHub App to connect owner/repo sources.'
      );
    }
    const token = await installationToken(ghMatch[1], ghMatch[2]);
    return `https://x-access-token:${token}@github.com/${repo}.git`;
  }
  // Dev/testing escape hatch: full git URL or local path, cloned as-is.
  return repo;
}

/** Clone (first time) or update a connected repo, returning the head commit. */
export async function syncSite(slug: string): Promise<SiteRecord> {
  const registry = readRegistry();
  const site = registry.find((s) => s.slug === slug);
  if (!site) throw new Error(`unknown site: ${slug}`);
  const dir = workspace(slug);
  try {
    const url = await cloneUrl(site);
    if (fs.existsSync(path.join(dir, '.git'))) {
      git(['remote', 'set-url', 'origin', url], dir);
      git(['fetch', '--depth', '1', 'origin', site.branch], dir);
      git(['reset', '--hard', `origin/${site.branch}`], dir);
    } else {
      fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(REPOS_DIR, { recursive: true });
      git(['clone', '--depth', '1', '--branch', site.branch, url, dir]);
    }
    // Never leave a token embedded in .git/config.
    try {
      git(['remote', 'set-url', 'origin', 'invalid://synced-via-platform'], dir);
    } catch {}
    site.lastCommit = git(['rev-parse', 'HEAD'], dir);
    site.lastSyncAt = new Date().toISOString();
    site.lastError = undefined;
  } catch (e) {
    site.lastError = e instanceof Error ? e.message : String(e);
    site.lastSyncAt = new Date().toISOString();
    writeRegistry(registry);
    throw e;
  }
  if (!fs.existsSync(path.join(contentRoot(slug), 'docs.json'))) {
    site.lastError = `No docs.json found at ${site.path || 'repo root'} on branch ${site.branch}.`;
    writeRegistry(registry);
    throw new Error(site.lastError);
  }
  writeRegistry(registry);
  bumpVersion(slug);
  return site;
}

export async function addSite(input: {
  slug: string;
  name: string;
  repo: string;
  branch?: string;
  path?: string;
}): Promise<SiteRecord> {
  const slug = input.slug.toLowerCase().trim();
  if (!/^[a-z0-9][a-z0-9-]{0,40}$/.test(slug)) {
    throw new Error('Slug must be lowercase letters, digits, and dashes.');
  }
  if (RESERVED_SLUGS.has(slug) || slug === SELF_SLUG || getSite(slug)) {
    throw new Error(`Slug "${slug}" is reserved or already in use.`);
  }
  const registry = readRegistry();
  registry.push({
    slug,
    name: input.name.trim() || slug,
    repo: input.repo.trim(),
    branch: (input.branch ?? 'main').trim() || 'main',
    path: (input.path ?? '').trim(),
    addedAt: new Date().toISOString(),
  });
  writeRegistry(registry);
  try {
    return await syncSite(slug);
  } catch (e) {
    // Keep the record (with lastError) so the admin can fix and re-sync.
    throw e;
  }
}

export function removeSite(slug: string) {
  if (slug === SELF_SLUG) throw new Error('The platform docs site cannot be removed.');
  writeRegistry(readRegistry().filter((s) => s.slug !== slug));
  fs.rmSync(workspace(slug), { recursive: true, force: true });
  bumpVersion(slug);
}

/** Match a webhook push (repo full name + branch) to connected sites. */
export function sitesForRepoPush(fullName: string, branch: string): SiteRecord[] {
  return readRegistry().filter(
    (s) => s.repo?.toLowerCase() === fullName.toLowerCase() && s.branch === branch
  );
}
