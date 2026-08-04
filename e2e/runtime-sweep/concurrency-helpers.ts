import {
  type Browser,
  expect,
  type Page,
  type Request,
  type Route,
} from "@playwright/test";

import { ACTIVE_REPORT_ID, LEAD_OLGA_ID } from "../../prisma/seed-constants.ts";
import { prisma } from "../integration/helpers/db.ts";
import { loginByCookie } from "../sweep/helpers/dev-auth.ts";

const SAVE_DRAFT_ROUTE = "**/trpc/reports.saveDraft**";
const WINNING_TEXT = "Runtime sweep stale-version winner item";
export const LOSING_TEXT = "Runtime sweep stale-version loser item";
export const CONFLICT_FEEDBACK =
  "This section was changed elsewhere. Reloaded the latest version — re-apply your changes and save again.";
const SUCCESS_STATUS = 200;
const CONFLICT_STATUS = 409;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const isUnknownArray = (value: unknown): value is readonly unknown[] =>
  Array.isArray(value);

function unwrapInput(value: unknown): Readonly<Record<string, unknown>> | null {
  if (Array.isArray(value)) return unwrapInput(value.at(0));
  if (!isRecord(value)) return null;
  if ("0" in value) return unwrapInput(value["0"]);
  if ("json" in value) return unwrapInput(value.json);
  return value;
}

function saveDraftObservation(request: Request, stableId: string) {
  const parsed: unknown = JSON.parse(request.postData() ?? "null");
  const input = unwrapInput(parsed);
  if (!input) throw new TypeError("saveDraft request input is not an object");
  const { reportSectionId, version, items } = input;
  if (
    typeof reportSectionId !== "string" ||
    typeof version !== "number" ||
    !isUnknownArray(items)
  ) {
    throw new TypeError(
      "saveDraft request is missing section, version, or items",
    );
  }
  const item = items.find(
    (candidate) => isRecord(candidate) && candidate.stableId === stableId,
  );
  if (!isRecord(item) || typeof item.text !== "string") {
    throw new TypeError("saveDraft request omitted the target stable item");
  }
  return { reportSectionId, version, stableId, text: item.text };
}

const isSaveDraftRequest = (request: Request): boolean =>
  request.method() === "POST" &&
  request.url().includes("/trpc/reports.saveDraft");

async function installSaveDraftGate(page: Page) {
  const seen = Promise.withResolvers<Request>();
  const released = Promise.withResolvers<void>();
  const handler = async (route: Route): Promise<void> => {
    seen.resolve(route.request());
    await released.promise;
    await route.continue();
  };
  await page.route(SAVE_DRAFT_ROUTE, handler);
  return {
    request: seen.promise,
    release: () => released.resolve(),
    remove: () => page.unroute(SAVE_DRAFT_ROUTE, handler),
  };
}

async function editFirstItem(
  page: Page,
  initialText: string,
  nextText: string,
) {
  const targetCard = page
    .getByTestId("item-card")
    .filter({ hasText: initialText })
    .first();
  const edit = targetCard.getByRole("button", { name: "Edit", exact: true });
  await expect(edit).toBeVisible({ timeout: 15_000 });
  await edit.click();
  const dialog = page.getByRole("dialog", { name: "Edit Item dialog" });
  const description = dialog.getByRole("textbox", {
    name: /^Description \*$/,
  });
  await expect(description).toHaveValue(initialText);
  await description.fill(nextText);
  await dialog.getByRole("button", { name: "Save Item", exact: true }).click();
  await expect(dialog).toBeHidden();
}

function loginOlga(page: Page): Promise<void> {
  return loginByCookie(page, {
    role: "lead",
    email: "olga@customreport.local",
    redirect: `/lead/report/${ACTIVE_REPORT_ID}`,
  });
}

async function forceDraftSave(page: Page): Promise<void> {
  const save = page
    .getByRole("button", { name: "Save draft now", exact: true })
    .first();
  await expect(save).toBeEnabled({ timeout: 15_000 });
  await save.click();
}

const saveDraftResponse = (page: Page) =>
  page.waitForResponse((response) => isSaveDraftRequest(response.request()));

async function queryInitialSection() {
  const initial = await prisma.reportSection.findUniqueOrThrow({
    where: {
      reportId_authorId: { reportId: ACTIVE_REPORT_ID, authorId: LEAD_OLGA_ID },
    },
    select: {
      id: true,
      version: true,
      items: {
        orderBy: { createdAt: "asc" },
        select: { id: true, stableId: true, text: true },
      },
    },
  });
  const initialItem = initial.items.at(0);
  if (!initialItem) throw new TypeError("Olga lead section has no seeded item");
  return { initial, initialItem };
}

type InitialState = Awaited<ReturnType<typeof queryInitialSection>>;
type SaveDraftGate = Awaited<ReturnType<typeof installSaveDraftGate>>;
type DraftInput = ReturnType<typeof saveDraftObservation>;

const expectedDraft = (initial: InitialState, text: string): DraftInput => ({
  reportSectionId: initial.initial.id,
  version: initial.initial.version,
  stableId: initial.initialItem.stableId,
  text,
});

export async function openPages(browser: Browser, baseURL: string | undefined) {
  if (typeof baseURL !== "string") {
    throw new TypeError(
      "Concurrency cell requires the Playwright project baseURL",
    );
  }
  const [first, second] = await Promise.all([
    browser.newPage({ baseURL }),
    browser.newPage({ baseURL }),
  ]);
  const [firstGate, secondGate] = await Promise.all([
    installSaveDraftGate(first),
    installSaveDraftGate(second),
  ]);
  return { first, second, firstGate, secondGate };
}

export async function prepareConcurrentEdits(
  first: Page,
  second: Page,
  initialText: string,
): Promise<void> {
  await Promise.all([loginOlga(first), loginOlga(second)]);
  await Promise.all([
    editFirstItem(first, initialText, WINNING_TEXT),
    editFirstItem(second, initialText, LOSING_TEXT),
  ]);
  await Promise.all([forceDraftSave(first), forceDraftSave(second)]);
}

export async function captureInputs(
  firstGate: SaveDraftGate,
  secondGate: SaveDraftGate,
  initial: InitialState,
): Promise<{ readonly first: DraftInput; readonly second: DraftInput }> {
  const [firstRequest, secondRequest] = await Promise.all([
    firstGate.request,
    secondGate.request,
  ]);
  const first = saveDraftObservation(
    firstRequest,
    initial.initialItem.stableId,
  );
  const second = saveDraftObservation(
    secondRequest,
    initial.initialItem.stableId,
  );
  expect(first).toEqual(expectedDraft(initial, WINNING_TEXT));
  expect(second).toEqual(expectedDraft(initial, LOSING_TEXT));
  return { first, second };
}

export async function releaseWrites({
  first,
  second,
  firstGate,
  secondGate,
}: {
  readonly first: Page;
  readonly second: Page;
  readonly firstGate: SaveDraftGate;
  readonly secondGate: SaveDraftGate;
}) {
  const firstResponsePromise = saveDraftResponse(first);
  firstGate.release();
  const firstResponse = await firstResponsePromise;
  expect(firstResponse.status()).toBe(SUCCESS_STATUS);

  const replayObserved = second
    .waitForRequest(isSaveDraftRequest, { timeout: 2000 })
    .then(
      () => true,
      () => false,
    );
  const secondResponsePromise = saveDraftResponse(second);
  secondGate.release();
  const secondResponse = await secondResponsePromise;
  expect(secondResponse.status()).toBe(CONFLICT_STATUS);
  expect(await secondResponse.text()).toContain("CONFLICT");
  return { firstResponse, secondResponse, replayObserved };
}

export async function assertConflictFeedback(
  second: Page,
  replayObserved: Promise<boolean>,
): Promise<void> {
  const feedback = second
    .locator('[role="status"], [role="alert"], [data-sonner-toast]')
    .filter({ hasText: CONFLICT_FEEDBACK })
    .last();
  await expect(feedback).toBeVisible({ timeout: 15_000 });
  expect(await replayObserved).toBe(false);
}

export async function assertPersisted(initial: InitialState) {
  const persisted = await prisma.reportSection.findUniqueOrThrow({
    where: { id: initial.initial.id },
    select: {
      version: true,
      items: { select: { id: true, stableId: true, text: true } },
    },
  });
  const persistedItem = persisted.items.find(
    (item) => item.stableId === initial.initialItem.stableId,
  );
  expect(persisted.version).toBe(initial.initial.version + 1);
  expect(persistedItem?.text).toBe(WINNING_TEXT);
  expect(persisted.items.some((item) => item.text === LOSING_TEXT)).toBe(false);
  return { persisted, persistedItem };
}

export async function assertConverged(
  first: Page,
  second: Page,
): Promise<void> {
  await Promise.all([
    first.reload({ waitUntil: "domcontentloaded" }),
    second.reload({ waitUntil: "domcontentloaded" }),
  ]);
  await Promise.all([
    expect(
      first.getByText(WINNING_TEXT, { exact: true }).first(),
    ).toBeVisible(),
    expect(
      second.getByText(WINNING_TEXT, { exact: true }).first(),
    ).toBeVisible(),
  ]);
  await Promise.all([
    expect(first.getByText(LOSING_TEXT, { exact: true })).toHaveCount(0),
    expect(second.getByText(LOSING_TEXT, { exact: true })).toHaveCount(0),
  ]);
}

export async function loadInitialSection() {
  return queryInitialSection();
}
