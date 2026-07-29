import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("the installed axe scanner detects planted low-contrast text", async ({
  page,
}) => {
  await page.setContent(`
    <main style="background: #ffffff">
      <p style="color: #b8b8b8">This text is deliberately unreadable.</p>
    </main>
  `);

  const result = await new AxeBuilder({ page }).include("main").analyze();

  expect(result.violations.map((violation) => violation.id)).toContain(
    "color-contrast",
  );
});
