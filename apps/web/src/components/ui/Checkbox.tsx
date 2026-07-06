"use client";

import type { InputHTMLAttributes } from "react";

export function Checkbox({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="form-check">
      <input type="checkbox" className={className} {...props} />
    </label>
  );
}
