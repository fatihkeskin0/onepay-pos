"use client";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return <div className={`skeleton skeleton-block ${className}`.trim()} aria-hidden />;
}
