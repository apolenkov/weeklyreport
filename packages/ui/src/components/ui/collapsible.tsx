"use client";

import { Collapsible as CollapsiblePrimitive } from "radix-ui";
import type * as React from "react";

/** Owns expanded state shared by a collapsible trigger and content panel. */
function Collapsible({
  ...props
}: Readonly<React.ComponentProps<typeof CollapsiblePrimitive.Root>>) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />;
}

/** Control that toggles its associated collapsible panel. */
function CollapsibleTrigger({
  ...props
}: Readonly<React.ComponentProps<typeof CollapsiblePrimitive.Trigger>>) {
  return (
    <CollapsiblePrimitive.Trigger data-slot="collapsible-trigger" {...props} />
  );
}

/** Panel exposed while its collapsible owner is expanded. */
function CollapsibleContent({
  ...props
}: Readonly<React.ComponentProps<typeof CollapsiblePrimitive.Content>>) {
  return (
    <CollapsiblePrimitive.Content data-slot="collapsible-content" {...props} />
  );
}

export { Collapsible, CollapsibleContent, CollapsibleTrigger };
