"use client";
import { Collapsible as Primitive } from "radix-ui";
/** Owns the disclosure and its expanded state. */
export const Collapsible = Primitive.Root;
/** Toggles the associated disclosure content. */
export const CollapsibleTrigger = Primitive.Trigger;
/** Contains content controlled by the disclosure. */
export const CollapsibleContent = Primitive.Content;
