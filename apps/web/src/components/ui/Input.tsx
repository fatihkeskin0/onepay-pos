"use client";

import type { InputHTMLAttributes, ReactNode } from "react";

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> {
  prefix?: ReactNode;
  suffix?: ReactNode;
}

export function Input({ className = "", prefix, suffix, ...props }: InputProps) {
  if (prefix || suffix) {
    return (
      <div className="input-affix">
        {prefix ? <span className="input-affix-slot">{prefix}</span> : null}
        <input className={`form-input ${className}`.trim()} {...props} />
        {suffix ? <span className="input-affix-slot">{suffix}</span> : null}
      </div>
    );
  }
  return <input className={`form-input ${className}`.trim()} {...props} />;
}
