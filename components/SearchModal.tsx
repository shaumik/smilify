'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from './Icon';

interface Result {
  slug: string;
  title: string;
  description: string;
  group: string;
  tab: string;
  snippet: string;
}

export default function SearchModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results ?? []);
          setSelected(0);
        }
      } finally {
        setLoading(false);
      }
    }, 120);
    return () => clearTimeout(t);
  }, [query]);

  function go(slug: string) {
    onClose();
    router.push(`/${slug}`);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === 'Enter' && results[selected]) {
      go(results[selected].slug);
    }
  }

  return (
    <div className="search-overlay" onClick={onClose}>
      <div className="search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="search-input-row">
          <Icon name="search" size={16} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search documentation…"
          />
          <kbd onClick={onClose}>esc</kbd>
        </div>
        <div className="search-results">
          {loading && results.length === 0 && <div className="search-empty">Searching…</div>}
          {!loading && query.trim() && results.length === 0 && (
            <div className="search-empty">No results for “{query}”</div>
          )}
          {!query.trim() && (
            <div className="search-empty">Type to search across all documentation</div>
          )}
          {results.map((r, i) => (
            <button
              key={r.slug}
              className={i === selected ? 'search-result selected' : 'search-result'}
              onMouseEnter={() => setSelected(i)}
              onClick={() => go(r.slug)}
            >
              <div className="search-result-meta">
                {r.tab} › {r.group}
              </div>
              <div className="search-result-title">{r.title}</div>
              <div className="search-result-snippet">{r.snippet}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
