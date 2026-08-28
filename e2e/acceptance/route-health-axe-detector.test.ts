import AxeBuilder from "@axe-core/playwright";
import { chromium } from "@playwright/test";
import { expect, test } from "vitest";

test("the route-health axe scanner detects a planted defect", async () => {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.setContent(`
      <main style="background: #ffffff">
        <p style="color: #b8b8b8">This text is deliberately unreadable.</p>
      </main>
    `);

    const result = await new AxeBuilder({ page }).include("main").analyze();

    expect(result.violations.map((violation) => violation.id)).toContain(
      "color-contrast",
    );
  } finally {
    await browser.close();
  }
});
