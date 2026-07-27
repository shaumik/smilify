'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from './Icon';
import type { NavGroupData, NavPageData, NavTabData } from '@/app/(docs)/layout';
import type { NavAnchor } from '@/lib/config';

function containsSlug(items: (NavPageData | NavGroupData)[], slug: string): boolean {
  return items.some((item) =>
    item.kind === 'page' ? item.slug === slug : containsSlug(item.items, slug)
  );
}

function NavItems({
  items,
  slug,
  onNavigate,
}: {
  items: (NavPageData | NavGroupData)[];
  slug: string;
  onNavigate: () => void;
}) {
  return (
    <ul>
      {items.map((item) =>
        item.kind === 'page' ? (
          <li key={item.slug}>
            <Link
              href={`/${item.slug}`}
              onClick={onNavigate}
              className={item.slug === slug ? 'nav-link active' : 'nav-link'}
            >
              {item.icon && <Icon name={item.icon} size={14} className="nav-icon" />}
              <span>{item.title}</span>
            </Link>
          </li>
        ) : (
          <li key={item.group}>
            <details className="nav-subgroup" open={containsSlug(item.items, slug) || undefined}>
              <summary>
                <Icon name="chevron-right" size={12} className="accordion-chevron" />
                {item.group}
              </summary>
              <div className="nav-subgroup-items">
                <NavItems items={item.items} slug={slug} onNavigate={onNavigate} />
              </div>
            </details>
          </li>
        )
      )}
    </ul>
  );
}

export default function Sidebar({
  nav,
  anchors,
  socials,
}: {
  nav: NavTabData[];
  anchors: NavAnchor[];
  socials: Record<string, string>;
}) {
  const pathname = usePathname();
  const slug = pathname.replace(/^\//, '') || 'introduction';

  let activeTab = nav[0];
  for (const tab of nav) {
    if (tab.groups.some((g) => containsSlug(g.items, slug))) {
      activeTab = tab;
      break;
    }
  }

  function closeMobile() {
    delete document.body.dataset.sidebarOpen;
  }

  return (
    <>
      <div className="sidebar-backdrop" onClick={closeMobile} />
      <aside className="sidebar">
        {anchors.length > 0 && (
          <div className="sidebar-anchors">
            {anchors.map((a) => {
              const external = /^https?:\/\//.test(a.href);
              return (
                <a
                  key={a.anchor}
                  href={a.href}
                  target={external ? '_blank' : undefined}
                  rel={external ? 'noreferrer' : undefined}
                  className="sidebar-anchor"
                >
                  <span className="sidebar-anchor-icon">
                    {a.icon && <Icon name={a.icon} size={13} />}
                  </span>
                  {a.anchor}
                </a>
              );
            })}
          </div>
        )}
        <nav className="sidebar-nav">
          {activeTab?.groups.map((group) => (
            <div key={group.group} className="nav-group">
              <div className="nav-group-title">
                {group.group}
                {group.access === 'admin' && (
                  <span className="nav-lock" title="Admin only">
                    <Icon name="shield" size={11} />
                  </span>
                )}
              </div>
              <NavItems items={group.items} slug={slug} onNavigate={closeMobile} />
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          {Object.entries(socials).map(([kind, href]) => (
            <a key={kind} href={href} target="_blank" rel="noreferrer" aria-label={kind}>
              <Icon name={kind} size={16} />
            </a>
          ))}
        </div>
      </aside>
    </>
  );
}
