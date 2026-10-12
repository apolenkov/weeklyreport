import assert from "node:assert/strict";

import { command } from "./browser.js";

/** Keep ordinary pointer actions clear of the sticky toolbars. */
export async function centerControl(
  ref: string,
  session?: string,
): Promise<void> {
  await command(["focus", ref], session);
  await command(
    [
      "eval",
      "document.activeElement.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' })",
    ],
    session,
  );
  await command(
    [
      "wait",
      "--fn",
      `(() => {
        const element = document.activeElement;
        const rect = element.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
        return rect.width > 0 && rect.height > 0 && hit !== null && element.contains(hit);
      })()`,
    ],
    session,
  );
}

export async function assertFocused(
  name: string,
  session?: string,
): Promise<void> {
  const activeName =
    "document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent?.trim() ?? ''";
  await command(
    ["wait", "--fn", `(${activeName}) === ${JSON.stringify(name)}`],
    session,
  ).catch(async (error: unknown) => {
    if (error instanceof Error && error.name !== "AbortError") {
      try {
        const data = await command(
          [
            "eval",
            `(() => { const nameOf = element => element?.getAttribute('aria-label') ?? element?.textContent?.trim() ?? ''; const active = document.activeElement; const matches = Array.from(document.getElementsByTagName('button')).filter(button => nameOf(button) === ${JSON.stringify(name)}); return { activeTag: active?.tagName, activeName: nameOf(active).slice(0, 160), expectedControlCount: matches.length, expectedControls: matches.map(button => ({ connected: button.isConnected, visible: button.checkVisibility() })) }; })()`,
          ],
          session,
        );
        error.message += `\nFocus diagnostic: ${JSON.stringify(data.result)}`;
      } catch {
        // Diagnostic failures must preserve the original wait cause.
      }
    }
    throw error;
  });
  const data = await command(["eval", activeName], session);
  assert.equal(data.result, name);
}
