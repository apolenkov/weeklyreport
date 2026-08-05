import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

type AxeResults = Awaited<ReturnType<AxeBuilder["analyze"]>>;

const RADIX_PORTAL_SELECTOR = "[data-radix-popper-content-wrapper]";
const PERIOD_LISTBOX_SELECTOR = '[role="listbox"][id^="period-listbox-"]';
const SONNER_PORTAL_SELECTOR = "[data-sonner-toaster]";

const PORTAL_SELECTORS = [
  RADIX_PORTAL_SELECTOR,
  PERIOD_LISTBOX_SELECTOR,
  SONNER_PORTAL_SELECTOR,
] as const;
const ANIMATION_SETTLE_TIMEOUT_MS = 1000;
const PORTAL_CLOSE_TIMEOUT_MS = 2000;

export type PreparedAxeContext = Readonly<{
  activePortalSelectors: readonly string[];
  active: AxeResults;
}>;

export type AxeContextResults = AxeResults &
  Readonly<{
    activePortalSelectors: readonly string[];
    fullPageAfterPortalClose: AxeResults;
  }>;

const uniqueValues = <T>(values: readonly T[]): readonly T[] =>
  Array.from(
    new Map(values.map((value) => [JSON.stringify(value), value])).values(),
  );

const mergeResults = (results: readonly AxeResults[]): AxeResults => {
  const [first, ...rest] = results;
  if (first === undefined)
    throw new Error("Runtime sweep axe context produced no result");
  const all = [first, ...rest];
  return {
    ...first,
    violations: [...uniqueValues(all.flatMap(({ violations }) => violations))],
    incomplete: [...uniqueValues(all.flatMap(({ incomplete }) => incomplete))],
    passes: [...uniqueValues(all.flatMap(({ passes }) => passes))],
    inapplicable: [
      ...uniqueValues(all.flatMap(({ inapplicable }) => inapplicable)),
    ],
  };
};

const activePortalSelectorsFor = async (
  page: Page,
): Promise<readonly string[]> => {
  const presence = await Promise.all(
    PORTAL_SELECTORS.map(async (selector) => ({
      selector,
      present: (await page.locator(selector).count()) > 0,
    })),
  );
  return presence
    .filter(({ present }) => present)
    .map(({ selector }) => selector);
};

export const settleEvidenceAnimations = async (page: Page): Promise<void> => {
  await page.evaluate(async (timeoutMs) => {
    const finiteRunning = document.getAnimations().filter((animation) => {
      const timing = animation.effect?.getComputedTiming();
      return (
        animation.playState === "running" &&
        timing?.iterations !== Infinity &&
        typeof timing?.duration === "number"
      );
    });
    const settled = Promise.all(
      finiteRunning.map((animation) => animation.finished),
    );
    const deadline = new Promise<"timeout">((resolve) => {
      window.setTimeout(() => resolve("timeout"), timeoutMs);
    });
    await Promise.race([settled, deadline]);
  }, ANIMATION_SETTLE_TIMEOUT_MS);
};

const modalIsolationFor = async (page: Page): Promise<boolean> =>
  (await page.locator('[data-aria-hidden="true"]').count()) > 0 ||
  (await page.locator('body > [aria-hidden="true"]').count()) > 0;

const activeAxeFor = async (
  page: Page,
  activePortalSelectors: readonly string[],
): Promise<AxeResults> => {
  const hasPortalModal =
    activePortalSelectors.includes(RADIX_PORTAL_SELECTOR) &&
    (await modalIsolationFor(page));
  const pageResults = hasPortalModal
    ? []
    : [await activePageAxeFor(page, activePortalSelectors)];
  const portalResults = await Promise.all(
    activePortalSelectors.map(async (selector) =>
      new AxeBuilder({ page })
        .include(selector)
        .disableRules("region")
        .analyze(),
    ),
  );
  return mergeResults([...pageResults, ...portalResults]);
};

const activePageAxeFor = async (
  page: Page,
  activePortalSelectors: readonly string[],
): Promise<AxeResults> => {
  const builder = new AxeBuilder({ page }).exclude('[aria-hidden="true"]');
  activePortalSelectors.forEach((selector) => builder.exclude(selector));
  return builder.analyze();
};

export const prepareAxeContext = async (
  page: Page,
): Promise<PreparedAxeContext> => {
  await settleEvidenceAnimations(page);
  const activePortalSelectors = await activePortalSelectorsFor(page);
  const active = await activeAxeFor(page, activePortalSelectors);
  return { activePortalSelectors, active };
};

const closeInteractivePortals = async (
  page: Page,
  activePortalSelectors: readonly string[],
): Promise<void> => {
  const openInteractive = activePortalSelectors.filter(
    (selector) => selector === PERIOD_LISTBOX_SELECTOR,
  );
  const radixMenuOpen =
    activePortalSelectors.includes(RADIX_PORTAL_SELECTOR) &&
    (await page
      .locator(
        `${RADIX_PORTAL_SELECTOR} [role="menu"], ${RADIX_PORTAL_SELECTOR} [role="listbox"]`,
      )
      .count()) > 0;
  const selectorsToClose = radixMenuOpen
    ? [...openInteractive, RADIX_PORTAL_SELECTOR]
    : openInteractive;
  if (selectorsToClose.length === 0) return;
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    (selectors) =>
      selectors.every((selector) => !document.querySelector(selector)) &&
      !document.querySelector('[data-aria-hidden="true"]'),
    selectorsToClose,
    { timeout: PORTAL_CLOSE_TIMEOUT_MS },
  );
  await settleEvidenceAnimations(page);
};

export const finalizeAxeContext = async (
  page: Page,
  prepared: PreparedAxeContext,
): Promise<AxeContextResults> => {
  await closeInteractivePortals(page, prepared.activePortalSelectors);
  const fullPageAfterPortalClose = await new AxeBuilder({ page }).analyze();
  const merged = mergeResults([prepared.active, fullPageAfterPortalClose]);
  return {
    ...merged,
    activePortalSelectors: prepared.activePortalSelectors,
    fullPageAfterPortalClose,
  };
};
