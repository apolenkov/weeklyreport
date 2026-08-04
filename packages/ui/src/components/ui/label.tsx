"use client";

import { cn } from "@customreport/ui/lib/utils";
import { Label as LabelPrimitive } from "radix-ui";
import type * as React from "react";

/** Accessible label associated with a form control. */
function Label({
  className,
  ...props
}: Readonly<React.ComponentProps<typeof LabelPrimitive.Root>>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
