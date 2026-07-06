"use client";

import type { ButtonHTMLAttributes } from "react";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: "md" | "sm";
}

export function IconButton({ label, size = "md", className = "", children, ...props }: IconButtonProps) {
  const classes = ["btn", "btn-ghost", "btn-icon", size === "sm" ? "btn-sm" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <button type="button" className={classes} aria-label={label} {...props}>
      {children}
    </button>
  );
}
