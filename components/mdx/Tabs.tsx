'use client';

import { Children, isValidElement, useState } from 'react';

export function Tab({ title, children }: { title: string; children: React.ReactNode }) {
  return <div data-tab-title={title}>{children}</div>;
}

export function Tabs({ children }: { children: React.ReactNode }) {
  const items = Children.toArray(children).filter(isValidElement) as React.ReactElement[];
  const [active, setActive] = useState(0);
  return (
    <div className="tabs">
      <div className="tabs-bar" role="tablist">
        {items.map((item, i) => (
          <button
            key={i}
            role="tab"
            aria-selected={i === active}
            className={i === active ? 'tab-btn active' : 'tab-btn'}
            onClick={() => setActive(i)}
          >
            {item.props.title ?? `Tab ${i + 1}`}
          </button>
        ))}
      </div>
      <div className="tabs-panel">{items[active]}</div>
    </div>
  );
}
