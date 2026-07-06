import type { ComponentProps } from "react";

/**
 * Compact icon-only button for the report toolbar pill, extracted from
 * SaveNowButton's proven styling so every toolbar icon control shares one size
 * and focus treatment — the size lives only here. The circle derives both
 * dimensions from `--toolbar-control-h` (32px on desktop; the token rises to
 * the `--touch-target-min` floor below `md`, see responsive-compact-layout).
 * `aria-label` is required; the native `title` tooltip defaults to the same
 * wording. State variants (accent fill, switch styling) are appended via
 * `className`.
 */
const TOOLBAR_ICON_BUTTON_CLASS =
  "inline-flex h-[var(--toolbar-control-h)] w-[var(--toolbar-control-h)] shrink-0 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1 disabled:cursor-not-allowed";

type ToolbarIconButtonProps = Omit<ComponentProps<"button">, "type"> & {
  readonly "aria-label": string;
};

export function ToolbarIconButton({
  title,
  className,
  children,
  ...rest
}: ToolbarIconButtonProps) {
  return (
    <button
      {...rest}
      type="button"
      title={title ?? rest["aria-label"]}
      className={
        className
          ? `${TOOLBAR_ICON_BUTTON_CLASS} ${className}`
          : TOOLBAR_ICON_BUTTON_CLASS
      }
    >
      {children}
    </button>
  );
}
