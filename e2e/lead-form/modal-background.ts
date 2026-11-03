import assert from "node:assert/strict";

import { command } from "./browser.js";

const DIALOG_TIMEOUT_MS = 10_000;
const DIALOG_POLL_MS = 200;

/** The modal removes background controls from the accessibility tree. */
export async function assertBackgroundSubmissionLocked(): Promise<void> {
  const state = await command([
    "eval",
    `(() => {
      const groups = document.querySelectorAll('[role="group"][aria-label="Header completion actions"]');
      const submit = groups[0]?.querySelector('[data-testid="lead-completion-submit"]');
      return {
        groups: groups.length,
        submits: groups[0]?.querySelectorAll('[data-testid="lead-completion-submit"]').length,
        disabled: submit?.matches(':disabled'),
        hidden: Boolean(submit?.closest('[inert], [aria-hidden="true"]')),
        modal: Boolean(document.querySelector('[role="dialog"][aria-modal="true"]')),
      };
    })()`,
  ]);
  assert.deepEqual(state.result, {
    groups: 1,
    submits: 1,
    disabled: true,
    hidden: true,
    modal: true,
  });
}

/** Inject SPA navigation to test the guard while user controls are modal-hidden. */
export async function injectSlidesNavigation(): Promise<void> {
  const state = await command([
    "eval",
    `(() => {
      const links = Array.from(document.querySelectorAll('[role="group"][aria-label="View mode"] a'))
        .filter(link => new URL(link.href).searchParams.get('mode') === 'slides');
      const link = links[0];
      const hidden = Boolean(link?.closest('[inert], [aria-hidden="true"]'));
      if (links.length === 1 && hidden) setTimeout(() => link.click(), 1500);
      return { links: links.length, hidden };
    })()`,
  ]);
  assert.deepEqual(state.result, { links: 1, hidden: true });
}

export async function waitForBrowserDialog(): Promise<Record<string, unknown>> {
  const deadline = Date.now() + DIALOG_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const dialog = await command(["dialog", "status"]);
    if (dialog.hasDialog === true) return dialog;
    await new Promise((resolve) => setTimeout(resolve, DIALOG_POLL_MS));
  }
  throw new Error("Expected navigation confirmation dialog");
}
