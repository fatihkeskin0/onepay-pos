"use client";

interface AuthAlertProps {
  message: string;
}

export function AuthAlert({ message }: AuthAlertProps) {
  return (
    <div className="auth-alert" role="alert" aria-live="polite">
      <span className="auth-alert-icon" aria-hidden>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
        </svg>
      </span>
      <p className="auth-alert-text">{message}</p>
    </div>
  );
}
