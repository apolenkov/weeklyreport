import type { Page } from "@playwright/test";

import { settleNavigation } from "./navigation.ts";

const ACTION_NAVIGATION_GRACE_MS = 100;
const SIGN_OUT_NAVIGATION_TIMEOUT_MS = 10_000;
const SIGN_OUT_CONTROL_KEY = /^button:Sign(?:%20|\s)out:\d+$/u;

export interface ActionNavigationExpectation {
  readonly expectedPathname: string;
  readonly timeoutMs: number;
}

export const expectedActionNavigationFor = (
  controlKey: string,
): ActionNavigationExpectation | undefined =>
  SIGN_OUT_CONTROL_KEY.test(controlKey)
    ? { expectedPathname: "/", timeoutMs: SIGN_OUT_NAVIGATION_TIMEOUT_MS }
    : undefined;

export interface ActionNavigationObserver {
  readonly initialUrl: string;
  readonly waitForNavigation: () => Promise<boolean>;
  readonly cancel: () => void;
}

export const observeActionNavigation = (
  page: Page,
  expectation?: ActionNavigationExpectation,
): ActionNavigationObserver => {
  const initialUrl = page.url();
  const timeoutMs = expectation?.timeoutMs ?? ACTION_NAVIGATION_GRACE_MS;
  const controller = new AbortController();
  const navigation = page
    .waitForEvent("framenavigated", {
      predicate: (frame) => frame === page.mainFrame(),
      timeout: 0,
      signal: controller.signal,
    })
    .then(() => true)
    .catch((error: unknown) => {
      if (controller.signal.aborted) return false;
      throw error;
    });
  const cancel = (): void => controller.abort();

  return {
    initialUrl,
    cancel,
    waitForNavigation: async (): Promise<boolean> => {
      if (page.url() !== initialUrl) return true;
      const timeout = new Promise<"timeout">((resolve) => {
        const timer = setTimeout(() => resolve("timeout"), timeoutMs);
        navigation.then(
          () => clearTimeout(timer),
          () => clearTimeout(timer),
        );
      });
      const result = await Promise.race([
        navigation.then(() => "navigation" as const),
        timeout,
      ]);
      if (result === "timeout") {
        cancel();
        return false;
      }
      return true;
    },
  };
};

export type ActionNavigationResult =
  | Readonly<{ status: "none" | "observed" }>
  | Readonly<{ status: "failed"; reason: string }>;

export const settleActionNavigation = async (
  page: Page,
  observer: ActionNavigationObserver,
  outcome:
    | Readonly<{
        readonly observation?: Readonly<{ readonly kind: string }> | undefined;
      }>
    | undefined,
  expectation: ActionNavigationExpectation | undefined,
): Promise<ActionNavigationResult> => {
  if (outcome?.observation?.kind === "dom" && expectation === undefined) {
    observer.cancel();
    return { status: "none" };
  }
  const observed = await observer.waitForNavigation();
  if (!observed)
    return expectation === undefined
      ? { status: "none" }
      : {
          status: "failed",
          reason: "Sign out did not navigate to / within the bounded wait",
        };
  await settleNavigation(page);
  if (expectation === undefined) return { status: "observed" };
  const pathname = new URL(page.url()).pathname;
  return pathname === expectation.expectedPathname
    ? { status: "observed" }
    : {
        status: "failed",
        reason: `Sign out settled at ${pathname}; expected ${expectation.expectedPathname}`,
      };
};
