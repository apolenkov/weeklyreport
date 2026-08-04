import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { type ConsoleMessage, type Page, type Request } from "@playwright/test";

import type { CoverageCell } from "./contracts.ts";
import { inventoryDom } from "./dom-inventory.ts";
import type {
  ConsoleRecord,
  PageErrorRecord,
  RequestFailureRecord,
} from "./evidence-types.ts";
export type RuntimeEvents = Readonly<{
  readonly consoleMessages: readonly ConsoleRecord[];
  readonly pageErrors: readonly PageErrorRecord[];
  readonly requestFailures: readonly RequestFailureRecord[];
  readonly detach: () => void;
}>;

export const eventsFor = (page: Page): RuntimeEvents => {
  const consoleMessages: ConsoleRecord[] = [];
  const pageErrors: PageErrorRecord[] = [];
  const requestFailures: RequestFailureRecord[] = [];
  const onConsole = (message: ConsoleMessage): void => {
    if (message.type() !== "error" && message.type() !== "warning") return;
    consoleMessages.push({ type: message.type(), text: message.text() });
  };
  const onPageError = (error: Error): void => {
    pageErrors.push({ message: error.message });
  };
  const onRequestFailed = (request: Request): void => {
    requestFailures.push({
      url: request.url(),
      failure: request.failure()?.errorText ?? null,
    });
  };
  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  page.on("requestfailed", onRequestFailed);
  return {
    consoleMessages,
    pageErrors,
    requestFailures,
    detach: () => {
      page.off("console", onConsole);
      page.off("pageerror", onPageError);
      page.off("requestfailed", onRequestFailed);
    },
  };
};

export const controlEvidence = (
  inventory: Awaited<ReturnType<typeof inventoryDom>>,
  cellId: string,
): CoverageCell["controls"] =>
  inventory.controls.map((control) => ({
    controlKey: control.controlKey,
    cellId,
    ariaRole: control.role,
    accessibleName: control.accessibleName,
    enabled: control.enabled,
    order: control.order,
    actionResult: {
      kind: "not-exercised",
      policy: "unavailable",
      reason: control.enabled
        ? "Navigation-only matrix scaffold; live-control lane must execute each DOM control"
        : "Control is disabled",
    },
  }));

export const writeCell = async (
  archiveRoot: string,
  cell: CoverageCell,
): Promise<void> => {
  const directory = path.join(archiveRoot, "cells", cell.profile, cell.role);
  const root = path.resolve(archiveRoot);
  const filePath = path.resolve(directory, `${cell.cellId}.json`);
  if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`))
    throw new Error(`Runtime matrix cell escaped archive: ${filePath}`);
  await mkdir(directory, { recursive: true });
  await writeFile(filePath, `${JSON.stringify(cell, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
};
