import type { ElementHandle, Page } from "@playwright/test";

export type FocusedControl = Readonly<{
  controlKey: string;
  role: string;
  accessibleName: string;
}>;

type ReadFocusedControl = (page: Page) => Promise<FocusedControl | null>;

const FOCUSABLE_DESCENDANT =
  "a[href],button,input,select,textarea,summary,[contenteditable]:not([contenteditable='false']),[tabindex]:not([tabindex='-1'])";

const expandedDisclosureTarget = async (
  page: Page,
): Promise<ElementHandle<HTMLElement> | null> => {
  const candidate = await page.evaluateHandle((focusableSelector) => {
    const trigger = document.activeElement;
    if (
      !(trigger instanceof HTMLElement) ||
      trigger.getAttribute("aria-expanded")?.toLowerCase() !== "true"
    )
      return null;
    const controlledId = trigger.getAttribute("aria-controls")?.trim();
    const controlled = controlledId
      ? document.getElementById(controlledId)
      : null;
    const implicit = trigger.nextElementSibling;
    const target = controlled ?? implicit;
    if (!(target instanceof HTMLElement)) return null;
    const visibleFocusable = Array.from(
      target.querySelectorAll<HTMLElement>(focusableSelector),
    ).some((element) => {
      const bounds = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return (
        !element.matches(":disabled,[aria-disabled='true']") &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        bounds.width > 0 &&
        bounds.height > 0
      );
    });
    return visibleFocusable ? target : null;
  }, FOCUSABLE_DESCENDANT);
  const element = candidate.asElement();
  if (element === null) await candidate.dispose();
  return element;
};

type DisclosureTraversal = Readonly<{
  page: Page;
  target: ElementHandle<HTMLElement>;
  readFocusedControl: ReadFocusedControl;
  remaining: number;
  enteredTarget: boolean;
  sequence: readonly FocusedControl[];
}>;

const traverseDisclosure = async ({
  page,
  target,
  readFocusedControl,
  remaining,
  enteredTarget,
  sequence,
}: DisclosureTraversal): Promise<readonly FocusedControl[]> => {
  if (remaining <= 0) return sequence;
  await page.keyboard.press("Tab");
  const control = await readFocusedControl(page);
  const insideTarget = await page.evaluate(
    (disclosure) => disclosure.contains(document.activeElement),
    target,
  );
  const nextSequence = control === null ? sequence : [...sequence, control];
  const nextEnteredTarget = enteredTarget || insideTarget;
  if (nextEnteredTarget && !insideTarget) return nextSequence;
  return traverseDisclosure({
    page,
    target,
    readFocusedControl,
    remaining: remaining - 1,
    enteredTarget: nextEnteredTarget,
    sequence: nextSequence,
  });
};

export async function captureExpandedDisclosureSequence(
  page: Page,
  maxSteps: number,
  readFocusedControl: ReadFocusedControl,
): Promise<readonly FocusedControl[]> {
  const target = await expandedDisclosureTarget(page);
  if (target === null) return [];
  try {
    const active = await readFocusedControl(page);
    return await traverseDisclosure({
      page,
      target,
      readFocusedControl,
      remaining: maxSteps,
      enteredTarget: false,
      sequence: active === null ? [] : [active],
    });
  } finally {
    await target.dispose();
  }
}
