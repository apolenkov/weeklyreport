import { type NavigationPage, settleNavigation } from "./navigation.ts";

const ACTION_NAVIGATION_GRACE_MS = 100;
const ACTION_NAVIGATION_TIMEOUT_MS = 2000;
const SIGN_OUT_NAVIGATION_TIMEOUT_MS = 10_000;
const SIGN_OUT_CONTROL_KEY = /^button:Sign(?:%20|\s)out:\d+$/u;
const GENERIC_NAVIGATION_ROLES = new Set(["link"]);
const GENERIC_NAVIGATION_NAMES = new Set(["dashboard", "status", "document"]);
const SAME_DOCUMENT_LINK_NAMES = new Set(["skip to content"]);

export interface ActionNavigationExpectation {
  readonly expectedPathname?: string;
  readonly timeoutMs: number;
}

export interface ActionNavigationPage {
  readonly url: () => string;
  readonly mainFrame: () => object;
  readonly waitForEvent: (
    event: "framenavigated",
    options: Readonly<{
      readonly predicate?: (frame: object) => boolean;
      readonly timeout?: number;
      readonly signal?: AbortSignal;
    }>,
  ) => Promise<object>;
}

const controlParts = (
  controlKey: string,
): Readonly<{ role: string; name: string }> | undefined => {
  const roleSeparator = controlKey.indexOf(":");
  const occurrenceSeparator = controlKey.lastIndexOf(":");
  if (roleSeparator <= 0 || occurrenceSeparator <= roleSeparator)
    return undefined;
  const role = controlKey.slice(0, roleSeparator);
  const encodedName = controlKey.slice(roleSeparator + 1, occurrenceSeparator);
  try {
    return {
      role,
      name: decodeURIComponent(encodedName).trim().toLocaleLowerCase(),
    };
  } catch (error: unknown) {
    if (error instanceof URIError) return undefined;
    throw error;
  }
};

export const expectedActionNavigationFor = (
  controlKey: string,
): ActionNavigationExpectation | undefined => {
  if (SIGN_OUT_CONTROL_KEY.test(controlKey))
    return { expectedPathname: "/", timeoutMs: SIGN_OUT_NAVIGATION_TIMEOUT_MS };
  const parts = controlParts(controlKey);
  if (parts?.role === "link" && SAME_DOCUMENT_LINK_NAMES.has(parts.name))
    return undefined;
  if (
    parts !== undefined &&
    (GENERIC_NAVIGATION_ROLES.has(parts.role) ||
      (parts.role === "button" && GENERIC_NAVIGATION_NAMES.has(parts.name)))
  )
    return { timeoutMs: ACTION_NAVIGATION_TIMEOUT_MS };
  return undefined;
};

export interface ActionNavigationObserver {
  readonly initialUrl: string;
  readonly waitForNavigation: () => Promise<boolean>;
  readonly cancel: () => void;
}

export const observeActionNavigation = (
  page: ActionNavigationPage,
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

const navigationFailureFor = (
  expectation: ActionNavigationExpectation,
): ActionNavigationResult =>
  expectation.expectedPathname === "/"
    ? {
        status: "failed",
        reason: "Sign out did not navigate to / within the bounded wait",
      }
    : {
        status: "failed",
        reason: "Navigation was not observed within the bounded wait",
      };

export const settleActionNavigation = async (
  page: NavigationPage & ActionNavigationPage,
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
      : navigationFailureFor(expectation);
  await settleNavigation(page);
  if (expectation?.expectedPathname === undefined)
    return { status: "observed" };
  const pathname = new URL(page.url()).pathname;
  return pathname === expectation.expectedPathname
    ? { status: "observed" }
    : {
        status: "failed",
        reason: `Sign out settled at ${pathname}; expected ${expectation.expectedPathname}`,
      };
};
