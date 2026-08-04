import {
  expect,
  type Page,
  type Request,
  type Response,
} from "@playwright/test";

import { ACTIVE_REPORT_ID } from "../../prisma/seed-constants.ts";
import { prisma } from "../integration/helpers/db.ts";
import { loginByCookie } from "../sweep/helpers/dev-auth.ts";
import type { FaultDeclaration } from "./fault-injection.ts";

export const REPORT_PATH = `/head/report/${ACTIVE_REPORT_ID}`;
const HTTP_ERROR_BOUNDARY = 400;

export type ReportState = Awaited<ReturnType<typeof reportState>>;
export type PublishObservation = Readonly<{
  readonly request: Request;
  readonly response: Response | null;
  readonly failure: Request | null;
}>;

export const reportState = () =>
  prisma.report.findUniqueOrThrow({
    where: { id: ACTIVE_REPORT_ID },
    select: {
      status: true,
      periodState: true,
      periodStatus: true,
      publishedAt: true,
      publishedById: true,
    },
  });

const matchesDeclaration = (
  request: Request,
  declaration: FaultDeclaration,
): boolean => {
  const pattern = declaration.urlPattern;
  return typeof pattern === "string"
    ? request.url().includes(pattern)
    : pattern.test(request.url());
};

const triggerPublish = async (page: Page): Promise<void> => {
  const publish = page.getByRole("button", { name: /publish.*lock/i });
  await expect(publish).toBeVisible({ timeout: 15_000 });
  await publish.click();
  const confirm = page.getByRole("button", {
    name: /^(publish & lock|publish anyway)$/i,
  });
  await expect(confirm.last()).toBeVisible();
  await confirm.last().click();
};

export const observePublish = async (
  page: Page,
  declaration: FaultDeclaration,
): Promise<PublishObservation> => {
  const requestPromise = page.waitForRequest((request) =>
    matchesDeclaration(request, declaration),
  );
  if (declaration.response === null) {
    const failurePromise = page.waitForEvent("requestfailed", {
      predicate: (request) => matchesDeclaration(request, declaration),
    });
    await triggerPublish(page);
    return {
      request: await requestPromise,
      response: null,
      failure: await failurePromise,
    };
  }
  const responsePromise = page.waitForResponse((response) =>
    matchesDeclaration(response.request(), declaration),
  );
  await triggerPublish(page);
  return {
    request: await requestPromise,
    response: await responsePromise,
    failure: null,
  };
};

export const assertFailureFeedback = async (
  page: Page,
  declaration: FaultDeclaration,
): Promise<void> => {
  const { userVisibleMessage, statusRole } = declaration.expectation;
  const feedback = page
    .locator(`[role="${statusRole}"], [data-sonner-toast]`)
    .filter({ hasText: userVisibleMessage })
    .last();
  await expect(feedback).toBeVisible();
};

export const recover = async (
  page: Page,
  declaration: FaultDeclaration,
): Promise<ReportState> => {
  switch (declaration.expectation.recovery) {
    case "reauthenticate":
      await loginByCookie(page, { role: "head", redirect: REPORT_PATH });
      return reportState();
    case "retry": {
      await page.goto(REPORT_PATH);
      const responsePromise = page.waitForResponse((response) =>
        matchesDeclaration(response.request(), declaration),
      );
      await triggerPublish(page);
      const response = await responsePromise;
      expect(response.status()).toBeLessThan(HTTP_ERROR_BOUNDARY);
      return reportState();
    }
    case "reload":
      await page.goto(REPORT_PATH);
      return reportState();
    case "none":
      return reportState();
    default:
      throw new Error("Unknown fault recovery policy");
  }
};

export const assertUnchanged = (
  before: ReportState,
  after: ReportState,
): void => {
  expect(after).toEqual(before);
};
