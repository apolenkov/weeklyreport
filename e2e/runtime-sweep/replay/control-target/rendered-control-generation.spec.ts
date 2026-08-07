import type { ElementHandle, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { executeControlAttempt } from "../control-action-executor.ts";
import { executeControlAction } from "../control-actions.ts";
import {
  armRenderedNameHandle,
  beginRenderedNameAction,
  cleanupRenderedNameGuard,
  completeRenderedNameAction,
  releaseRenderedNameTarget,
  type RenderedNameActionLease,
  renderedNameTargetHandle,
} from "./rendered-control-target.ts";

const CONTROL = {
  controlKey: "button:OPEN:1",
  ariaRole: "button",
  accessibleName: "OPEN",
  enabled: true,
} as const;

const requiredTarget = async (
  page: Page,
): Promise<ElementHandle<HTMLElement>> => {
  const target = await renderedNameTargetHandle(page, CONTROL);
  if (target === undefined) throw new Error("Rendered target is missing");
  return target;
};

const requiredLease = async (
  target: ElementHandle<HTMLElement>,
  deadline: number,
): Promise<RenderedNameActionLease> => {
  const lease = await armRenderedNameHandle(target, deadline);
  if (lease === undefined) throw new Error("Rendered target was not armed");
  return lease;
};

const waitAfter = async (
  page: Page,
  deadline: number,
  extraMs: number,
): Promise<void> => {
  await page.evaluate(
    ({ after, extra }) =>
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, Math.max(0, after - Date.now() + extra));
      }),
    { after: deadline, extra: extraMs },
  );
};

const leaveActingGuardInQuarantine = async (
  page: Page,
): Promise<RenderedNameActionLease> => {
  const target = await requiredTarget(page);
  const lease = await requiredLease(target, Date.now() + 150);
  await expect(beginRenderedNameAction(target, lease)).resolves.toBe(true);
  await target.click();
  await target.dispose();
  await waitAfter(page, lease.deadline, 5);
  await expect(
    page.locator("button").evaluate((button) => {
      const guarded = button as HTMLElement & Record<string, unknown>;
      const guard = guarded.__runtimeSweepActionGuard as
        { readonly phase?: string } | undefined;
      return guard?.phase;
    }),
  ).resolves.toBe("invalidated");
  return lease;
};

const startTrustedPointerdown = async (
  page: Page,
): Promise<
  Readonly<{
    lease: RenderedNameActionLease;
    target: ElementHandle<HTMLElement>;
  }>
> => {
  const target = await requiredTarget(page);
  const lease = await requiredLease(target, Date.now() + 150);
  await expect(beginRenderedNameAction(target, lease)).resolves.toBe(true);
  const bounds = await target.boundingBox();
  if (bounds === null) throw new Error("Rendered target has no bounds");
  await page.mouse.move(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  );
  await page.mouse.down();
  await waitAfter(page, lease.deadline, 5);
  return { lease, target };
};

test("an old successful deadline cannot invalidate a new generation", async ({
  page,
}) => {
  await page.setContent(
    '<button type="button"><span style="text-transform: uppercase">Open</span></button>',
  );
  const first = await requiredTarget(page);
  const firstLease = await requiredLease(first, Date.now() + 150);
  await expect(beginRenderedNameAction(first, firstLease)).resolves.toBe(true);
  await first.click();
  await expect(completeRenderedNameAction(first, firstLease)).resolves.toBe(
    true,
  );
  await cleanupRenderedNameGuard(first, firstLease);
  await first.dispose();

  const second = await requiredTarget(page);
  const secondLease = await requiredLease(second, Date.now() + 500);
  await waitAfter(page, firstLease.deadline, 20);

  await expect(beginRenderedNameAction(second, secondLease)).resolves.toBe(
    true,
  );
  await cleanupRenderedNameGuard(second, secondLease);
  await second.dispose();
});

test("rejects re-arm while an old quarantine blocks trusted tail input", async ({
  page,
}) => {
  await page.setContent(`
    <button type="button"><span style="text-transform: uppercase">Open</span></button>
    <output></output>
    <script>
      const button = document.querySelector("button");
      button.addEventListener("pointerdown", (event) => {
        document.body.dataset.pointerdownTrusted = String(event.isTrusted);
      });
      button.addEventListener("click", (event) => {
        document.querySelector("output").textContent = event.isTrusted
          ? "trusted-tail"
          : "untrusted-tail";
      });
    </script>
  `);
  const first = await startTrustedPointerdown(page);
  await expect(page.locator("body")).toHaveAttribute(
    "data-pointerdown-trusted",
    "true",
  );
  const missing = await renderedNameTargetHandle(page, {
    ...CONTROL,
    controlKey: "button:OPEN:2",
  });
  expect(missing).toBeUndefined();
  const second = await requiredTarget(page);
  const rejectedLease = await armRenderedNameHandle(second, Date.now() + 500);

  expect(rejectedLease).toBeUndefined();
  await page.mouse.up();
  await expect(page.locator("output")).toBeEmpty();

  await waitAfter(page, first.lease.deadline, 130);
  await second.dispose();
  const retry = await requiredTarget(page);
  const secondLease = await requiredLease(retry, Date.now() + 500);

  await expect(beginRenderedNameAction(retry, secondLease)).resolves.toBe(true);
  await cleanupRenderedNameGuard(retry, secondLease);
  await first.target.dispose();
  await retry.dispose();
});

test("unselected duplicate discovery preserves another action guard", async ({
  page,
}) => {
  await page.setContent(`
    <button type="button"><span style="text-transform: uppercase">Open</span></button>
    <button type="button"><span style="text-transform: uppercase">Open</span></button>
    <output></output>
    <script>
      document.querySelector("button").addEventListener("click", (event) => {
        document.querySelector("output").textContent = event.isTrusted ? "trusted-tail" : "untrusted-tail";
      });
    </script>
  `);
  const first = await startTrustedPointerdown(page);
  const second = await renderedNameTargetHandle(page, {
    ...CONTROL,
    controlKey: "button:OPEN:2",
  });
  if (second === undefined) throw new Error("Second target is missing");
  await releaseRenderedNameTarget(second);

  await page.mouse.up();
  await expect(page.locator("output")).toBeEmpty();
  await waitAfter(page, first.lease.deadline, 130);
  await first.target.dispose();
});

test("disabled pre-arm cleanup preserves another action guard", async ({
  page,
}) => {
  await page.setContent(`
    <button type="button"><span style="text-transform: uppercase">Open</span></button>
    <output></output>
    <script>
      document.querySelector("button").addEventListener("click", (event) => {
        document.querySelector("output").textContent = event.isTrusted ? "trusted-tail" : "untrusted-tail";
      });
    </script>
  `);
  const first = await startTrustedPointerdown(page);
  await page.locator("button").evaluate((button) => {
    button.setAttribute("aria-disabled", "true");
  });
  const result = await executeControlAction({
    page,
    control: CONTROL,
    action: {
      controlKey: CONTROL.controlKey,
      operation: "click",
      safety: "read-only",
      transition: "none",
    },
    timeoutMs: 100,
  });

  expect(result).toMatchObject({ status: "not-exercised" });
  await page.mouse.up();
  await expect(page.locator("output")).toBeEmpty();
  await waitAfter(page, first.lease.deadline, 130);
  await first.target.dispose();
});

test("a stale quarantine cannot expose a reused node to a wrong action", async ({
  page,
}) => {
  await page.setContent(`
    <button type="button"><span style="text-transform: uppercase">Open</span></button>
    <output></output>
  `);
  await leaveActingGuardInQuarantine(page);
  await page.locator("button").evaluate((button) => {
    if (!(button instanceof HTMLElement)) return;
    button.style.pointerEvents = "none";
    window.setTimeout(() => {
      button.textContent = "Different";
      button.onclick = () => {
        const output = document.querySelector("output");
        if (output !== null) output.textContent = "wrong";
      };
      button.style.pointerEvents = "auto";
    }, 130);
  });
  const target = await requiredTarget(page);

  try {
    const result = await executeControlAttempt(
      {
        page,
        control: CONTROL,
        action: {
          controlKey: CONTROL.controlKey,
          operation: "publish",
          safety: "irreversible",
          transition: "publish",
        },
      },
      { kind: "handle", target },
      350,
    );

    expect(result).toMatchObject({ status: "ambiguous" });
    await expect(page.getByRole("button")).toHaveText("Different");
    await expect(page.locator("output")).toBeEmpty();
    await expect
      .poll(() =>
        page.locator("button").evaluate((button) => {
          const guarded = button as HTMLElement & Record<string, unknown>;
          return {
            guard: "__runtimeSweepActionGuard" in guarded,
            validator: "__runtimeSweepActionValidator" in guarded,
          };
        }),
      )
      .toEqual({ guard: false, validator: false });
  } finally {
    await target.dispose();
  }
});
