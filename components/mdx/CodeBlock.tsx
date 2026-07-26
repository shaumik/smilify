'use client';

import { useRef, useState } from 'react';
import Icon from '../Icon';

/** Wraps MDX <pre> blocks with a copy-to-clipboard button. */
export default function CodeBlock(props: React.HTMLAttributes<HTMLPreElement>) {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  async function copy() {
    const text = preRef.current?.textContent ?? '';
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API unavailable (e.g. non-HTTPS) — fall back silently.
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="code-block">
      <button className="copy-btn" onClick={copy} aria-label="Copy code">
        <Icon name={copied ? 'check' : 'copy'} size={14} />
      </button>
      <pre ref={preRef} {...props} />
    </div>
  );
}
