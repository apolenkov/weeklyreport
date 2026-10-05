"use client";

import { type KeyboardEvent, useEffect, useRef } from "react";

import { useDiscardGuard } from "../../../../../shared/ui/dialogs/use-discard-guard";
import { useInlineEditUnloadGuard } from "../../../../report-sections/client";
import { isPlanInputEdited } from "./overview-plan-command";
import {
  ACTIVE_ITEM_CHOICES,
  BUTTON,
  CHOICES,
  type ComposerProps,
  OutcomeChoices,
} from "./overview-plan-composer-fields";

function handleComposerKey(
  event: KeyboardEvent<HTMLFormElement>,
  { pending, onSubmit }: ComposerProps,
  requestClose: () => void,
  canSubmit: boolean,
) {
  if (event.key === "Escape" && !pending) {
    event.preventDefault();
    event.stopPropagation();
    requestClose();
  }
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    if (canSubmit) onSubmit();
  }
}

function OutcomeSaveButton({
  state,
  pending,
  disabled,
}: Pick<ComposerProps, "state" | "pending"> & { readonly disabled: boolean }) {
  if (state.mode !== "restore" && state.fields.outcome === null) return null;
  const label = state.mode === "restore" ? "Restore plan" : "Save outcome";
  return (
    <button
      type="submit"
      disabled={disabled}
      className={`${BUTTON} bg-[var(--color-primary)] font-semibold text-[var(--color-primary-foreground)]`}
    >
      {pending ? "Saving outcome…" : label}
    </button>
  );
}

function ComposerMessages({
  error,
  recoveryReason,
  blockedReason,
}: Pick<ComposerProps, "error" | "recoveryReason" | "blockedReason">) {
  return (
    <>
      {error || recoveryReason ? (
        <p
          role="alert"
          className="break-words text-sm text-[var(--color-destructive)]"
        >
          {error ?? recoveryReason}
        </p>
      ) : null}
      {blockedReason && !recoveryReason ? (
        <p
          role="status"
          className="text-sm text-[var(--color-muted-foreground)]"
        >
          {blockedReason}
        </p>
      ) : null}
    </>
  );
}

function ComposerActions({
  state,
  pending,
  canSubmit,
  onCancel,
}: Pick<ComposerProps, "state" | "pending"> & {
  readonly canSubmit: boolean;
  readonly onCancel: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <OutcomeSaveButton
        state={state}
        pending={pending}
        disabled={!canSubmit}
      />
      <button
        type="button"
        disabled={pending}
        className={BUTTON}
        onClick={onCancel}
      >
        Cancel
      </button>
    </div>
  );
}

export function OverviewPlanComposer(props: ComposerProps) {
  useInlineEditUnloadGuard();
  const firstChoice = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    firstChoice.current?.focus();
  }, []);
  const {
    state,
    pending,
    blockedReason,
    recoveryReason,
    error,
    onChoose,
    onSubmit,
    onCancel,
  } = props;
  const { requestClose, discardDialog } = useDiscardGuard(
    isPlanInputEdited(state),
    onCancel,
    pending,
  );
  const restore = state.mode === "restore";
  const title = restore ? "Restore plan" : "Resolve plan";
  const canSubmit = !pending && !blockedReason && !recoveryReason;
  const choices = state.unitKey === null ? CHOICES : ACTIVE_ITEM_CHOICES;
  return (
    <>
      <form
        aria-label={title}
        className="min-w-0 space-y-3 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] p-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) onSubmit();
        }}
        onKeyDown={(event) =>
          handleComposerKey(event, props, requestClose, canSubmit)
        }
      >
        <p className="break-words text-sm font-semibold">{title}</p>
        <p className="break-words text-sm [overflow-wrap:anywhere]">
          {state.item.text}
        </p>
        <fieldset
          disabled={pending || recoveryReason !== null}
          className="min-w-0 space-y-3"
        >
          {!restore ? (
            <OutcomeChoices
              state={state}
              choices={choices}
              firstChoice={firstChoice}
              onChoose={onChoose}
              onChange={props.onChange}
            />
          ) : (
            <p className="text-sm">
              Restore the state before cancellation. The audit history is
              retained.
            </p>
          )}
        </fieldset>
        <ComposerMessages
          error={error}
          recoveryReason={recoveryReason}
          blockedReason={blockedReason}
        />
        <ComposerActions
          state={state}
          pending={pending}
          canSubmit={canSubmit}
          onCancel={requestClose}
        />
      </form>
      {discardDialog}
    </>
  );
}
