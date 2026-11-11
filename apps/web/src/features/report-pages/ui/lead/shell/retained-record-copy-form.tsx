import { Button } from "@weeklyreport/ui/components/ui/button";
import { useId, useState } from "react";

import type {
  Parent,
  StatusOverviewRecordTarget,
} from "../../../../report-sections";
import type { RetainedRecordCopy } from "./retained-record-copy";

interface CopyFormProps {
  readonly copy: RetainedRecordCopy;
  readonly sourceLabel: string;
  readonly sourceReason: string;
  readonly targets: readonly Parent[];
  readonly blockedReason: string | null;
  readonly onOpen: (
    copy: RetainedRecordCopy,
    target: StatusOverviewRecordTarget,
  ) => boolean;
  readonly onDismiss: () => void;
}

function CopyDestination({
  targets,
  value,
  onChange,
}: {
  readonly targets: readonly Parent[];
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        Add to
      </label>
      <select
        id={id}
        name="retained-copy-context"
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[var(--touch-target-min)] w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
      >
        <option value="">Choose a current product or activity</option>
        {targets.map((target) => (
          <option
            key={`${target.kind}:${target.id}`}
            value={`${target.kind}:${target.id}`}
          >
            {target.name} ({target.kind})
          </option>
        ))}
      </select>
      {targets.length === 0 && (
        <p className="text-sm text-[var(--color-muted-foreground)]">
          No eligible product or activity is available in this report.
        </p>
      )}
    </div>
  );
}

function CopySourceDescription({
  copy,
  sourceLabel,
  sourceReason,
  headingId,
}: Pick<CopyFormProps, "copy" | "sourceLabel" | "sourceReason"> & {
  readonly headingId: string;
}) {
  return (
    <>
      <h2
        id={headingId}
        className="text-base font-semibold text-[var(--color-foreground)]"
      >
        Copy retained {copy.kind}
      </h2>
      <p className="text-sm text-[var(--color-muted-foreground)]">
        From your report: {sourceLabel}. The source stays unchanged.
      </p>
      <p className="text-sm text-[var(--color-muted-foreground)]">
        {sourceReason}
      </p>
      <p className="text-sm whitespace-pre-wrap [overflow-wrap:anywhere]">
        {copy.input.text}
      </p>
    </>
  );
}

export function RetainedRecordCopyForm(props: CopyFormProps) {
  const { copy, targets, blockedReason, onOpen, onDismiss } = props;
  const headingId = useId();
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);
  const target = targets.find(
    (candidate) => `${candidate.kind}:${candidate.id}` === selected,
  );
  const open = () => {
    if (blockedReason || !target) return;
    if (
      onOpen(copy, {
        kind: copy.kind,
        unitKind: target.kind,
        unitId: target.id,
      })
    )
      onDismiss();
    else
      setError(
        "The current context changed. Check the report and choose an available product or activity.",
      );
  };
  return (
    <section
      aria-labelledby={headingId}
      className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-4"
    >
      <CopySourceDescription
        headingId={headingId}
        copy={copy}
        sourceLabel={props.sourceLabel}
        sourceReason={props.sourceReason}
      />
      <CopyDestination
        targets={targets}
        value={target ? selected : ""}
        onChange={(value) => {
          setSelected(value);
          setError(null);
        }}
      />
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Review the copied details and current stages in the form. Nothing is
        added until you choose Save.
      </p>
      {blockedReason && (
        <p
          role="status"
          className="text-sm text-[var(--color-muted-foreground)]"
        >
          {blockedReason}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-[var(--color-destructive)]">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={!!blockedReason || !target}
          onClick={open}
        >
          Review copied {copy.kind}
        </Button>
        <Button type="button" variant="outline" onClick={onDismiss}>
          Dismiss copy
        </Button>
      </div>
    </section>
  );
}
