import { getConfig, NavEntry, NavGroup } from '@/lib/config';

function findTrail(g: NavGroup, slug: string, parents: string[]): string[] | null {
  const here = [...parents, g.group];
  for (const entry of g.pages) {
    if (typeof entry === 'string') {
      if (entry === slug) return here;
    } else {
      const found = findTrail(entry, slug, here);
      if (found) return found;
    }
  }
  return null;
}

export default function Breadcrumbs({ slug }: { slug: string }) {
  const { navigation } = getConfig();
  let trail: string[] = [];
  for (const tab of navigation.tabs) {
    for (const group of tab.groups) {
      const found = findTrail(group, slug, []);
      if (found) {
        trail = navigation.tabs.length > 1 ? [tab.tab, ...found] : found;
      }
    }
  }
  if (trail.length === 0) return null;
  return (
    <div className="breadcrumbs">
      {trail.map((part, i) => (
        <span key={i}>
          {i > 0 && <span className="breadcrumb-sep">›</span>}
          {part}
        </span>
      ))}
    </div>
  );
}
