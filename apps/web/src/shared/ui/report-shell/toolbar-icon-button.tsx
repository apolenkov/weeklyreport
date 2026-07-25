import type { ComponentProps } from "react";

// Single size/focus home for toolbar icon controls (`--toolbar-control-h`;
// rises to `--touch-target-min` below md — ui-control-density).
const TOOLBAR_ICON_BUTTON_CLASS =
  "inline-flex h-[var(--toolbar-control-h)] w-[var(--toolbar-control-h)] shrink-0 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1 disabled:cursor-not-allowed";

type ToolbarIconButtonProps = Omit<ComponentProps<"button">, "type"> & {
  readonly "aria-label": string;
};

/**
 * Toolbar Icon Button.
 * @param props - The props argument.
 */
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
