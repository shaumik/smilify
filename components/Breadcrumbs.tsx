import { getConfig } from '@/lib/config';

export default function Breadcrumbs({ slug }: { slug: string }) {
  const { navigation } = getConfig();
  let trail: string[] = [];
  for (const tab of navigation.tabs) {
    for (const group of tab.groups) {
      if (group.pages.includes(slug)) {
        trail = navigation.tabs.length > 1 ? [tab.tab, group.group] : [group.group];
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
