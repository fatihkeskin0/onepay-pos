"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface PopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  children: ReactNode;
  className?: string;
  align?: "start" | "end";
}

interface PanelCoords {
  top: number;
  left: number;
}

const PANEL_WIDTH = 280;
const VIEWPORT_GAP = 8;

export function Popover({
  open,
  onOpenChange,
  trigger,
  children,
  className = "",
  align = "start",
}: PopoverProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<PanelCoords>({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateCoords = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const panelWidth = panelRef.current?.offsetWidth || PANEL_WIDTH;
    const gap = 8;

    let left = align === "end" ? rect.right - panelWidth : rect.left;
    left = Math.max(VIEWPORT_GAP, Math.min(left, window.innerWidth - panelWidth - VIEWPORT_GAP));

    setCoords({
      top: rect.bottom + gap,
      left,
    });
  }, [align]);

  useEffect(() => {
    if (!open) return;
    updateCoords();
    const raf = requestAnimationFrame(updateCoords);
    window.addEventListener("resize", updateCoords);
    window.addEventListener("scroll", updateCoords, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", updateCoords);
      window.removeEventListener("scroll", updateCoords, true);
    };
  }, [open, updateCoords]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (anchorRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      onOpenChange(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, onOpenChange]);

  const panel =
    open && mounted ? (
      <div
        ref={panelRef}
        className={`popover popover--portal popover--${align} ${className}`.trim()}
        style={{ top: coords.top, left: coords.left }}
      >
        {children}
      </div>
    ) : null;

  return (
    <>
      <div className="popover-anchor" ref={anchorRef}>
        <div className="popover-anchor__trigger" onClick={() => onOpenChange(!open)}>
          {trigger}
        </div>
      </div>
      {mounted && panel ? createPortal(panel, document.body) : null}
    </>
  );
}
