import type {
  AiPromptBundleRead,
  AiPromptContents,
  AiPromptFeatureRead,
} from "@customreport/shared";

type PromptEditorProps = Readonly<{
  feature: AiPromptFeatureRead;
  instructions: AiPromptContents;
  busy: boolean;
  onChange: (slot: keyof AiPromptContents, value: string) => void;
}>;

export function PromptEditor({
  feature,
  instructions,
  busy,
  onChange,
}: PromptEditorProps) {
  return (
    <section className="space-y-3 rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
      <div>
        <h4 className="text-sm font-semibold text-[var(--color-foreground)]">
          Prompts
        </h4>
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          Each full prompt is versioned with the candidate. Expand a prompt to
          edit it; saving creates a new immutable version.
        </p>
      </div>
      {feature.slots.map(({ slot, displayName }) => (
        <details
          key={slot}
          className="rounded border border-[var(--color-border)] p-3"
        >
          <summary className="cursor-pointer text-sm font-semibold text-[var(--color-foreground)]">
            {displayName}
          </summary>
          <textarea
            aria-label={`${displayName} prompt`}
            className="mt-3 min-h-64 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm font-normal focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
            value={instructions[slot]}
            onChange={(event) => onChange(slot, event.target.value)}
            disabled={busy}
          />
        </details>
      ))}
    </section>
  );
}

type PromptHistoryProps = Readonly<{
  history: readonly AiPromptBundleRead[];
  active: AiPromptBundleRead | null;
  selected: AiPromptBundleRead;
  dirty: boolean;
  onSelect: (bundle: AiPromptBundleRead) => void;
}>;

const lifecycleLabel = (lifecycle: AiPromptBundleRead["lifecycle"]): string =>
  lifecycle.charAt(0).toUpperCase() + lifecycle.slice(1);
const HASH_PREVIEW_LENGTH = 8;

export function PromptHistory({
  history,
  active,
  selected,
  dirty,
  onSelect,
}: PromptHistoryProps) {
  return (
    <section className="space-y-3 rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
      <div>
        <h4 className="text-sm font-semibold text-[var(--color-foreground)]">
          Version history
        </h4>
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          Select a retained version to inspect its immutable preview or compare
          its full prompt text with the active version.
        </p>
      </div>
      <div className="space-y-2">
        {history.map((bundle) => (
          <button
            key={bundle.id}
            type="button"
            className={`flex w-full items-center justify-between rounded border px-3 py-2 text-left text-sm ${bundle.id === selected.id ? "border-[var(--color-starbucks-accent)] bg-[var(--color-surface-hover)]" : "border-[var(--color-border)]"}`}
            aria-pressed={bundle.id === selected.id}
            onClick={() => onSelect(bundle)}
          >
            <span>
              Version {bundle.revision} · {lifecycleLabel(bundle.lifecycle)}
            </span>
            {bundle.servingStatus !== "current" && (
              <span className="ml-2 text-xs font-semibold text-amber-700">
                {bundle.servingStatus === "legacy" ? "Legacy" : "Incompatible"}
              </span>
            )}
            <span className="text-xs text-[var(--color-muted-foreground)]">
              {bundle.id === active?.id
                ? "Active"
                : bundle.effectiveContentHash.slice(0, HASH_PREVIEW_LENGTH)}
            </span>
          </button>
        ))}
      </div>
      {active && selected.id !== active.id && (
        <PromptDiff active={active} selected={selected} dirty={dirty} />
      )}
    </section>
  );
}

function PromptDiff({
  active,
  selected,
  dirty,
}: Readonly<{
  active: AiPromptBundleRead;
  selected: AiPromptBundleRead;
  dirty: boolean;
}>) {
  const changedSlots = selected.slots
    .filter(
      ({ slot }) =>
        active.promptContents[slot] !== selected.promptContents[slot],
    )
    .map(({ slot }) => slot);
  const sameBehavior = changedSlots.length === 0;

  return (
    <div
      className="rounded bg-[var(--color-surface-hover)] p-3 text-xs text-[var(--color-muted-foreground)]"
      data-testid="ai-prompt-diff"
    >
      {dirty && "Unsaved edits are not included in this comparison. "}
      Changed slots: {changedSlots.join(", ") || "none"}.
      {sameBehavior && " The prompt text matches the active version."}
    </div>
  );
}
