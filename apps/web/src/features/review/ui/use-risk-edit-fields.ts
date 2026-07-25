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

  // Returns true if a prose field took focus (else caller tries stages).
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
