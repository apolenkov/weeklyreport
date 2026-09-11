"use client";

import { useEffect } from "react";

const UNSAVED_EDIT_CONFIRMATION =
  "You have an unsaved update. Do you want to leave this page?";

function isSameDocumentHashLink(anchor: HTMLAnchorElement): boolean {
  const href = anchor.getAttribute("href");
  if (href?.includes("#") !== true) return false;

  const destination = new URL(anchor.href, window.location.href);
  const current = new URL(window.location.href);
  return (
    destination.origin === current.origin &&
    destination.pathname === current.pathname &&
    destination.search === current.search
  );
}

function shouldConfirmNavigation(event: MouseEvent): boolean {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    !(event.target instanceof Element)
  ) {
    return false;
  }

  const anchor = event.target.closest<HTMLAnchorElement>("a[href]");
  if (anchor === null || anchor.hasAttribute("download")) return false;

  const target = anchor.target.toLowerCase();
  return (
    (target === "" || target === "_self") && !isSameDocumentHashLink(anchor)
  );
}

// An open composer owns values that are not yet part of the autosaved draft.
export function useInlineEditUnloadGuard(): void {
  useEffect(() => {
    const preventUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
    };
    const preventNavigation = (event: MouseEvent): void => {
      if (
        shouldConfirmNavigation(event) &&
        !window.confirm(UNSAVED_EDIT_CONFIRMATION)
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", preventUnload);
    document.addEventListener("click", preventNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", preventUnload);
      document.removeEventListener("click", preventNavigation, true);
    };
  }, []);
}
