import { type RefObject, useRef, useState } from "react";

interface UseRiskEditFieldsArgs {
  readonly initialText?: string | undefined;
  readonly initialImpact?: string | undefined;
  readonly initialMitigation?: string | undefined;
}

interface RiskEditProseErrors {
  text?: string | undefined;
  impact?: string | undefined;
  mitigation?: string | undefined;
}

interface ProseFieldRefs {
  readonly text: RefObject<HTMLTextAreaElement | null>;
  readonly impact: RefObject<HTMLTextAreaElement | null>;
  readonly mitigation: RefObject<HTMLTextAreaElement | null>;
}

// Returns true if a prose field took focus (else the caller tries stages).
// Order mirrors the visual field order, so the first invalid one wins.
function focusFirstInvalidProseField(
  fieldErrors: RiskEditProseErrors,
  refs: ProseFieldRefs,
): boolean {
  const firstInvalid = (["text", "impact", "mitigation"] as const).find(
    (field) => fieldErrors[field],
  );
  if (!firstInvalid) return false;
  refs[firstInvalid].current?.focus();
  return true;
}

export function useRiskEditFields({
  initialText,
  initialImpact,
  initialMitigation,
}: UseRiskEditFieldsArgs) {
  const [text, setText] = useState(initialText ?? "");
  const [impact, setImpact] = useState(initialImpact ?? "");
  const [mitigation, setMitigation] = useState(initialMitigation ?? "");
  const [errors, setErrors] = useState<RiskEditProseErrors>({});

  // a11y: focus first invalid prose field after a failed save.
  const textRef = useRef<HTMLTextAreaElement>(null);
  const impactRef = useRef<HTMLTextAreaElement>(null);
  const mitigationRef = useRef<HTMLTextAreaElement>(null);

  // Typing in a field clears only that field's error.
  const clearError = (field: keyof RiskEditProseErrors) =>
    setErrors((prev) => ({ ...prev, [field]: undefined }));

  return {
    text,
    onTextChange: (v: string) => {
      setText(v);
      clearError("text");
    },
    textError: errors.text,
    textRef,
    impact,
    onImpactChange: (v: string) => {
      setImpact(v);
      clearError("impact");
    },
    impactError: errors.impact,
    impactRef,
    mitigation,
    onMitigationChange: (v: string) => {
      setMitigation(v);
      clearError("mitigation");
    },
    mitigationError: errors.mitigation,
    mitigationRef,
    setFieldErrors: setErrors,
    focusFirstInvalid: (fieldErrors: RiskEditProseErrors) =>
      focusFirstInvalidProseField(fieldErrors, {
        text: textRef,
        impact: impactRef,
        mitigation: mitigationRef,
      }),
  };
}
