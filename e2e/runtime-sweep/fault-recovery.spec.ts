import {
  expect,
  type Page,
  type Request,
  type Response,
  test,
} from "@playwright/test";

import { ACTIVE_REPORT_ID } from "../../prisma/seeds/support/seed-constants.ts";
import { prisma, resetMutations } from "../integration/helpers/db.ts";
import { loginByCookie } from "../sweep/helpers/dev-auth.ts";
import { seedProfileSchema } from "./contracts.ts";
import { FAULT_DECLARATIONS } from "./fault-declarations.ts";
import type { FaultDeclaration } from "./fault-injection.ts";
import { withFault } from "./fault-injection.ts";

const PROFILE = seedProfileSchema.parse(
  process.env.RUNTIME_SWEEP_PROFILE ?? process.env.E2E_SEED_PROFILE ?? "full",
);
const REPORT_PATH = `/head/report/${ACTIVE_REPORT_ID}`;

type ReportState = Awaited<ReturnType<typeof reportState>>;
type PublishObservation = Readonly<{
  readonly request: Request;
  readonly response: Response | null;
  readonly failure: Request | null;
}>;

function reportState() {
  return prisma.report.findUniqueOrThrow({
    where: { id: ACTIVE_REPORT_ID },
    select: {
      status: true,
      periodState: true,
      periodStatus: true,
      publishedAt: true,
      publishedById: true,
    },
  });
}

const matchesDeclaration = (
  request: Request,
  declaration: FaultDeclaration,
): boolean => {
  const pattern = declaration.urlPattern;
  return typeof pattern === "string"
    ? request.url().includes(pattern)
    : pattern.test(request.url());
};

async function triggerPublish(page: Page): Promise<void> {
  const publish = page.getByRole("button", { name: /publish.*lock/i });
  await expect(publish).toBeVisible({ timeout: 15_000 });
  await publish.click();
  const confirm = page.getByRole("button", {
    name: /^(publish & lock|publish anyway)$/i,
  });
  await expect(confirm.last()).toBeVisible();
  await confirm.last().click();
}

async function observePublish(
  page: Page,
  declaration: FaultDeclaration,
): Promise<PublishObservation> {
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
}

async function assertFailureFeedback(
  page: Page,
  declaration: FaultDeclaration,
): Promise<void> {
  const { userVisibleMessage, statusRole } = declaration.expectation;
  const feedback = page
    .locator(`[role="${statusRole}"], [data-sonner-toast]`)
    .filter({ hasText: userVisibleMessage })
    .last();
  await expect(feedback).toBeVisible();
}

async function recover(
  page: Page,
  declaration: FaultDeclaration,
): Promise<ReportState> {
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
      expect(response.status()).toBeLessThan(400);
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
}

function assertUnchanged(before: ReportState, after: ReportState): void {
  expect({
    periodState: after.periodState,
    periodStatus: after.periodStatus,
    status: after.status,
  }).toEqual({
    periodState: before.periodState,
    periodStatus: before.periodStatus,
    status: before.status,
  });
  expect(after).toEqual(before);
}

if (PROFILE === "full")
  test.describe("runtime controlled fault recovery", () => {
    test.afterEach(async () => {
      await resetMutations();
    });

    for (const declaration of FAULT_DECLARATIONS) {
      test(`${declaration.id} keeps publish non-mutating and recoverable`, async ({
        page,
      }, testInfo) => {
        await loginByCookie(page, { role: "head", redirect: REPORT_PATH });
        const before = await reportState();

        const observation = await withFault(page, declaration, () =>
          observePublish(page, declaration),
        );
        expect(observation.request.url()).toMatch(/\/trpc\/period\.publish/u);
        if (declaration.response === null) {
          expect(observation.failure).not.toBeNull();
        } else {
          expect(observation.response?.status()).toBe(
            declaration.response.status,
          );
        }
        assertUnchanged(before, await reportState());
        await assertFailureFeedback(page, declaration);
        await testInfo.attach(`${declaration.id}-failure.png`, {
          body: await page.screenshot({ fullPage: true }),
          contentType: "image/png",
        });

        const recovered = await recover(page, declaration);
        if (declaration.expectation.recovery === "retry") {
          expect(recovered).toMatchObject({
            status: "published",
            periodState: "published",
            periodStatus: "published",
          });
          expect(recovered.publishedAt).not.toBeNull();
          expect(recovered.publishedById).not.toBeNull();
        } else {
          assertUnchanged(before, recovered);
          await expect(
            page.getByRole("button", { name: /publish.*lock/i }),
          ).toBeVisible();
        }
      });
    }
  });
