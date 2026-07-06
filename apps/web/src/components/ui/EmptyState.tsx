"use client";

interface EmptyStateProps {
  title?: string;
  description?: string;
}

export function EmptyState({ title = "Kayıt yok", description }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <p className="empty-state-title">{title}</p>
      {description ? <p className="empty-state-desc">{description}</p> : null}
    </div>
  );
}
