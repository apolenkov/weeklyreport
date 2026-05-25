# StageMultiSelect: Warning Banner Above + Collapse Enumeration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the stage-scope preview warning to the top of `<StageMultiSelect>` as an alert-style banner with a ⚠ icon, and stop enumerating individual stages in the text when more than one stage is selected.

**Architecture:** Single-file change in `apps/web/src/components/lead/stage-multi-select.tsx`. The warning paragraph that currently lives at the bottom of the fieldset (`<p class="mt-2 text-xs text-amber-700">…`) becomes an `aria-live="polite"` alert-banner sitting directly under the helper paragraph and above the checkbox flex-wrap. The banner gains a border, amber-50 background, amber-800 foreground, and a small alert-triangle SVG. The text logic collapses to three cases by `value.length`: 0 → "All assigned stages…", 1 → "Stage X…", ≥2 → "Selected stages…" (no enumeration of `value.join(", ")`). The banner is only rendered when the multi-checkbox branch is active (`stages.length >= 2`) — for `singleStage` and the empty-state branches it stays hidden. All three call-sites (`risk-edit-dialog.tsx`, `decision-edit-dialog.tsx`, `item-edit-dialog.tsx`) get the new behavior for free; their files are not touched.

**Tech Stack:** React 19, TypeScript 5, Tailwind v4 (project tokens via `var(--…)`), Vitest + @testing-library/react.

---

### Task 1: Extend `stage-multi-select.test.tsx` with banner-behavior tests

**Files:**

- Modify: `apps/web/src/components/lead/stage-multi-select.test.tsx`

- [ ] **Step 1: Append new tests to the existing `describe` block**

Open `apps/web/src/components/lead/stage-multi-select.test.tsx`. Inside the existing `describe("StageMultiSelect", …)`, after the last `it(…)`, append these new tests (do **not** alter the two existing tests — they remain green):

```tsx
it("renders preview-warning as a banner ABOVE the checkbox group", () => {
  const { container } = render(
    <StageMultiSelect
      id="stages"
      value={["Dev"]}
      stages={["Dev", "Testing", "Release"]}
      onChange={vi.fn()}
      previewSeverity="blocked"
    />,
  );

  const banner = screen.getByTestId("stage-scope-banner");
  const checkboxGroup = container.querySelector(
    '[data-testid="stage-checkbox-group"]',
  );
  expect(banner).toBeInTheDocument();
  expect(checkboxGroup).toBeInTheDocument();
  expect(
    banner.compareDocumentPosition(checkboxGroup as Node) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeGreaterThan(0);
});

it("banner is an aria-live alert with role='status'", () => {
  render(
    <StageMultiSelect
      id="stages"
      value={["Dev"]}
      stages={["Dev", "Testing", "Release"]}
      onChange={vi.fn()}
      previewSeverity="blocked"
    />,
  );
  const banner = screen.getByTestId("stage-scope-banner");
  expect(banner.getAttribute("role")).toBe("status");
  expect(banner.getAttribute("aria-live")).toBe("polite");
});

it("text says 'All assigned stages…' when nothing is selected", () => {
  render(
    <StageMultiSelect
      id="stages"
      value={[]}
      stages={["Dev", "Testing", "Release"]}
      onChange={vi.fn()}
      previewSeverity="blocked"
    />,
  );
  expect(
    screen.getByText(/All assigned stages will show as Blocked\.?/i),
  ).toBeInTheDocument();
});

it("text names the single selected stage when exactly one is chosen", () => {
  render(
    <StageMultiSelect
      id="stages"
      value={["Testing"]}
      stages={["Dev", "Testing", "Release"]}
      onChange={vi.fn()}
      previewSeverity="at-risk"
    />,
  );
  expect(
    screen.getByText(/Stage Testing will show as At Risk\.?/i),
  ).toBeInTheDocument();
});

it("text drops enumeration when more than one stage is selected", () => {
  render(
    <StageMultiSelect
      id="stages"
      value={["Dev", "Testing"]}
      stages={["Dev", "Testing", "Release"]}
      onChange={vi.fn()}
      previewSeverity="blocked"
    />,
  );
  expect(
    screen.getByText(/Selected stages will show as Blocked\.?/i),
  ).toBeInTheDocument();
  // The comma-separated list must NOT appear.
  expect(screen.queryByText(/Dev, Testing/)).toBeNull();
});

it("does NOT render the banner when only one assigned stage exists (singleStage branch)", () => {
  render(
    <StageMultiSelect
      id="stages"
      value={["Dev"]}
      stages={["Dev"]}
      onChange={vi.fn()}
      previewSeverity="blocked"
    />,
  );
  expect(screen.queryByTestId("stage-scope-banner")).toBeNull();
});

it("does NOT render the banner when stages list is empty", () => {
  render(
    <StageMultiSelect
      id="stages"
      value={[]}
      stages={[]}
      onChange={vi.fn()}
      previewSeverity="blocked"
    />,
  );
  expect(screen.queryByTestId("stage-scope-banner")).toBeNull();
});
```

- [ ] **Step 2: Run the test file to verify the new tests fail**

Run:

```bash
pnpm --filter @customreport/web vitest run src/components/lead/stage-multi-select.test.tsx
```

Expected: the 2 pre-existing tests PASS; the 7 new tests FAIL (banner test-id does not exist, warning still lives below, enumeration still includes the comma-list).

---

### Task 2: Reshape `stage-multi-select.tsx` — banner on top, collapse enumeration, drop `singleStage`/empty-state warnings

**Files:**

- Modify: `apps/web/src/components/lead/stage-multi-select.tsx`

- [ ] **Step 1: Replace the entire file with the new layout**

Overwrite `apps/web/src/components/lead/stage-multi-select.tsx` with:

```tsx
"use client";

type StageMultiSelectProps = {
  readonly id: string;
  readonly value: string[];
  readonly stages: readonly string[];
  readonly error?: string;
  readonly onChange: (next: string[]) => void;
  /** When provided, shows a consequence-preview banner above the stage chips. */
  readonly previewSeverity?: "at-risk" | "blocked";
};

export function StageMultiSelect({
  id,
  value,
  stages,
  error,
  onChange,
  previewSeverity,
}: StageMultiSelectProps) {
  const selected = value;
  const helperId = `${id}-hint`;
  const errorId = `${id}-error`;

  function toggle(stage: string) {
    const next = selected.includes(stage)
      ? selected.filter((item) => item !== stage)
      : [...selected, stage];
    onChange(next);
  }

  const singleStage = stages.length === 1 ? stages[0] : undefined;
  const isMultiChoice = stages.length >= 2;
  const severityLabel = previewSeverity === "blocked" ? "Blocked" : "At Risk";

  // Banner copy: collapse to a generic line when more than one stage is
  // selected; name the stage when exactly one is selected; default copy when
  // nothing is selected.
  let bannerText = "";
  if (isMultiChoice && previewSeverity) {
    if (selected.length === 0) {
      bannerText = `All assigned stages will show as ${severityLabel}.`;
    } else if (selected.length === 1) {
      bannerText = `Stage ${selected[0]} will show as ${severityLabel}.`;
    } else {
      bannerText = `Selected stages will show as ${severityLabel}.`;
    }
  }

  return (
    <fieldset
      aria-describedby={error ? `${helperId} ${errorId}` : helperId}
      aria-invalid={error ? "true" : "false"}
    >
      <legend className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]">
        SDLC Stages
      </legend>
      <p
        id={helperId}
        className="mb-2 text-[11px] text-[var(--color-muted-foreground)]"
      >
        Optional. Leave empty to apply to all assigned stages. Tip: mark the
        stage as blocked on the SDLC pipeline above before pinning a risk — that
        keeps your blocker scope honest.
      </p>
      {bannerText && (
        <div
          data-testid="stage-scope-banner"
          role="status"
          aria-live="polite"
          className="mb-2 inline-flex items-center gap-2 rounded-[var(--radius)] border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800"
        >
          <AlertTriangleIcon />
          <span>{bannerText}</span>
        </div>
      )}
      {stages.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[rgba(0,0,0,0.18)] bg-[var(--color-muted)] px-3 py-2.5 text-sm text-[var(--color-muted-foreground)]">
          No assigned stages available.
        </div>
      ) : singleStage ? (
        <div className="inline-flex min-h-[34px] items-center rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface-empty)] px-3 py-1 text-xs font-semibold text-[var(--color-muted-foreground)]">
          {singleStage}
          <span className="ml-2 text-[10px] font-medium">
            Applied automatically
          </span>
        </div>
      ) : (
        <div
          data-testid="stage-checkbox-group"
          className="flex flex-wrap gap-2"
        >
          {stages.map((stage) => {
            const checked = selected.includes(stage);
            return (
              <label
                key={stage}
                className={
                  "inline-flex min-h-[34px] items-center gap-2 rounded-[var(--radius-pill)] border px-3 py-1 text-xs font-semibold transition-colors " +
                  (checked
                    ? "border-[var(--color-starbucks-accent)] bg-[var(--color-success)] text-[var(--color-primary)]"
                    : "border-[rgba(0,0,0,0.18)] bg-white text-[var(--color-foreground)] hover:border-[var(--color-starbucks-accent)]")
                }
              >
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-[var(--color-starbucks-accent)]"
                  checked={checked}
                  onChange={() => toggle(stage)}
                />
                {stage}
              </label>
            );
          })}
        </div>
      )}
      {!previewSeverity && selected.length === 0 && isMultiChoice && (
        <p className="mt-2 text-[11px] text-[var(--color-muted-foreground)]">
          Scope: all assigned stages.
        </p>
      )}
      {error && (
        <p
          id={errorId}
          className="mt-1 text-xs text-[var(--color-destructive)]"
        >
          {error}
        </p>
      )}
    </fieldset>
  );
}

function AlertTriangleIcon() {
  return (
    <svg
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

Diff summary vs. current file:

- Removed: bottom `previewSeverity && <p className="mt-2 text-xs text-amber-700">…</p>` paragraph with `value.join(", ")` enumeration.
- Added: `bannerText` derived above the `return`, plus a `role="status"` / `aria-live="polite"` banner rendered between the helper paragraph and the stage list.
- Tightened: the "Scope: all assigned stages." footer now requires `isMultiChoice` so it does not appear in the `singleStage` branch (it never did, but the previous code did not state it explicitly).
- Banner only renders when `isMultiChoice && previewSeverity` and `bannerText` is non-empty.

- [ ] **Step 2: Re-run the test file to verify all 9 tests pass**

Run:

```bash
pnpm --filter @customreport/web vitest run src/components/lead/stage-multi-select.test.tsx
```

Expected: 9 tests PASS (2 pre-existing + 7 new).

- [ ] **Step 3: Run typecheck and the adjacent test suites that consume `StageMultiSelect`**

Run:

```bash
pnpm --filter @customreport/web typecheck
pnpm --filter @customreport/web vitest run \
  src/components/lead/risk-edit-dialog.test.tsx \
  src/components/lead/lead-form-sync-bridge.test.tsx
```

Expected: typecheck PASS; both consumer test files PASS (they assert checkbox behavior, not warning text, so the change is transparent to them).

---

### Task 3: Manual UI verification in the browser

**Files:** None (browser verification only)

- [ ] **Step 1: Ensure the dev stack is running**

If not already running:

```bash
pnpm dev:watch
```

- [ ] **Step 2a: Audit sibling alert/warning patterns BEFORE visual verification**

Run:

```bash
grep -rn 'amber-\|bg-yellow\|border-warning\|role="alert"\|role="status"' \
  apps/web/src/components/lead apps/web/src/components/ui
```

Compare the new banner against any existing warning-block pattern that appears in the same dialogs (`RiskEditDialog`, `ItemEditDialog`, `DecisionEditDialog`, shared form helpers). Expected outcomes:

- If a full-width `bg-amber-*` / `role="alert"` banner pattern already exists in nearby code → switch the new banner from `inline-flex` to a `flex w-full` (or matching class set) so the visual language stays consistent across the dialog.
- If no other warning-banner pattern exists → the inline-flex pill is fine; record this in the commit-message body.

Do **not** ship Task 3 without running this audit; otherwise the banner risks looking inconsistent with the rest of the form vocabulary.

- [ ] **Step 2: Verify RiskEditDialog**

Navigate to `http://localhost:3000/lead/report/a0000000-0000-4000-8000-000000000001`. Open the **Risks** accordion section, click an existing risk (or create a new one) to open the `RiskEditDialog`.

Check the "SDLC Stages" fieldset:

- ⚠ banner with amber background sits **above** the checkbox row, directly under the helper paragraph.
- With zero selected stages → banner says "All assigned stages will show as Blocked."
- With exactly one selected → banner says e.g. "Stage Development will show as Blocked."
- With ≥2 selected → banner says "Selected stages will show as Blocked." (no comma-list).
- The old amber paragraph below the checkboxes is **gone**.

- [ ] **Step 3: Verify ItemEditDialog (Current Week)**

Open the **Current Week** accordion, click any item to open the `ItemEditDialog`. Toggle the item severity to "At Risk" so the stage warning is meaningful; repeat the three-state check (0 / 1 / ≥2 selected) and confirm copy says "At Risk" instead of "Blocked".

- [ ] **Step 4: Sanity-check `decision-edit-dialog.tsx`**

Open the **Decisions** accordion (if any exist) → open an `DecisionEditDialog`. `StageMultiSelect` here typically renders without `previewSeverity`, so the banner must **not** appear; only the checkbox group is visible. Confirm.

- [ ] **Step 5: Capture screenshots**

Capture three screenshots at 1728×962 covering the three banner states (0 / 1 / ≥2 selected). Save under `.planning/notes/stage-warning-banner/` (create the folder if it does not exist).

---

### Task 4: Commit

**Files:** None (commit step only)

- [ ] **Step 1: Stage the changed files**

Run:

```bash
git add \
  apps/web/src/components/lead/stage-multi-select.tsx \
  apps/web/src/components/lead/stage-multi-select.test.tsx \
  .planning/notes/stage-warning-banner
```

- [ ] **Step 2: Create the commit**

Run:

```bash
git commit -m "$(cat <<'EOF'
feat(stage-multi-select): hoist scope warning to a banner above the chips

Moves the "These stages will show as Blocked/At Risk" preview paragraph
out from below the stage checkbox row and into an aria-live="polite"
alert-style banner placed directly under the helper text. Adds an ⚠ icon,
amber-50/amber-200 styling, and tightens copy:

  - 0 selected  → "All assigned stages will show as <Severity>."
  - 1 selected  → "Stage <Name> will show as <Severity>."
  - ≥2 selected → "Selected stages will show as <Severity>."
                  (no comma-list enumeration; the chip row already shows
                  which stages are picked)

The banner only renders when the multi-checkbox branch is active
(stages.length >= 2 && previewSeverity provided). The singleStage and
empty-states keep their existing UI — a banner there would be redundant.

The 1-selected copy is reworded for consistency ("These stages will show
as Blocked: X" → "Stage X will show as Blocked.") so the three banner
states share a single sentence shape.

Minor side-effect: the muted "Scope: all assigned stages." footer
(previewSeverity=undefined branch) is now also gated on
`stages.length >= 2`. Previously it could render in the singleStage
branch when value=[] — defensible to drop, since the lone-stage pill
already explains scope via "Applied automatically".

All consumers (risk-edit-dialog, item-edit-dialog, decision-edit-dialog)
get the new behavior automatically; their files are not touched.
EOF
)"
```

- [ ] **Step 3: Verify the commit landed**

Run:

```bash
git log --oneline -1
git status --short
```

Expected: top commit is the new feature commit; working tree clean for the touched files (modulo pre-existing dirty PRJ-2/UAT evidence files unrelated to this work).

---

## Self-Review

**Spec coverage:**

- ✓ «наверху сделаем такие уведомлялки» → banner rendered above the chip group, styled as an alert-banner with ⚠ icon, amber border + background, `role="status"` + `aria-live="polite"` for screen readers.
- ✓ «везде» → change lives in `stage-multi-select.tsx`; all three consumers (`risk-edit-dialog`, `item-edit-dialog`, `decision-edit-dialog`) inherit the new layout without per-file changes.
- ✓ «не делать перечисление если выбрано >1» → `bannerText` collapses to "Selected stages will show as …" for `selected.length >= 2`; the comma-list is dropped; Task 1 includes an explicit negative assertion (`queryByText(/Dev, Testing/) === null`).

**Scope boundaries kept:**

- The `singleStage` branch is intentionally **excluded** from the banner — the lone-stage pill already explains scope via "Applied automatically".
- The empty-state branch is **excluded** — no stages means no preview is meaningful.
- The `decision-edit-dialog` use-site typically renders without `previewSeverity`; the banner stays hidden there (Task 3 Step 4 sanity-checks this).

**Advisor fixes applied (2026-05-25):**

- Task 3 gains a new Step 2a: mandatory grep audit of sibling `amber-*` / `role="alert"` / `role="status"` patterns in `apps/web/src/components/lead` and `apps/web/src/components/ui`. If a full-width warning-block pattern already exists nearby, the banner must switch from `inline-flex` to a matching `flex w-full` shape so it does not look inconsistent in the same dialog.
- Commit message now explicitly calls out the 1-selected copy reword ("These stages: X" → "Stage X") as an opinionated side-change — was not part of the user's literal request but kept for sentence-shape consistency across the three banner states.
- Acknowledged minor behaviour change: the muted "Scope: all assigned stages." footer no longer renders in the rare `singleStage` + `value=[]` case. Defensible because the lone-stage pill already says "Applied automatically".

**Decision-edit-dialog check:** Task 3 Step 4 reads `decision-edit-dialog.tsx` behaviour; the file passes no `previewSeverity`, so the banner stays hidden there — confirms the new logic does not leak new UI into that dialog.

**Placeholder scan:** no TBD/TODO/"similar to" markers; every step contains the actual code or command.

**Type consistency:** `StageMultiSelectProps` shape is unchanged (same `id`, `value`, `stages`, `error`, `onChange`, `previewSeverity`). No new public props. `data-testid` strings (`stage-scope-banner`, `stage-checkbox-group`) are consistent across test and implementation. `previewSeverity` union (`"at-risk" | "blocked"`) maps to a single `severityLabel` string in one place — no scattered conditionals.
