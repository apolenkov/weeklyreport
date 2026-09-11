import { type RefObject, useEffect, useEffectEvent, useMemo } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

const MODAL_SURFACE_SELECTOR =
  '[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]';

interface KeyboardOwner {
  readonly containerRef: RefObject<HTMLElement | null>;
  readonly mode: DialogFocusMode;
}

type DialogFocusMode = "modal" | "nonmodal";

const keyboardOwnersByDocument = new WeakMap<Document, KeyboardOwner[]>();

function registerKeyboardOwner(
  ownerDocument: Document,
  owner: KeyboardOwner,
): () => void {
  const owners = keyboardOwnersByDocument.get(ownerDocument) ?? [];
  if (owners.length === 0) keyboardOwnersByDocument.set(ownerDocument, owners);
  owners.push(owner);

  return () => {
    const ownerIndex = owners.lastIndexOf(owner);
    if (ownerIndex !== -1) owners.splice(ownerIndex, 1);
    if (owners.length === 0) keyboardOwnersByDocument.delete(ownerDocument);
  };
}

function isKeyboardEventOwner(
  ownerDocument: Document,
  owner: KeyboardOwner,
  event: KeyboardEvent,
): boolean {
  const owners = keyboardOwnersByDocument.get(ownerDocument) ?? [];
  const eligibleOwners =
    event.key === "Tab"
      ? owners.filter((candidate) => candidate.mode === "modal")
      : owners;
  const eventModal = closestModalSurface(eventElement(event));
  if (!eventModal) return eligibleOwners.at(-1) === owner;
  return (
    eligibleOwners
      .filter(
        (candidate) =>
          closestModalSurface(candidate.containerRef.current) === eventModal,
      )
      .at(-1) === owner
  );
}

function focusableWithin(container: HTMLElement): HTMLElement[] {
  return [
    ...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ].filter((element) => !element.matches(":disabled"));
}

function trapTab(event: KeyboardEvent, container: HTMLElement): void {
  const focusable = focusableWithin(container);
  const first = focusable.at(0);
  const last = focusable.at(-1);
  if (first === undefined || last === undefined) {
    event.preventDefault();
    container.focus();
    return;
  }
  const active = document.activeElement;

  const activeIsFocusable =
    active instanceof HTMLElement && focusable.includes(active);
  if (!activeIsFocusable) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
    return;
  }

  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

interface DialogFocusOptions {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly containerRef: RefObject<HTMLElement | null>;
  readonly triggerRef?: RefObject<HTMLElement | null> | undefined;
  readonly mode?: DialogFocusMode;
}

const getActiveElement = (): HTMLElement | null =>
  typeof document === "undefined"
    ? null
    : (document.activeElement as HTMLElement | null);

const activeElementForDialog = (open: boolean): HTMLElement | null =>
  open ? getActiveElement() : null;

function closestModalSurface(element: Element | null): HTMLElement | null {
  return element?.closest<HTMLElement>(MODAL_SURFACE_SELECTOR) ?? null;
}

function eventElement(event: KeyboardEvent): Element | null {
  if (event.target instanceof Element) return event.target;
  return getActiveElement();
}

function resolveRestoreTarget(
  container: HTMLElement | null,
  activeElement: HTMLElement | null,
  opener: HTMLElement | null,
  trigger: HTMLElement | null,
): HTMLElement | null {
  if (trigger) return trigger;
  if (!container?.contains(activeElement)) return activeElement;
  return container.contains(opener) ? null : opener;
}

function focusDialogSurface(
  container: HTMLElement | null,
  activeElement: HTMLElement | null,
): void {
  if (!container || container.contains(activeElement)) return;
  (focusableWithin(container)[0] ?? container).focus();
}

// Shared non-Radix focus lifecycle. Modal surfaces also move and trap focus;
// nonmodal popups retain only Escape ownership and focus restoration.
export function useDialogFocus({
  open,
  onClose,
  containerRef,
  triggerRef,
  mode = "modal",
}: DialogFocusOptions): void {
  const opener = useMemo(() => activeElementForDialog(open), [open]);
  const keyboardOwner = useMemo<KeyboardOwner>(
    () => ({ containerRef, mode }),
    [containerRef, mode],
  );
  const closeDialog = useEffectEvent(onClose);

  useEffect(() => {
    if (!open) return;
    const container = containerRef.current;
    const activeElement = getActiveElement();
    const restoreTarget = resolveRestoreTarget(
      container,
      activeElement,
      opener,
      triggerRef?.current ?? null,
    );
    if (mode === "modal") focusDialogSurface(container, activeElement);

    return () => {
      restoreTarget?.focus();
    };
  }, [open, containerRef, triggerRef, opener, mode]);

  useEffect(() => {
    if (!open) return;

    const ownerDocument = document;
    const unregisterKeyboardOwner = registerKeyboardOwner(
      ownerDocument,
      keyboardOwner,
    );

    function handleKeyDown(event: KeyboardEvent): void {
      const container = containerRef.current;
      if (
        event.defaultPrevented ||
        !isKeyboardEventOwner(ownerDocument, keyboardOwner, event)
      ) {
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        closeDialog();
        return;
      }
      if (event.key === "Tab" && mode === "modal" && container) {
        trapTab(event, container);
      }
    }

    ownerDocument.addEventListener("keydown", handleKeyDown);
    return () => {
      unregisterKeyboardOwner();
      ownerDocument.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, containerRef, keyboardOwner, mode]);
}
