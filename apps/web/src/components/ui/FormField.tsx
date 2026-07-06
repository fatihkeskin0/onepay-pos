"use client";

import type { ReactNode } from "react";

interface FormFieldProps {
  label?: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}

export function FormField({ label, hint, error, htmlFor, children, className = "" }: FormFieldProps) {
  return (
    <div className={`form-group ${className}`.trim()}>
      {label ? (
        <label className="form-label" htmlFor={htmlFor}>
          {label}
        </label>
      ) : null}
      {children}
      {hint && !error ? <p className="form-hint">{hint}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label className="form-label" htmlFor={htmlFor}>
      {children}
    </label>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="form-hint">{children}</p>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  return <p className="form-error">{children}</p>;
}
