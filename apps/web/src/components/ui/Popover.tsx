"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface PopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  children: ReactNode;
  className?: string;
  align?: "start" | "end";
}

export function Popover({ open, onOpenChange, trigger, children, className = "", align = "start" }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, onOpenChange]);

  return (
    <div className="popover-anchor" ref={ref}>
      <div onClick={() => onOpenChange(!open)}>{trigger}</div>
      {open ? (
        <div className={`popover popover--${align} ${className}`.trim()}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
