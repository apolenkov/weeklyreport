import { cn } from "@customreport/ui/lib/utils";
import type * as React from "react";

/**
 * Surface container root that composes card layout slots.
 */
function Card({ className, ...props }: Readonly<React.ComponentProps<"div">>) {
  return (
    <div
      data-slot="card"
      className={cn(
        "flex flex-col gap-6 rounded-xl border border-border bg-card py-6 text-card-foreground shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Header grid for title, description, and optional action slots.
 */
function CardHeader({
  className,
  ...props
}: Readonly<React.ComponentProps<"div">>) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Main body content slot of Card.
 */
function CardContent({
  className,
  ...props
}: Readonly<React.ComponentProps<"div">>) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-6", className)}
      {...props}
    />
  );
}

export { Card, CardContent, CardHeader };
