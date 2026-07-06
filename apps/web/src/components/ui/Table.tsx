"use client";

import type { ReactNode } from "react";

interface TableProps {
  children: ReactNode;
  className?: string;
  flush?: boolean;
}

export function Table({ children, className = "", flush }: TableProps) {
  const wrapClass = ["table-wrap", flush ? "dash-table-wrap" : "", className].filter(Boolean).join(" ");
  return (
    <div className={wrapClass}>
      <table>{children}</table>
    </div>
  );
}

export function TableEmpty({ colSpan, message = "Kayıt yok" }: { colSpan: number; message?: string }) {
  return (
    <tr className="table-empty">
      <td colSpan={colSpan}>{message}</td>
    </tr>
  );
}

export function TableLoading({ colSpan, message = "Yükleniyor..." }: { colSpan: number; message?: string }) {
  return (
    <tr className="table-loading">
      <td colSpan={colSpan}>{message}</td>
    </tr>
  );
}
