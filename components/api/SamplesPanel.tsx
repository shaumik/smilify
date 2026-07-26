'use client';

import { useState } from 'react';
import Icon from '../Icon';

export default function SamplesPanel({
  samples,
}: {
  samples: { label: string; code: string }[];
}) {
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(samples[active].code);
    } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="panel">
      <div className="tabs-bar panel-tabs">
        {samples.map((s, i) => (
          <button
            key={s.label}
            className={i === active ? 'tab-btn active' : 'tab-btn'}
            onClick={() => setActive(i)}
          >
            {s.label}
          </button>
        ))}
        <button className="copy-btn static" onClick={copy} aria-label="Copy sample">
          <Icon name={copied ? 'check' : 'copy'} size={13} />
        </button>
      </div>
      <pre className="panel-pre">{samples[active].code}</pre>
    </div>
  );
}
