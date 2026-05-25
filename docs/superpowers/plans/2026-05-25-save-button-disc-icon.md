# Save Button: Disc Icon + Far-Right Position Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the Lead Form `SaveNowButton` to an icon-only floppy-disc button anchored to the far-right edge of `ReportToolbar`, with a spinning overlay while autosave is in flight.

**Architecture:** No new components. The button keeps its 4-state machine (`idle | pending | saving | saved | error`), but renders icons only — disc default, spinner during save, check on success, alert on error. The clickable square stays at the toolbar's `--touch-target-min` (≈44×44) for WCAG AA and visual parity with neighbouring `FillFromButton` / `VersionHistoryNav` / `ArchiveToggle`; the SVG glyph itself is 14×14, centred. Position moves from `leadingExtras` (middle slot) to the tail of `trailingExtras` (last item in the toolbar's right group). All accessibility (`aria-label`, focus ring) and disabled rules are preserved unchanged. The autosave header badge (`Version N · 14:23`) is **intentionally kept** as a separate widget — the user feedback was scoped to the toolbar button. A follow-up commit can remove it if the user prefers a single autosave-status source.

**Tech Stack:** React 19, TypeScript 5, Tailwind v4 (project tokens via `var(--…)`), Vitest + @testing-library/react.

---

### Task 1: Update `SaveNowButton` tests to assert icon-only behavior

**Files:**

- Modify: `apps/web/src/components/report-shell/save-now-button.test.tsx`

- [ ] **Step 1: Read existing test file in full**

The current tests assert label text like `screen.getByText("Saved")`. We are removing visible text; aria-label remains the source of truth. Tests need to switch from text assertions to aria-label assertions and add icon-presence checks.

- [ ] **Step 2: Rewrite the test file**

Replace the entire contents of `apps/web/src/components/report-shell/save-now-button.test.tsx` with:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

import { SaveNowButton } from "./save-now-button";
import type { AutosaveSnapshot } from "../../hooks/use-lead-form-autosave";

function makeSnapshot(
  overrides: Partial<AutosaveSnapshot> = {},
): AutosaveSnapshot {
  return {
    state: "idle",
    lastSavedAt: null,
    dirty: false,
    isInFlight: false,
    forceSave: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("SaveNowButton", () => {
  it("renders aria-label 'Save draft now' in idle and pending states", () => {
    const { rerender } = render(
      <SaveNowButton autosave={makeSnapshot({ state: "idle" })} />,
    );
    expect(
      screen.getByRole("button", { name: /save draft now/i }),
    ).toBeDefined();

    rerender(
      <SaveNowButton
        autosave={makeSnapshot({ state: "pending", dirty: true })}
      />,
    );
    expect(
      screen.getByRole("button", { name: /save draft now/i }),
    ).toBeDefined();
  });

  it("renders no visible label text — icon-only button", () => {
    render(
      <SaveNowButton
        autosave={makeSnapshot({ state: "pending", dirty: true })}
      />,
    );
    // The textual labels from the old pill ("Save now" / "Saving…" / "Saved" /
    // "Retry save") must not appear in the rendered DOM. The aria-label/title
    // attribute carries the accessible name instead.
    expect(screen.queryByText(/save now|saving|saved|retry save/i)).toBeNull();
  });

  it("is enabled only when state is pending or error", () => {
    const { rerender } = render(
      <SaveNowButton
        autosave={makeSnapshot({ state: "pending", dirty: true })}
      />,
    );
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(
      false,
    );

    rerender(
      <SaveNowButton
        autosave={makeSnapshot({ state: "error", dirty: true })}
      />,
    );
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(
      false,
    );

    rerender(<SaveNowButton autosave={makeSnapshot({ state: "idle" })} />);
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(
      true,
    );

    rerender(
      <SaveNowButton
        autosave={makeSnapshot({ state: "saving", isInFlight: true })}
      />,
    );
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("shows spinner icon and aria-label 'Saving draft' while in flight", () => {
    render(
      <SaveNowButton
        autosave={makeSnapshot({ state: "saving", isInFlight: true })}
      />,
    );
    expect(screen.getByRole("button", { name: /saving draft/i })).toBeDefined();
    // Spinner is identified by a stable data attribute.
    expect(screen.getByTestId("save-now-spinner")).toBeDefined();
  });

  it("shows check icon for ~1500ms after success, then reverts to disc + 'Save draft now'", () => {
    const { rerender } = render(
      <SaveNowButton
        autosave={makeSnapshot({ state: "pending", dirty: true })}
      />,
    );

    rerender(
      <SaveNowButton
        autosave={makeSnapshot({
          state: "saved",
          dirty: false,
          isInFlight: false,
        })}
      />,
    );

    expect(screen.getByRole("button", { name: /draft saved/i })).toBeDefined();
    expect(screen.getByTestId("save-now-check")).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    const btn = screen.getByRole("button") as HTMLButtonElement;
    expect(btn.getAttribute("aria-label")).toBe("Save draft now");
    expect(screen.getByTestId("save-now-disc")).toBeDefined();
  });

  it("calls forceSave when clicked in pending state", async () => {
    const forceSave = vi.fn().mockResolvedValue(undefined);
    render(
      <SaveNowButton
        autosave={makeSnapshot({
          state: "pending",
          dirty: true,
          forceSave,
        })}
      />,
    );

    const btn = screen.getByRole("button") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    await act(async () => {
      btn.click();
    });
    expect(forceSave).toHaveBeenCalledOnce();
  });

  it("does not call forceSave when button is disabled (idle state)", () => {
    const forceSave = vi.fn();
    render(
      <SaveNowButton autosave={makeSnapshot({ state: "idle", forceSave })} />,
    );

    const btn = screen.getByRole("button") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    btn.click();
    expect(forceSave).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail against the existing implementation**

Run:

```bash
pnpm --filter @customreport/web vitest run src/components/report-shell/save-now-button.test.tsx
```

Expected: FAIL — the existing button renders text content (`textContent` non-empty), and the new `data-testid` markers do not exist yet.

---

### Task 2: Rewrite `SaveNowButton` as an icon-only square button

**Files:**

- Modify: `apps/web/src/components/report-shell/save-now-button.tsx`

- [ ] **Step 1: Replace the file contents**

Overwrite `apps/web/src/components/report-shell/save-now-button.tsx` with:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";

import type { AutosaveSnapshot } from "../../hooks/use-lead-form-autosave";

const SAVED_REVERT_MS = 1500;

interface SaveNowButtonProps {
  autosave: AutosaveSnapshot;
}

/**
 * Icon-only "Save now" button. Square 28×28, anchored to the toolbar's
 * far-right slot. Renders a floppy-disc icon by default; swaps to a spinner
 * while a save is in flight; flashes a check on success; shows an alert
 * triangle on error.
 *
 * State → icon mapping:
 *   idle / pending          → disc        (enabled only in `pending`)
 *   saving (isInFlight)     → spinner    (disabled)
 *   saved (post-success)    → check      (disabled, reverts after 1500ms)
 *   error                   → alert      (enabled — click retries)
 */
export function SaveNowButton({ autosave }: SaveNowButtonProps) {
  const { state, isInFlight, forceSave } = autosave;

  const [showSaved, setShowSaved] = useState(false);
  const revertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (state === "saved" && !isInFlight) {
      setShowSaved(true);
      if (revertTimerRef.current !== null) {
        clearTimeout(revertTimerRef.current);
      }
      revertTimerRef.current = setTimeout(() => {
        setShowSaved(false);
        revertTimerRef.current = null;
      }, SAVED_REVERT_MS);
    }
  }, [state, isInFlight]);

  useEffect(() => {
    return () => {
      if (revertTimerRef.current !== null) {
        clearTimeout(revertTimerRef.current);
      }
    };
  }, []);

  const isSaving = isInFlight;
  const isEnabled = (state === "pending" || state === "error") && !isSaving;

  let ariaLabel: string;
  if (isSaving) {
    ariaLabel = "Saving draft";
  } else if (showSaved) {
    ariaLabel = "Draft saved";
  } else if (state === "error") {
    ariaLabel = "Retry saving draft";
  } else {
    ariaLabel = "Save draft now";
  }

  function handleClick() {
    if (!isEnabled) return;
    void forceSave();
  }

  return (
    <button
      type="button"
      disabled={!isEnabled}
      onClick={handleClick}
      aria-label={ariaLabel}
      title={ariaLabel}
      className="inline-flex min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-transparent text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {isSaving ? (
        <SpinnerIcon />
      ) : showSaved ? (
        <CheckIcon />
      ) : state === "error" ? (
        <AlertIcon />
      ) : (
        <DiscIcon />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Internal icons
// ---------------------------------------------------------------------------

function DiscIcon() {
  return (
    <svg
      data-testid="save-now-disc"
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      data-testid="save-now-spinner"
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 12 12"
      fill="none"
      style={{ animation: "saveBtnSpin 1s linear infinite" }}
    >
      <style>{`@keyframes saveBtnSpin { to { transform: rotate(360deg); } }`}</style>
      <circle
        cx="6"
        cy="6"
        r="5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="20 11"
        opacity="0.9"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      data-testid="save-now-check"
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 12 12"
      fill="none"
      stroke="var(--color-success,#16a34a)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="2 6 5 9 10 3" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg
      data-testid="save-now-alert"
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
```

- [ ] **Step 2: Run the SaveNowButton tests to verify they pass**

Run:

```bash
pnpm --filter @customreport/web vitest run src/components/report-shell/save-now-button.test.tsx
```

Expected: PASS — all 7 tests green.

---

### Task 3: Move the button from `leadingExtras` to the tail of `trailingExtras` in `lead-form.tsx`

**Files:**

- Modify: `apps/web/src/components/lead/lead-form.tsx:1522` and surrounding `<ReportToolbar …/>` block

- [ ] **Step 0: Confirm no other `<ReportToolbar>` consumer uses `leadingExtras`**

Run:

```bash
grep -n "leadingExtras" apps/web/src/components/head/head-report-shell.tsx
```

Expected: no matches (the head shell only passes `periodNavigator` + `archiveToggle` — confirmed in the current code at `head-report-shell.tsx:96-105`). If any match appears, **stop** and re-scope the task: removing `leadingExtras` from `lead-form.tsx` is safe, but the prop itself must remain in `ReportToolbar`'s typed props.

- [ ] **Step 1: Edit the `<ReportToolbar …/>` invocation**

Open `apps/web/src/components/lead/lead-form.tsx`, locate the `<ReportToolbar …/>` element (around line 1508). Replace the `leadingExtras={…}` and `trailingExtras={…}` props with:

```tsx
<ReportToolbar
  periodNavigator={<PeriodNavigator periods={visiblePeriods} />}
  archiveToggle={
    <>
      <Separator
        orientation="vertical"
        className="h-5 bg-[var(--color-border)]"
      />
      <ArchiveToggle
        checked={showArchivePeriods}
        onChange={setShowArchivePeriods}
      />
    </>
  }
  trailingExtras={
    <>
      <FillFromButton
        periods={periods}
        disabled={isReadOnly || fillFromMut.isPending}
        onFillFrom={handleFillFrom}
      />
      <Separator
        orientation="vertical"
        className="h-5 bg-[var(--color-border)]"
      />
      <VersionHistoryNav
        versions={versions}
        onRestore={isReadOnly ? undefined : handleRestoreVersion}
        onViewVersion={setViewedSnapshotVersion}
        viewedVersion={viewedSnapshotVersion}
      />
      {!isReadOnly && (
        <>
          <Separator
            orientation="vertical"
            className="h-5 bg-[var(--color-border)]"
          />
          <SaveNowButton autosave={autosave} />
        </>
      )}
    </>
  }
/>
```

Important notes:

- The `leadingExtras` prop is removed entirely (no middle slot consumer remains; `ReportToolbar` already tolerates undefined).
- The `SaveNowButton` lives **after** `VersionHistoryNav` with a vertical separator in front of it, putting it visually at the far-right edge of the toolbar's right group.
- The `!isReadOnly` guard is preserved — read-only viewers never see the save button.
- Do not remove or relocate the autosave label badge in the page header (`autosaveLabel` block around line 1395–1433); it is a separate widget.

- [ ] **Step 2: Verify the import for `SaveNowButton` still resolves**

`SaveNowButton` is already imported at `apps/web/src/components/lead/lead-form.tsx:47`. No new import needed. Confirm the import line is unchanged.

- [ ] **Step 3: Run typecheck and the lead-form-adjacent test suites**

Run:

```bash
pnpm --filter @customreport/web typecheck
pnpm --filter @customreport/web vitest run src/components/lead src/components/report-shell
```

Expected: typecheck PASS; vitest PASS for all touched files (no other test references `leadingExtras` for the Lead toolbar).

---

### Task 4: Manual UI verification in the browser

**Files:** None (browser verification only)

- [ ] **Step 1: Start the dev stack**

Run:

```bash
pnpm dev:watch
```

Wait until the web service reports `Ready`.

- [ ] **Step 2: Open the affected page in Chrome**

Navigate to: `http://localhost:3000/lead/report/a0000000-0000-4000-8000-000000000001`

Log in via the dev role switcher as a Lead if the redirect lands on `/auth/dev-login`.

- [ ] **Step 3: Inspect the toolbar visually**

Check:

- The save button is the right-most element inside the toolbar, after `VersionHistoryNav`, with a vertical separator immediately to its left.
- In the default (clean) state the button shows the disc icon and is disabled (40% opacity).
- After typing into any section field, autosave debounces → button briefly shows the spinner, then a green check for ~1.5s, then reverts to the disc.
- Pressing the button manually while it shows the disc + is enabled (pending state) triggers an immediate save.
- Hover/focus reveals the tooltip text from `aria-label` (`Save draft now` / `Saving draft` / `Draft saved` / `Retry saving draft`).

- [ ] **Step 4: Take a screenshot of the toolbar in each state for record**

Capture three screenshots at 1728×962:

1. Default disc (clean).
2. Spinner mid-save (type a character, then take screenshot during the 200–800 ms autosave debounce/in-flight window).
3. Green check immediately after success.

Save under `.planning/notes/save-button-disc/` (create the folder if it does not exist). Keep it under `.planning/` rather than `uat/` — this is a small UI touch-up, not phased regression evidence.

---

### Task 5: Commit

**Files:** None (commit step only)

- [ ] **Step 1: Stage the changed files**

Run:

```bash
git add \
  apps/web/src/components/report-shell/save-now-button.tsx \
  apps/web/src/components/report-shell/save-now-button.test.tsx \
  apps/web/src/components/lead/lead-form.tsx \
  .planning/notes/save-button-disc
```

- [ ] **Step 2: Create the commit**

Run:

```bash
git commit -m "$(cat <<'EOF'
feat(report-shell): icon-only save button, anchored far-right in toolbar

Replaces the text "Save now" pill with a floppy-disc icon button and moves
it to the tail of the toolbar's right group. The button keeps the
--touch-target-min clickable square (≈44×44, WCAG AA + visual parity with
FillFromButton / VersionHistoryNav / ArchiveToggle); the SVG glyph itself
is 14×14, centred. The 4-state machine (idle/pending/saving/saved/error)
is preserved; visible label collapses to icon + aria-label/title tooltip.
Spinner animates while autosave is in flight; green check flashes
~1500 ms on success; alert triangle on error.

Header autosave badge (Version N · HH:MM) intentionally kept — feedback
was scoped to the toolbar button. If a single autosave-status source is
preferred, a follow-up commit can remove the badge.
EOF
)"
```

- [ ] **Step 3: Verify the commit landed**

Run:

```bash
git log --oneline -1
git status --short
```

Expected: top commit is the new feature commit; working tree clean (modulo pre-existing dirty PRJ-2/UAT evidence files unrelated to this work — do not stage or revert those).

---

## Self-Review

**Spec coverage:**

- ✓ «справа самой» → Task 3 anchors the button at the tail of `trailingExtras`, after `VersionHistoryNav`.
- ✓ «в виде дискеты» → Task 2 replaces text with the `DiscIcon` SVG.
- ✓ «только кнопка» → Task 1 asserts `queryByText(/save now|saving|saved|retry save/i) === null`; Task 2 renders icons only.
- ✓ «крутилка когда идёт автосохранение» → existing `SpinnerIcon` reused with `data-testid="save-now-spinner"` and the same `@keyframes saveBtnSpin` animation.

**Advisor fixes applied (2026-05-25):**

- Button size set to `min-h/min-w = var(--touch-target-min)` (≈44×44) instead of a flat 28×28 — keeps visual parity with `FillFromButton` / `VersionHistoryNav` / `ArchiveToggle` and clears WCAG AA tap-target minimum.
- Task 3 Step 0 added: grep confirms `head-report-shell.tsx` does **not** consume `leadingExtras` (only `periodNavigator` + `archiveToggle`), so removing the prop usage from `lead-form.tsx` is safe.
- Header autosave badge (`Version N · HH:MM`) is explicitly kept; the commit message flags it for the user's review.
- Test selector uses `queryByText` instead of `textContent.trim()` so a future `<title>` tooltip inside the SVG would not break the assertion.

**Placeholder scan:** no TBD/TODO/"similar to" markers in any task; every code step contains the actual code.

**Type consistency:** `AutosaveSnapshot`, `forceSave`, `isInFlight`, `state` field names match the existing hook contract (`use-lead-form-autosave.ts` exports `AutosaveSnapshot`); `data-testid` strings are consistent between test and implementation (`save-now-disc`, `save-now-spinner`, `save-now-check`, `save-now-alert`).
