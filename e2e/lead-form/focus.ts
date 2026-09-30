import assert from "node:assert/strict";

import { command } from "./browser.js";

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
      const data = await command(
        [
          "eval",
          `(() => { const nameOf = element => element?.getAttribute('aria-label') ?? element?.textContent?.trim() ?? ''; const active = document.activeElement; const matches = Array.from(document.getElementsByTagName('button')).filter(button => nameOf(button) === ${JSON.stringify(name)}); return { activeTag: active?.tagName, activeName: nameOf(active).slice(0, 160), expectedControlCount: matches.length, expectedControls: matches.map(button => ({ connected: button.isConnected, visible: button.checkVisibility() })) }; })()`,
        ],
        session,
      );
      error.message += `\nFocus diagnostic: ${JSON.stringify(data.result)}`;
    }
    throw error;
  });
  const data = await command(["eval", activeName], session);
  assert.equal(data.result, name);
}
