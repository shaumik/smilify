'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from './Icon';
import type { NavTabData } from '@/app/(docs)/layout';

export default function Sidebar({
  nav,
  socials,
}: {
  nav: NavTabData[];
  socials: Record<string, string>;
}) {
  const pathname = usePathname();
  const slug = pathname.replace(/^\//, '') || 'introduction';

  let activeTab = nav[0];
  for (const tab of nav) {
    if (tab.groups.some((g) => g.pages.some((p) => p.slug === slug))) {
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
              <ul>
                {group.pages.map((page) => (
                  <li key={page.slug}>
                    <Link
                      href={`/${page.slug}`}
                      onClick={closeMobile}
                      className={page.slug === slug ? 'nav-link active' : 'nav-link'}
                    >
                      {page.icon && <Icon name={page.icon} size={14} className="nav-icon" />}
                      <span>{page.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
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
