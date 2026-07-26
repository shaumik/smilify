'use client';

import { Children, isValidElement, useState } from 'react';

// Renders multiple fenced code blocks as a tabbed group, using each
// block's ```lang title="..." as the tab label (Mintlify <CodeGroup>).
function findTitle(node: React.ReactNode, fallback: string): string {
  if (!isValidElement(node)) return fallback;
  const props = node.props as Record<string, any>;
  if (props['data-rehype-pretty-code-title'] !== undefined && typeof props.children === 'string') {
    return props.children;
  }
  const kids = Children.toArray(props.children);
  for (const kid of kids) {
    const found = findTitle(kid, '');
    if (found) return found;
  }
  return fallback;
}

export default function CodeGroup({ children }: { children: React.ReactNode }) {
  const items = Children.toArray(children).filter(isValidElement) as React.ReactElement[];
  const [active, setActive] = useState(0);
  return (
    <div className="code-group">
      <div className="tabs-bar" role="tablist">
        {items.map((item, i) => (
          <button
            key={i}
            role="tab"
            aria-selected={i === active}
            className={i === active ? 'tab-btn active' : 'tab-btn'}
            onClick={() => setActive(i)}
          >
            {findTitle(item, `Tab ${i + 1}`)}
          </button>
        ))}
      </div>
      {items.map((item, i) => (
        <div key={i} className="code-group-panel" hidden={i !== active}>
          {item}
        </div>
      ))}
    </div>
  );
}
