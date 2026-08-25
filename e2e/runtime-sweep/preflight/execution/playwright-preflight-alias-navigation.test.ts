import { rm } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { buildCampaignSource } from "../../manifest/manifest.ts";
import {
  createManifestFixture,
  fakeManifestGit,
} from "../../manifest/manifest-fixture.ts";
import { runBrowserPreflightSegment } from "./playwright-preflight.ts";

const ORIGIN = "http://127.0.0.1:3205";

describe("preflight alias navigation", () => {
  it("canonicalizes an alias before freezing the reveal inventory", async () => {
    const fixture = await createManifestFixture();
    try {
      const base = await buildCampaignSource(fixture.input, fakeManifestGit());
      const source = base;
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("Fixture has no source state");
      const events: string[] = [];
      let currentUrl = `${ORIGIN}/admin?tab=activities`;
      const route = {
        role: "admin" as const,
        catalogRoute: "/admin/activities",
        resolvedRoute: "/admin/activities",
        landingRoute: "/admin?tab=activities",
        target: "none" as const,
      };
      const harness = {
        expectedOrigin: ORIGIN,
        prepare: () => Promise.resolve(),
        navigate: (entryRoute: string) => {
          events.push(`entry:${entryRoute}`);
          currentUrl = `${ORIGIN}/admin?tab=activities`;
          return Promise.resolve();
        },
        navigateReveal: (landingRoute: string) => {
          events.push(`reveal:${landingRoute}`);
          currentUrl = `${ORIGIN}${landingRoute}`;
          return Promise.resolve();
        },
        currentUrl: () => currentUrl,
        inventory: () => Promise.resolve({ controls: [], issues: [] }),
      };

      await runBrowserPreflightSegment({
        source,
        state,
        route,
        harness,
        resetRequired: true,
      });

      expect(events).toEqual([
        "entry:/admin/activities",
        "reveal:/admin?tab=activities",
      ]);
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });
});
