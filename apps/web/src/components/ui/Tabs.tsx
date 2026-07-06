"use client";

import type { ReactNode } from "react";

interface TabItem {
  id: string;
  label: ReactNode;
  count?: number;
  variant?: string;
}

interface TabsProps {
  items: TabItem[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}

export function Tabs({ items, active, onChange, className = "" }: TabsProps) {
  return (
    <div className={`ui-tabs ${className}`.trim()} role="tablist">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={active === item.id}
          className={`ui-tab ${item.variant ? `ftab-${item.variant}` : ""} ${active === item.id ? "active" : ""}`}
          onClick={() => onChange(item.id)}
        >
          {item.label}
          {item.count !== undefined ? <span className="ftab-cnt">{item.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
