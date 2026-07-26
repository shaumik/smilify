'use client';

import { useEffect, useState } from 'react';
import type { TocEntry } from '@/lib/content';

export default function Toc({ entries }: { entries: TocEntry[] }) {
  const [active, setActive] = useState<string>('');

  useEffect(() => {
    if (entries.length === 0) return;
    const observer = new IntersectionObserver(
      (observed) => {
        for (const entry of observed) {
          if (entry.isIntersecting) {
            setActive(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: '-80px 0px -70% 0px' }
    );
    for (const { id } of entries) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [entries]);

  if (entries.length === 0) return <aside className="toc" />;

  return (
    <aside className="toc">
      <div className="toc-title">On this page</div>
      <ul>
        {entries.map((e) => (
          <li key={e.id} className={`toc-depth-${e.depth}`}>
            <a href={`#${e.id}`} className={active === e.id ? 'active' : ''}>
              {e.text}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
