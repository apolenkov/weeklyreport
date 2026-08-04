"use client";

import { cn } from "@customreport/ui/lib/utils";
import { Avatar as AvatarPrimitive } from "radix-ui";
import type * as React from "react";

/** Avatar shell sized to 24, 32, or 40 pixels through the shared size contract. */
function Avatar({
  className,
  size = "default",
  ...props
}: Readonly<
  React.ComponentProps<typeof AvatarPrimitive.Root> & {
    size?: "default" | "sm" | "lg";
  }
>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size}
      className={cn(
        "group/avatar relative flex size-8 shrink-0 overflow-hidden rounded-full select-none data-[size=lg]:size-10 data-[size=sm]:size-6",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Image slot for an Avatar root; fills the circle when load succeeds.
 */
function AvatarImage({
  className,
  ...props
}: Readonly<React.ComponentProps<typeof AvatarPrimitive.Image>>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full", className)}
      {...props}
    />
  );
}

/**
 * Fallback content shown while the image is missing or still loading.
 */
function AvatarFallback({
  className,
  ...props
}: Readonly<React.ComponentProps<typeof AvatarPrimitive.Fallback>>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-full bg-muted text-sm text-muted-foreground group-data-[size=sm]/avatar:text-xs",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Status/badge overlay anchored to the bottom-right of its Avatar parent.
 */
function AvatarBadge({
  className,
  ...props
}: Readonly<React.ComponentProps<"span">>) {
  return (
    <span
      data-slot="avatar-badge"
      className={cn(
        "absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background select-none",
        "group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden",
        "group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2",
        "group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Overlapping stack container for multiple Avatar children.
 */
function AvatarGroup({
  className,
  ...props
}: Readonly<React.ComponentProps<"div">>) {
  return (
    <div
      data-slot="avatar-group"
      className={cn(
        "group/avatar-group flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Overflow count chip sized to match sibling avatars in an AvatarGroup.
 */
function AvatarGroupCount({
  className,
  ...props
}: Readonly<React.ComponentProps<"div">>) {
  return (
    <div
      data-slot="avatar-group-count"
      className={cn(
        "relative flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground ring-2 ring-background group-has-data-[size=lg]/avatar-group:size-10 group-has-data-[size=sm]/avatar-group:size-6 [&>svg]:size-4 group-has-data-[size=lg]/avatar-group:[&>svg]:size-5 group-has-data-[size=sm]/avatar-group:[&>svg]:size-3",
        className,
      )}
      {...props}
    />
  );
}

export {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
};
