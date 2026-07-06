"use client";

import type { ReactNode } from "react";

type BadgeVariant =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled"
  | "green"
  | "red"
  | "yellow"
  | "blue"
  | "gray";

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

export function Badge({ variant = "gray", children, className = "" }: BadgeProps) {
  return <span className={`badge badge-${variant} ${className}`.trim()}>{children}</span>;
}
