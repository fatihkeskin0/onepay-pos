"use client";

interface SpinnerProps {
  size?: "md" | "lg";
  className?: string;
}

export function Spinner({ size = "md", className = "" }: SpinnerProps) {
  return (
    <div
      className={`spinner ${size === "lg" ? "spinner-lg" : ""} ${className}`.trim()}
      role="status"
      aria-label="Yükleniyor"
    />
  );
}
