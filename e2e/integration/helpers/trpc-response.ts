import type { Page, Response } from "@playwright/test";

const RESPONSE_TIMEOUT_MS = 15_000;

interface MutationWaitOptions {
  procedure?: string | RegExp;
  timeout?: number;
}

function matchesProcedure(url: string, procedure: string | RegExp): boolean {
  return typeof procedure === "string"
    ? url.includes(procedure)
    : procedure.test(url);
}

function isExpectedMutation(
  response: Response,
  procedure: string | RegExp | undefined,
): boolean {
  const url = response.url();
  return (
    url.includes("/trpc/") &&
    response.request().method() === "POST" &&
    (procedure === undefined || matchesProcedure(url, procedure))
  );
}

export async function performAfterListenerArmed<ResponseValue>(
  armListener: () => Promise<ResponseValue>,
  action: () => Promise<unknown>,
): Promise<ResponseValue> {
  const responsePromise = armListener();
  const [response] = await Promise.all([responsePromise, action()]);
  return response;
}

export async function performAndWaitForTrpcMutation(
  page: Page,
  action: () => Promise<unknown>,
  options: MutationWaitOptions = {},
): Promise<Response> {
  return performAfterListenerArmed(
    () =>
      page.waitForResponse(
        (response) => isExpectedMutation(response, options.procedure),
        { timeout: options.timeout ?? RESPONSE_TIMEOUT_MS },
      ),
    action,
  );
}
