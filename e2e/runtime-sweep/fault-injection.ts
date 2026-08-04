import type { Route } from "@playwright/test";

import type { FaultMode } from "./contracts.ts";

export type InjectableFaultMode = Extract<
  FaultMode,
  | "auth-missing"
  | "auth-expired"
  | "auth-forbidden"
  | "network-timeout"
  | "request-aborted"
  | "http-4xx"
  | "http-5xx"
>;

export type FaultRecovery = "reauthenticate" | "retry" | "reload" | "none";
export type PersistedStateOutcome = "unchanged" | "changed" | "not-observed";

export type FaultExpectation = Readonly<{
  userVisibleMessage: string;
  statusRole: "alert" | "status";
  recovery: FaultRecovery;
  persistedState: PersistedStateOutcome;
}>;

export type FaultResponse = Readonly<{
  status: number;
  body: string;
  headers: Readonly<Record<string, string>>;
}>;

type HttpFaultDeclaration = Readonly<{
  id: string;
  mode: Extract<
    InjectableFaultMode,
    "auth-missing" | "auth-expired" | "auth-forbidden" | "http-4xx" | "http-5xx"
  >;
  urlPattern: string | RegExp;
  operation: string;
  expectation: FaultExpectation;
  response: FaultResponse;
  abortCode: null;
}>;

type AbortedFaultDeclaration = Readonly<{
  id: string;
  mode: Extract<InjectableFaultMode, "network-timeout" | "request-aborted">;
  urlPattern: string | RegExp;
  operation: string;
  expectation: FaultExpectation;
  response: null;
  abortCode: "timedout" | "aborted";
}>;

export type FaultDeclaration = HttpFaultDeclaration | AbortedFaultDeclaration;

export type FaultRouteHandler = (route: Route) => Promise<void>;

export interface FaultRouteRegistrar {
  route(urlPattern: string | RegExp, handler: FaultRouteHandler): Promise<void>;
  unroute(
    urlPattern: string | RegExp,
    handler: FaultRouteHandler,
  ): Promise<void>;
}

export type InstalledFault = Readonly<{
  declaration: FaultDeclaration;
  handler: FaultRouteHandler;
  teardown: () => Promise<void>;
}>;

function responseHeaders(
  headers: Readonly<Record<string, string>>,
): Record<string, string> {
  return { ...headers };
}

function buildHandler(declaration: FaultDeclaration): FaultRouteHandler {
  return async (route: Route): Promise<void> => {
    if (declaration.response === null) {
      await route.abort(declaration.abortCode);
      return;
    }
    await route.fulfill({
      status: declaration.response.status,
      headers: responseHeaders(declaration.response.headers),
      body: declaration.response.body,
    });
  };
}

export async function installFault(
  page: FaultRouteRegistrar,
  declaration: FaultDeclaration,
): Promise<InstalledFault> {
  const handler = buildHandler(declaration);
  await page.route(declaration.urlPattern, handler);
  return Object.freeze({
    declaration,
    handler,
    teardown: () =>
      page.unroute(declaration.urlPattern, handler).then(() => undefined),
  });
}

export async function withFault<T>(
  page: FaultRouteRegistrar,
  declaration: FaultDeclaration,
  action: () => Promise<T>,
): Promise<T> {
  const installed = await installFault(page, declaration);
  return action().then(
    async (result) => {
      await installed.teardown();
      return result;
    },
    async (error: unknown) => {
      try {
        await installed.teardown();
      } catch (teardownError) {
        throw new AggregateError(
          [error, teardownError],
          "Fault action and teardown both failed",
        );
      }
      throw error;
    },
  );
}
