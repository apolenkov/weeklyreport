import type { Page } from "@playwright/test";

export interface KeyboardTrace {
  readonly after: string;
  readonly before: string;
  readonly focusMoved: boolean;
}

const activeElement = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return "none";
    const role = active.getAttribute("role") ?? active.tagName.toLowerCase();
    const name = active.getAttribute("aria-label") ?? active.innerText.trim();
    return `${role}:${name}`;
  });

export async function captureKeyboardTrace(page: Page): Promise<KeyboardTrace> {
  const before = await activeElement(page);
  await page.keyboard.press("Tab");
  const after = await activeElement(page);
  await page.keyboard.press("Shift+Tab");
  return { after, before, focusMoved: before !== after && after !== "none" };
}
