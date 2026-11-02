import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@weeklyreport/ui/components/ui/dropdown-menu";
import { Check, Tags } from "lucide-react";
import { useRef, useState } from "react";

import { shortItemLabel } from "../../../shared/lib/format/short-label";
import {
  type ActionProps,
  identityOf,
  MENU_ITEM_CLASS,
  ROW_BUTTON_CLASS,
} from "./status-overview-item-actions";

export function canSetStages({
  item,
  onSetStages,
  ownedStages,
}: ActionProps): boolean {
  return Boolean(
    onSetStages &&
    ownedStages &&
    item.editTarget &&
    item.source !== "previous" &&
    !item.editTarget.focusNextStep &&
    !item.needsConfirmation,
  );
}

export function StageControl(props: ActionProps) {
  const { item, onSetStages, ownedStages = [] } = props;
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  if (!canSetStages(props) || !onSetStages) return null;
  const focusKey = `stage:${item.source}:${identityOf(item)}`;
  const label = `Stages for ${shortItemLabel(item.text)}`;
  const toggle = async (name: string) => {
    if (pending) return;
    const next = item.stageNames.includes(name)
      ? item.stageNames.filter((stage) => stage !== name)
      : [...item.stageNames, name];
    if (next.length === 0) return;
    setPending(true);
    try {
      setError((await onSetStages(item, next, focusKey)) ?? null);
    } catch {
      setError("Could not update stages. Try again.");
    } finally {
      setPending(false);
      trigger.current?.focus();
    }
  };
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          ref={trigger}
          type="button"
          aria-label={label}
          title={label}
          data-overview-focus={focusKey}
          className={ROW_BUTTON_CLASS}
        >
          <Tags aria-hidden="true" className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onFocusOutside={(event) => {
          if (event.target === trigger.current) event.preventDefault();
        }}
      >
        {ownedStages.map((name) => {
          const checked = item.stageNames.includes(name);
          return (
            <DropdownMenuItem
              key={name}
              role="menuitemcheckbox"
              aria-checked={checked}
              disabled={pending || (checked && item.stageNames.length === 1)}
              onSelect={(event) => {
                event.preventDefault();
                void toggle(name);
              }}
              className={MENU_ITEM_CLASS}
            >
              <span className="w-4">
                {checked ? (
                  <Check aria-hidden="true" className="size-4" />
                ) : null}
              </span>
              {name}
            </DropdownMenuItem>
          );
        })}
        {item.stageNames.length === 1 ? (
          <p className="px-2 py-1 text-xs text-[var(--color-muted-foreground)]">
            A Product item keeps at least one stage
          </p>
        ) : null}
        {error ? <StageError message={error} /> : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function StageError({ message }: { readonly message: string }) {
  return (
    <p
      role="alert"
      className="px-2 py-1 text-sm text-[var(--color-destructive)]"
    >
      {message}
    </p>
  );
}
