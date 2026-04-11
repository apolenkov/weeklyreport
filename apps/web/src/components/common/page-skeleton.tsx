import { Skeleton } from '@customreport/ui';

/**
 * Page title skeleton: single rectangle matching Display typography (28px height).
 */
export function PageTitleSkeleton() {
  return <Skeleton className="h-7 w-60" />;
}

/**
 * Table skeleton: header row + 5 data rows, each with 4 cell placeholders.
 */
export function TableSkeleton() {
  return (
    <div className="w-full space-y-3">
      {/* Header row */}
      <div className="flex gap-4">
        <Skeleton className="h-5 w-[25%]" />
        <Skeleton className="h-5 w-[25%]" />
        <Skeleton className="h-5 w-[25%]" />
        <Skeleton className="h-5 w-[25%]" />
      </div>
      {/* Data rows */}
      {Array.from({ length: 5 }, (_, i) => (
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
 * Card skeleton: rounded rectangle matching typical card height.
 */
export function CardSkeleton() {
  return <Skeleton className="h-40 w-full rounded-lg" />;
}

/**
 * Badge skeleton: small rounded rectangle for status badges.
 */
export function BadgeSkeleton() {
  return <Skeleton className="h-6 w-16 rounded-full" />;
}

/**
 * Avatar skeleton: circle matching Avatar component size (32px).
 */
export function AvatarSkeleton() {
  return <Skeleton className="size-8 rounded-full" />;
}

/**
 * Form field skeleton: label placeholder + input placeholder.
 */
export function FormFieldSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-3.5 w-20" />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}

/**
 * Paragraph skeleton: 3 stacked lines simulating text content.
 */
export function ParagraphSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-3.5 w-full" />
      <Skeleton className="h-3.5 w-[90%]" />
      <Skeleton className="h-3.5 w-[60%]" />
    </div>
  );
}

/**
 * Button skeleton: rounded rectangle matching Button dimensions.
 */
export function ButtonSkeleton() {
  return <Skeleton className="h-9 w-30 rounded-md" />;
}
