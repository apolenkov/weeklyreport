import { Skeleton } from '@customreport/ui';

/**
 * Page title skeleton: matches 2xl heading typography.
 */
export function PageTitleSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-40" />
    </div>
  );
}

/**
 * Table skeleton: header row + data rows with shimmer.
 */
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="w-full space-y-3">
      <div className="flex gap-4">
        <Skeleton className="h-5 w-[25%]" />
        <Skeleton className="h-5 w-[25%]" />
        <Skeleton className="h-5 w-[25%]" />
        <Skeleton className="h-5 w-[25%]" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex gap-4">
          <Skeleton className="h-5 w-[25%]" />
          <Skeleton className="h-5 w-[25%]" />
          <Skeleton className="h-5 w-[25%]" />
          <Skeleton className="h-5 w-[25%]" />
        </div>
      ))}
    </div>
  );
}

/**
 * Card skeleton with optional height. Matches rounded-xl card design.
 */
export function CardSkeleton({ className }: { className?: string }) {
  return <Skeleton className={`h-32 w-full rounded-xl ${className ?? ''}`} />;
}

/**
 * Stat card skeleton: icon circle + text block, matching admin stat cards.
 */
export function StatCardSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-xl border bg-card p-6">
      <Skeleton className="h-12 w-12 shrink-0 rounded-xl" />
      <div className="space-y-2">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-3.5 w-24" />
      </div>
    </div>
  );
}

/**
 * Badge skeleton: small rounded pill.
 */
export function BadgeSkeleton() {
  return <Skeleton className="h-6 w-16 rounded-full" />;
}

/**
 * Avatar skeleton: circle matching Avatar component size.
 */
export function AvatarSkeleton() {
  return <Skeleton className="size-10 rounded-full" />;
}

/**
 * Form field skeleton: label + input.
 */
export function FormFieldSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-3.5 w-20" />
      <Skeleton className="h-10 w-full rounded-lg" />
    </div>
  );
}

/**
 * Section card skeleton: icon header + content area, matching report form cards.
 */
export function SectionCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center gap-3 border-b p-6">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3.5 w-48" />
        </div>
      </div>
      <div className="space-y-3 p-6">
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-[80%] rounded-lg" />
      </div>
    </div>
  );
}
