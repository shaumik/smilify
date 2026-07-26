'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Icon from './Icon';
import ThemeToggle from './ThemeToggle';
import SearchModal from './SearchModal';
import type { NavTabData } from '@/app/(docs)/layout';

interface User {
  email: string;
  name: string;
  role: string;
}

function activeTabOf(nav: NavTabData[], pathname: string): string {
  const slug = pathname.replace(/^\//, '') || 'introduction';
  for (const tab of nav) {
    for (const g of tab.groups) {
      if (g.pages.some((p) => p.slug === slug)) return tab.tab;
    }
  }
  return nav[0]?.tab ?? '';
}

export default function Topbar({
  name,
  nav,
  links,
  user,
}: {
  name: string;
  nav: NavTabData[];
  links: { label: string; href: string }[];
  user: User;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const activeTab = activeTabOf(nav, pathname);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
      if (e.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function toggleSidebar() {
    const body = document.body;
    if (body.dataset.sidebarOpen) delete body.dataset.sidebarOpen;
    else body.dataset.sidebarOpen = 'true';
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="topbar">
      <div className="topbar-row">
        <button className="mobile-menu-btn" onClick={toggleSidebar} aria-label="Toggle navigation">
          <Icon name="menu" size={20} />
        </button>
        <Link href="/" className="topbar-brand">
          <img src="/logo.svg" alt="" width={26} height={26} />
          <span>{name}</span>
        </Link>
        <button className="search-trigger" onClick={() => setSearchOpen(true)}>
          <Icon name="search" size={14} />
          <span>Search or ask…</span>
          <kbd>⌘K</kbd>
        </button>
        <nav className="topbar-links">
          {links.map((l) => (
            <a key={l.href} href={l.href} target="_blank" rel="noreferrer">
              {l.label}
            </a>
          ))}
        </nav>
        <ThemeToggle />
        <div className="user-menu">
          <button className="user-chip" onClick={() => setMenuOpen((v) => !v)}>
            <span className="user-avatar">{user.name.charAt(0)}</span>
          </button>
          {menuOpen && (
            <div className="user-dropdown" onMouseLeave={() => setMenuOpen(false)}>
              <div className="user-dropdown-info">
                <strong>{user.name}</strong>
                <span>{user.email}</span>
                <span className={`role-badge role-${user.role}`}>{user.role}</span>
              </div>
              <button onClick={logout}>
                <Icon name="logout" size={14} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="topbar-tabs">
        {nav.map((tab) => {
          const first = tab.groups[0]?.pages[0]?.slug ?? '';
          return (
            <Link
              key={tab.tab}
              href={`/${first}`}
              className={tab.tab === activeTab ? 'tab-link active' : 'tab-link'}
            >
              {tab.tab}
            </Link>
          );
        })}
      </div>
      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
    </header>
  );
}
