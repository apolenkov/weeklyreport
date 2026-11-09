import type { ItemComposerProps } from "../model/contextual-entry-contract";
import { useFocusOnMount } from "./use-focus-on-mount";

export const control =
  "min-h-11 w-full min-w-0 rounded border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm";

export type FieldProps = ItemComposerProps & { readonly id: string };
export function fieldHelpers(view: ItemComposerProps["view"], id: string) {
  const error = (field: string) => view.errors[field];
  const describedBy = (field: string) =>
    error(field) ? `${id}-${field}-error` : undefined;
  const fieldError = (field: string) =>
    error(field) ? (
      <p id={`${id}-${field}-error`} className="text-sm text-red-700">
        {error(field)}
      </p>
    ) : null;
  return { error, describedBy, fieldError };
}

export function TextFields(props: FieldProps) {
  const { value, view, onChange, id } = props;
  const description = useFocusOnMount<HTMLTextAreaElement>();
  const { error, describedBy, fieldError } = fieldHelpers(view, id);
  return (
    <>
      <label className="block space-y-1 text-sm">
        Description
        <textarea
          ref={description}
          name="text"
          className={control}
          required
          value={value.text}
          aria-invalid={!!error("text")}
          aria-describedby={describedBy("text")}
          onChange={(event) => onChange({ ...value, text: event.target.value })}
        />
      </label>
      {fieldError("text")}
    </>
  );
}
