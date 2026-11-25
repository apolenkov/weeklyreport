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
  const expanders = target.closest("[hidden], [inert]")
    ? Array.from(
        scope?.querySelectorAll<HTMLButtonElement>(
          'button[aria-expanded="false"][aria-controls]',
        ) ?? [],
      ).filter((button) => {
        const panelId = button.getAttribute("aria-controls");
        return panelId
          ? document.getElementById(panelId)?.contains(target)
          : false;
      })
    : [];
  for (const button of expanders) button.click();
  const focus = (): void => {
    if (focusOptions) target.focus(focusOptions);
    else target.focus();
    if (scrollOptions) target.scrollIntoView(scrollOptions);
  };
  if (expanders.length > 0 || scrollOptions) queueMicrotask(focus);
  else focus();
}
