"use client";

interface StatusIconProps {
  readonly className?: string;
}

export function ArrowRightIcon({ className = "h-3 w-3" }: StatusIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function ArrowLeftIcon({ className = "h-3 w-3" }: StatusIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  );
}

export function PauseIcon({ className = "h-3 w-3" }: StatusIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path d="M8 5v14M16 5v14" />
    </svg>
  );
}
