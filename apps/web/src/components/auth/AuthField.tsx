"use client";

import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";

type AuthFieldType = "text" | "password" | "otp";

interface AuthFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "prefix"> {
  label: string;
  hint?: string;
  fieldType?: AuthFieldType;
  icon?: ReactNode;
}

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M20 21a8 8 0 0 0-16 0" strokeLinecap="round" />
      <circle cx="12" cy="8" r="4" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M12 3l8 4v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V7l8-4z" strokeLinejoin="round" />
    </svg>
  );
}

function defaultIcon(fieldType: AuthFieldType): ReactNode {
  if (fieldType === "password") return <LockIcon />;
  if (fieldType === "otp") return <ShieldIcon />;
  return <UserIcon />;
}

export function AuthField({
  label,
  hint,
  fieldType = "text",
  icon,
  className = "",
  id: idProp,
  ...props
}: AuthFieldProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = fieldType === "password";
  const inputType = isPassword ? (showPassword ? "text" : "password") : fieldType === "otp" ? "text" : "text";

  return (
    <div className={`auth-field ${className}`.trim()}>
      <label className="auth-field-label" htmlFor={id}>
        {label}
      </label>
      <div className={`auth-field-control ${fieldType === "otp" ? "auth-field-control--otp" : ""}`.trim()}>
        <span className="auth-field-icon" aria-hidden>
          {icon ?? defaultIcon(fieldType)}
        </span>
        <input
          id={id}
          type={inputType}
          className="auth-field-input"
          autoComplete={props.autoComplete}
          {...props}
        />
        {isPassword ? (
          <button
            type="button"
            className="auth-field-toggle"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
            tabIndex={-1}
          >
            {showPassword ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M3 3l18 18" strokeLinecap="round" />
                <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A10.9 10.9 0 0 1 12 5c7 0 10 7 10 7a18.8 18.8 0 0 1-4.1 5.2M6.1 6.1A18.8 18.8 0 0 0 2 12s3 7 10 7a10.9 10.9 0 0 0 2.1-.2" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" strokeLinejoin="round" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        ) : null}
      </div>
      {hint ? <p className="auth-field-hint">{hint}</p> : null}
    </div>
  );
}
