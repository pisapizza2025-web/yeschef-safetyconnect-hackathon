'use client';
import { useState, type ReactNode } from 'react';

export type Tone = 'red' | 'green' | 'amber' | 'blue' | 'grey';

export function Chip({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`chip ${tone}`}>{children}</span>;
}

/** Explanatory text lives in this popover, not in the page. */
export function Info({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className={`info ${open ? 'open' : ''}`}>
      <button type="button" aria-label="More information" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        i
      </button>
      <span className="pop" role="tooltip">
        {text}
      </span>
    </span>
  );
}

/** Lists show 5 rows, expand in place to about 10, then scroll inside the panel. */
export function ExpandList({ children, empty }: { children: ReactNode[]; empty: string }) {
  const [open, setOpen] = useState(false);
  const items = children;
  if (!items.length) return <div className="empty">{empty}</div>;
  const shown = open ? items : items.slice(0, 5);
  return (
    <div>
      <div className={`list ${open && items.length > 10 ? 'scroll' : ''}`}>{shown}</div>
      {items.length > 5 && (
        <button type="button" className="btn ghost small" style={{ marginTop: 8 }} onClick={() => setOpen((o) => !o)}>
          {open ? 'Show less' : `Show more (${items.length})`}
        </button>
      )}
    </div>
  );
}
