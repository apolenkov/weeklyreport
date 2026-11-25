import { Button } from "@weeklyreport/ui/components/ui/button";
import { GrowingTextarea } from "@weeklyreport/ui/components/ui/growing-textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@weeklyreport/ui/components/ui/popover";
import { useEffect, useRef, useState } from "react";
import {toast} from "sonner";

import type { ItemComposerProps } from "../model/contextual-entry-contract";
import { StageIcon, StageToggles } from "./overview-stages";

export function OverviewEntryLine({
  target,
  view,
  value,
  onChange,
  onSubmit,
  onCancel,
  onDetails,
}: { readonly onDetails: () => void } & ItemComposerProps) {
  const input = useRef<HTMLTextAreaElement>(null);
  const [choosing, setChoosing] = useState(false);
  useEffect(() => {
    input.current?.focus();
  }, []);
  const revision=useRef(0);
  const clear=()=>{
    if(!value.text){onCancel();return;}
    const version=++revision.current;
    const previous=value.text;
    onChange({...value,text:""});
    toast("Entry cleared.",{action:{label:"Undo",onClick:()=>{
      if(!input.current?.isConnected || input.current.value || revision.current!==version){toast.error("Can’t undo: this work changed after that.");return;}
      revision.current++;
      onChange({...value,text:previous});input.current.focus();
    }}});
  };
  const save = () => {
    if (value.text.trim() && !view.pending && view.canSubmit)
      onSubmit("save-and-add-another");
  };

  const placeholder = target.week === "current" ? "What happened…" : "Plan…";
  return (
    <div
      className="grid gap-1"
      onBlur={(event) => {
        if (choosing || event.currentTarget.contains(event.relatedTarget))
          return;
        if (value.text.trim()) save();
        else onCancel();
      }}
    >
      <GrowingTextarea
        ref={input}
        placeholder={placeholder}
        aria-label={`${placeholder} ${target.parent.name}`}
        value={value.text}
        disabled={view.pending}
        className="min-h-11 rounded-md bg-transparent px-2 py-1 text-sm focus-visible:ring-1 focus-visible:ring-ring"
        onChange={(event) => {revision.current++;onChange({ ...value, text: event.target.value });}}
        onKeyDown={(event) => {
          if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            save();
          }
          if (event.key === "Escape") {
            event.stopPropagation();
            clear();
          }
        }}
      />
      {value.text.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {target.parent.kind === "product" &&
            view.eligibleStages.length > 1 && (
              <EntryStages
                {...{ choosing, setChoosing, value, view, onChange }}
              />
            )}
          <Button variant="ghost" onClick={onDetails}>
            More details
          </Button>
          <Button disabled={view.pending} onClick={save}>
            Save
          </Button>
        </div>
      )}
      {Object.entries(view.errors).map(([key, message]) => (
        <p key={key} role="alert">
          {message}
        </p>
      ))}
      {view.message && <p role="alert">{view.message}</p>}
    </div>
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
      <PopoverContent>
        <StageToggles
          selected={value.stageNames}
          owned={view.eligibleStages}
          onChange={(stageNames) => onChange({ ...value, stageNames })}
        />
      </PopoverContent>
    </Popover>
  );
}
