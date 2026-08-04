import { test } from "@playwright/test";

import { resetMutations } from "../integration/helpers/db.ts";
import { attachConcurrencyEvidence } from "./concurrency-evidence.ts";
import {
  assertConflictFeedback,
  assertConverged,
  assertPersisted,
  captureInputs,
  loadInitialSection,
  openPages,
  prepareConcurrentEdits,
  releaseWrites,
} from "./concurrency-helpers.ts";
import { seedProfileSchema } from "./contracts.ts";

const PROFILE = seedProfileSchema.parse(
  process.env.RUNTIME_SWEEP_PROFILE ?? process.env.E2E_SEED_PROFILE ?? "full",
);
if (PROFILE === "full")
  test.describe("runtime two-context concurrency", () => {
    test.afterEach(async () => {
      await resetMutations();
    });

    test("stale lead edits reject the loser and converge on the winner", async ({
      browser,
    }, testInfo) => {
      const initial = await loadInitialSection();
      const pages = await openPages(browser, testInfo.project.use.baseURL);
      try {
        await prepareConcurrentEdits(
          pages.first,
          pages.second,
          initial.initialItem.text,
        );
        const inputs = await captureInputs(
          pages.firstGate,
          pages.secondGate,
          initial,
        );
        const responses = await releaseWrites({
          first: pages.first,
          second: pages.second,
          firstGate: pages.firstGate,
          secondGate: pages.secondGate,
        });
        await assertConflictFeedback(pages.second, responses.replayObserved);
        const persisted = await assertPersisted(initial);
        await assertConverged(pages.first, pages.second);
        await attachConcurrencyEvidence(
          testInfo,
          initial,
          inputs,
          responses,
          persisted,
        );
      } finally {
        pages.firstGate.release();
        pages.secondGate.release();
        await Promise.all([
          pages.firstGate.remove(),
          pages.secondGate.remove(),
          pages.first.close(),
          pages.second.close(),
        ]);
      }
    });
  });
