'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Icon from './Icon';

interface Source {
  slug: string;
  title: string;
}

// Render [slug] citations as links to the cited page.
function renderAnswer(site: string, answer: string, onNavigate: () => void) {
  const parts = answer.split(/\[([a-z0-9-]+(?:\/[a-z0-9-]+)*)\]/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <Link key={i} href={`/${site}/${part}`} className="ask-citation" onClick={onNavigate}>
        {part.split('/').pop()}
      </Link>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export default function AskAI({ site, onClose }: { site: string; onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    fetch('/api/assistant')
      .then((r) => r.json())
      .then((d) => setConfigured(!!d.configured))
      .catch(() => setConfigured(false));
  }, []);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || busy) return;
    setBusy(true);
    setError(null);
    setAnswer(null);
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question, site }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.error === 'not_configured'
            ? 'The assistant needs ANTHROPIC_API_KEY configured on the server.'
            : 'The assistant hit an error. Try again.'
        );
        return;
      }
      setAnswer(data.answer);
      setSources(data.sources ?? []);
    } catch {
      setError('The assistant hit an error. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="search-overlay" onClick={onClose}>
      <div className="search-modal ask-modal" onClick={(e) => e.stopPropagation()}>
        <form className="search-input-row" onSubmit={ask}>
          <Icon name="sparkles" size={16} />
          <input
            ref={inputRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question about the docs…"
          />
          <kbd onClick={onClose}>esc</kbd>
        </form>
        <div className="ask-body">
          {configured === false && (
            <div className="search-empty">
              The AI assistant isn&apos;t configured on this deployment — set
              <code> ANTHROPIC_API_KEY</code> to enable it.
            </div>
          )}
          {configured !== false && !answer && !busy && !error && (
            <div className="search-empty">
              Answers are grounded in the docs you can access, with citations.
            </div>
          )}
          {busy && <div className="search-empty">Thinking…</div>}
          {error && <div className="search-empty">{error}</div>}
          {answer && (
            <div className="ask-answer">
              <p>{renderAnswer(site, answer, onClose)}</p>
              {sources.length > 0 && (
                <div className="ask-sources">
                  <span>Sources</span>
                  {sources.map((s) => (
                    <Link key={s.slug} href={`/${site}/${s.slug}`} onClick={onClose}>
                      {s.title}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
