import { Button } from "@weeklyreport/ui/components/ui/button";
import { GrowingTextarea } from "@weeklyreport/ui/components/ui/growing-textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@weeklyreport/ui/components/ui/popover";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { ItemComposerProps } from "../model/contextual-entry-contract";
import { StageIcon, StageToggles } from "./overview-stages";

function useClearEntry(
  input: React.RefObject<HTMLTextAreaElement | null>,
  value: ItemComposerProps["value"],
  onChange: ItemComposerProps["onChange"],
  onCancel: ItemComposerProps["onCancel"],
) {
  const revision = useRef(0);
  const clear = () => {
    if (!value.text) {
      onCancel();
      return;
    }
    const version = ++revision.current;
    const previous = value.text;
    onChange({ ...value, text: "" });
    toast("Entry cleared.", {
      action: {
        label: "Undo",
        onClick: () => {
          if (
            !input.current?.isConnected ||
            input.current.value ||
            revision.current !== version
          ) {
            toast.error(
              "Can’t put it back now: save or cancel the entry first.",
            );
            return;
          }
          revision.current++;
          onChange({ ...value, text: previous });
          input.current.focus();
        },
      },
    });
  };
  return {
    changed: () => {
      revision.current++;
    },
    clear,
  };
}

export function entryPlaceholder(week: "current" | "next") {
  return week === "current" ? "What happened…" : "Plan…";
}

export function overviewEntryLabel(name: string, week: "current" | "next") {
  return week === "current"
    ? `Add what happened — ${name}, This week`
    : `Plan something — ${name}, Next week`;
}
function useEntryFocus() {
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const field = input.current;
    if (!field) return;
    field.focus();
    field.setSelectionRange(field.value.length, field.value.length);
  }, []);
  return input;
}

export function OverviewEntryLine({
  target,
  view,
  value,
  onChange,
  onSubmit,
  onCancel,
  onDetails,
}: { readonly onDetails: (origin: HTMLElement) => void } & ItemComposerProps) {
  const input = useEntryFocus();
  const [choosing, setChoosing] = useState(false);
  const { changed, clear } = useClearEntry(input, value, onChange, onCancel);
  const placeholder = entryPlaceholder(target.week);
  const save = () => {
    if (value.text.trim() && !view.pending && view.canSubmit)
      onSubmit("save-and-add-another");
  };

  return (
    <form
      aria-label={`Add item for ${target.parent.name}, ${target.week} week`}
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
      className="grid gap-1"
      onBlur={(event) => {
        if (
          view.pending ||
          view.message ||
          choosing ||
          event.currentTarget.contains(event.relatedTarget) ||
          event.relatedTarget?.closest(
            '[role="tab"],button[aria-controls], [data-sonner-toast], [data-slot="popover-content"]',
          )
        )
          return;
        if (value.text.trim()) save();
        else onCancel();
      }}
    >
      <GrowingTextarea
        ref={input}
        data-overview-focus={`entry:${target.parent.kind}:${target.parent.id}:${target.week}`}
        placeholder={placeholder}
        aria-label={overviewEntryLabel(target.parent.name, target.week)}
        value={value.text}
        disabled={view.pending}
        className="min-h-11 rounded-md bg-transparent px-2 py-1 text-sm focus-visible:ring-1 focus-visible:ring-ring"
        onChange={(event) => {
          changed();
          onChange({ ...value, text: event.target.value });
        }}
        onKeyDown={(event) => entryKey(event, save, clear)}
      />
      {value.text.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {target.parent.kind === "product" &&
            view.eligibleStages.length > 1 && (
              <EntryStages
                {...{ choosing, setChoosing, value, view, onChange }}
              />
            )}
          <Button
            type="button"
            variant="ghost"
            onClick={(event) => onDetails(event.currentTarget)}
          >
            More details
          </Button>
          <Button type="submit" disabled={view.pending}>
            Save
          </Button>
        </div>
      )}
      <EntryErrors view={view} />
    </form>
  );
}

function EntryStages({
  choosing,
  setChoosing,
  value,
  view,
  onChange,
}: Pick<ItemComposerProps, "value" | "view" | "onChange"> & {
  choosing: boolean;
  setChoosing: (open: boolean) => void;
}) {
  const stageName = value.stageNames.join(", ");
  return (
    <Popover open={choosing} onOpenChange={setChoosing}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Stage: ${stageName}`}
          title={`Stage: ${stageName}`}
        >
          <StageIcon name={value.stageNames[0] ?? ""} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        onEscapeKeyDown={(event) => {
          event.stopPropagation();
          setChoosing(false);
        }}
      >
        <StageToggles
          selected={value.stageNames}
          owned={view.eligibleStages}
          onChange={(stageNames) => onChange({ ...value, stageNames })}
        />
      </PopoverContent>
    </Popover>
  );
}

function entryKey(
  event: React.KeyboardEvent<HTMLTextAreaElement>,
  save: () => void,
  clear: () => void,
) {
  if (
    event.key === "Enter" &&
    !event.shiftKey &&
    !event.nativeEvent.isComposing
  ) {
    event.preventDefault();
    event.stopPropagation();
    save();
  }
  if (event.key === "Escape") {
    event.stopPropagation();
    clear();
  }
}

function EntryErrors({ view }: Pick<ItemComposerProps, "view">) {
  return (
    <>
      {Object.entries(view.errors).map(([key, message]) => (
        <p key={key} role="alert">
          {message}
        </p>
      ))}
      {view.message && <p role="alert">{view.message}</p>}
    </>
  );
}
