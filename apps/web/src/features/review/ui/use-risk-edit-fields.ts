import { useRef, useState } from "react";

interface UseRiskEditFieldsArgs {
  readonly initialText?: string;
  readonly initialImpact?: string;
  readonly initialMitigation?: string;
}

interface RiskEditProseErrors {
  text?: string;
  impact?: string;
  mitigation?: string;
}

/**
 * The risk dialog's three prose fields (text/impact/mitigation): value state,
 * per-field error state that self-clears on edit, and the a11y refs used to
 * move focus to the first invalid field after a failed save. `setFieldErrors`
 * replaces the whole error set at once (mirrors a fresh validation pass), the
 * same way each per-field change handler only clears its own key.
 */
export function useRiskEditFields({
  initialText,
  initialImpact,
  initialMitigation,
}: UseRiskEditFieldsArgs) {
  const [text, setText] = useState(initialText ?? "");
  const [impact, setImpact] = useState(initialImpact ?? "");
  const [mitigation, setMitigation] = useState(initialMitigation ?? "");
  const [errors, setErrors] = useState<RiskEditProseErrors>({});

  // a11y (validation-focus): refs for the three local textareas so a failed
  // save can move focus to the first invalid field instead of stranding it
  // on Save.
  const textRef = useRef<HTMLTextAreaElement>(null);
  const impactRef = useRef<HTMLTextAreaElement>(null);
  const mitigationRef = useRef<HTMLTextAreaElement>(null);

  /**
   * Moves focus to the first invalid prose field, in validated order.
   * Returns whether it found one, so the caller knows whether to fall
   * through to the next field group (the stage checkboxes).
   */
  function focusFirstInvalid(fieldErrors: RiskEditProseErrors): boolean {
    if (fieldErrors.text) {
      textRef.current?.focus();
      return true;
    }
    if (fieldErrors.impact) {
      impactRef.current?.focus();
      return true;
    }
    if (fieldErrors.mitigation) {
      mitigationRef.current?.focus();
      return true;
    }
    return false;
  }

  return {
    text,
    onTextChange: (v: string) => {
      setText(v);
      setErrors((prev) => ({ ...prev, text: undefined }));
    },
    textError: errors.text,
    textRef,
    impact,
    onImpactChange: (v: string) => {
      setImpact(v);
      setErrors((prev) => ({ ...prev, impact: undefined }));
    },
    impactError: errors.impact,
    impactRef,
    mitigation,
    onMitigationChange: (v: string) => {
      setMitigation(v);
      setErrors((prev) => ({ ...prev, mitigation: undefined }));
    },
    mitigationError: errors.mitigation,
    mitigationRef,
    setFieldErrors: setErrors,
    focusFirstInvalid,
  };
}
