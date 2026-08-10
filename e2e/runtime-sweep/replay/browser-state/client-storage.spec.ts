import { expect, test } from "@playwright/test";

import { clearClientStorage } from "./client-storage.ts";

test("clears local and session storage without changing the active origin", async ({
  page,
}) => {
  await page.route("http://storage.test/**", (route) =>
    route.fulfill({
      body: "<main>storage fixture</main>",
      contentType: "text/html",
    }),
  );
  await page.goto("http://storage.test/fixture");
  await page.evaluate(() => {
    localStorage.setItem("customreport:lastRole", "head");
    sessionStorage.setItem("runtime-sweep", "stale");
  });

  await clearClientStorage(page);

  const storage = await page.evaluate(() => ({
    local: localStorage.length,
    session: sessionStorage.length,
  }));
  expect(storage).toEqual({ local: 0, session: 0 });
});

test("establishes the configured origin before the first reset", async ({
  page,
}) => {
  await page.route("http://storage.test/**", (route) =>
    route.fulfill({
      body: "<main>storage fixture</main>",
      contentType: "text/html",
    }),
  );
  await clearClientStorage(page, "http://storage.test/");

  expect(page.url()).toBe("http://storage.test/");
});
