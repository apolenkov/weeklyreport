"use client";
import { cn } from "@weeklyreport/ui/lib/utils";
import { ToggleGroup as Primitive } from "radix-ui";
import type { ComponentProps } from "react";
/** Coordinates selection and keyboard movement across toggles. */
export const ToggleGroup = Primitive.Root;
/** Names an icon toggle and exposes its selected state. */
export function IconToggle({
  label,
  className,
  ...props
}: ComponentProps<typeof Primitive.Item> & { label: string }) {
  return (
    <Primitive.Item
      {...props}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md data-[state=on]:bg-success data-[state=on]:text-success-foreground pointer-coarse:size-11",
        className,
      )}
    />
  );
}
