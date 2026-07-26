'use client';

import { useState } from 'react';
import Icon from './Icon';

export default function Feedback({ slug }: { slug: string }) {
  const [sent, setSent] = useState(false);

  async function send(helpful: boolean) {
    setSent(true);
    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug, helpful }),
    }).catch(() => {});
  }

  return (
    <div className="feedback">
      {sent ? (
        <span className="feedback-thanks">Thanks for the feedback!</span>
      ) : (
        <>
          <span>Was this page helpful?</span>
          <button onClick={() => send(true)} aria-label="Yes">
            <Icon name="thumbs-up" size={14} />
          </button>
          <button onClick={() => send(false)} aria-label="No">
            <Icon name="thumbs-down" size={14} />
          </button>
        </>
      )}
    </div>
  );
}
