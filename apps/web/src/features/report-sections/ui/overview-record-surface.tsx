import { PopoverContent } from "@weeklyreport/ui/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@weeklyreport/ui/components/ui/sheet";
import { type ReactNode, type RefObject, useSyncExternalStore } from "react";
const query = "(max-width: 760px), (pointer: coarse)";
function subscribe(change: () => void) {
  if (typeof window.matchMedia !== "function") return () => undefined;
  const media = window.matchMedia(query);
  media.addEventListener("change", change);
  return () => media.removeEventListener("change", change);
}
export function OverviewRecordSurface({
  children,
  trigger,
  dirty,
  nested,
  close,
  cancel,
}: {
  readonly children: ReactNode;
  readonly trigger: RefObject<HTMLButtonElement | null>;
  readonly dirty: boolean;
  readonly nested: boolean;
  readonly close: () => void;
  readonly cancel: () => void;
}) {
  const sheet = useSyncExternalStore(
    subscribe,
    () =>
      typeof window.matchMedia === "function" &&
      window.matchMedia(query).matches,
    () => false,
  );
  const outside = (event: Event) => {
    event.preventDefault();
    if (!dirty && !nested) close();
  };
  const escape = (event: KeyboardEvent) => {
    event.preventDefault();
    if (!nested) cancel();
  };
  const focusField = (event: Event) => {
    event.preventDefault();
    const node = event.target;
    if (node instanceof HTMLElement)
      (node.querySelector("textarea") ?? node.querySelector("button"))?.focus();
  };
  const restore = (event: Event) => {
    event.preventDefault();
  };
  if (sheet)
    return (
      <Sheet open>
        <SheetContent
          side="bottom"
          aria-describedby={undefined}
          onEscapeKeyDown={escape}
          onInteractOutside={outside}
          onCloseAutoFocus={restore}
          onOpenAutoFocus={focusField}
          showCloseButton={false}
          className="p-4 [&_button]:min-h-11 [&_button]:min-w-11"
        >
          <SheetTitle className="sr-only">Record</SheetTitle>
          {children}
        </SheetContent>
      </Sheet>
    );
  return (
    <PopoverContent
      aria-label="Record"
      className="w-[392px]"
      onInteractOutside={outside}
      onEscapeKeyDown={escape}
      onCloseAutoFocus={restore}
      onOpenAutoFocus={focusField}
      onKeyDown={(event) => {
        leaveOnTab(event, { nested, trigger, dirty, close });
      }}
    >
      {children}
    </PopoverContent>
  );
}

function leaveOnTab(
  event: React.KeyboardEvent<HTMLDivElement>,
  {
    nested,
    trigger,
    dirty,
    close,
  }: {
    nested: boolean;
    trigger: RefObject<HTMLButtonElement | null>;
    dirty: boolean;
    close: () => void;
  },
) {
  if (event.key !== "Tab" || nested) return;
  const buttons = event.currentTarget.querySelectorAll<HTMLElement>(
    "textarea:not(:disabled),button:not(:disabled),input:not(:disabled)",
  );
  const back = event.shiftKey && buttons[0]?.isSameNode(event.target as Node);
  const forward =
    !event.shiftKey &&
    buttons[buttons.length - 1]?.isSameNode(event.target as Node);
  if (!back && !forward) return;
  event.preventDefault();
  const anchor = trigger.current;
  if (!anchor) return;
  const candidates = [
    ...document.querySelectorAll<HTMLElement>(
      'a[href],button:not(:disabled),input:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
    ),
  ].filter(
    (node) =>
      !node.closest("[hidden],[inert],[data-radix-popper-content-wrapper]") &&
      node.getClientRects().length > 0,
  );
  const next = candidates[candidates.indexOf(anchor) + 1];
  (back ? anchor : (next ?? anchor)).focus();
  if (!dirty) close();
}
