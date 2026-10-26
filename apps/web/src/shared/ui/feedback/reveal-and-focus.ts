interface RevealAndFocusOptions {
  readonly scope?: ParentNode | null;
  readonly focusOptions?: FocusOptions;
  readonly scrollOptions?: ScrollIntoViewOptions;
}

/** Reveal a controlled panel before restoring focus with the caller's scroll policy. */
export function revealAndFocus(
  target: HTMLElement | null | undefined,
  { scope = document, focusOptions, scrollOptions }: RevealAndFocusOptions = {},
): void {
  if (!target) return;
  const expander = target.closest("[hidden], [inert]")
    ? Array.from(
        scope?.querySelectorAll<HTMLButtonElement>(
          'button[aria-expanded="false"][aria-controls]',
        ) ?? [],
      ).find((button) => {
        const panelId = button.getAttribute("aria-controls");
        return panelId
          ? document.getElementById(panelId)?.contains(target)
          : false;
      })
    : undefined;
  expander?.click();
  const focus = (): void => {
    if (focusOptions) target.focus(focusOptions);
    else target.focus();
    if (scrollOptions) target.scrollIntoView(scrollOptions);
  };
  if (expander || scrollOptions) queueMicrotask(focus);
  else focus();
}
