// Phase 32-A2 (H-05) — user-content sanitizer for AI prompts.
//
// Lead-authored text (risk/impact/mitigation, current/next-week items,
// risk highlights) is interpolated verbatim into Anthropic user prompts.
// Without sanitization, a lead could embed in-band instructions to
// override the system prompt ("[/SYSTEM]\nNew instructions: ...").
//
// Strategy:
//   - cap length so a 50KB pasted log doesn't blow up the prompt
//   - replace common adversarial role-control tokens with [redacted]
//   - the caller wraps the result in <user_content>...</user_content>
//     so the model treats it as data, not instructions

const MAX_LEN = 2000;

// Each pattern targets a known prompt-injection vector. Case-insensitive
// regex with the global flag so every occurrence is replaced. Order is
// not significant — patterns are independent.
const INJECTION_PATTERNS: ReadonlyArray<RegExp> = [
  // Triple backticks (markdown code-block fence — sometimes used to
  // smuggle instructions past guard rules).
  /```/g,
  // <system> / </system> XML-style tags (some models treat these as
  // role boundaries).
  /<\/?system\b[^>]*>/gi,
  // [INST] / [/INST] (Mistral / Llama-instruct format markers).
  /\[\/?INST\b[^\]]*\]/gi,
  // [SYSTEM] / [/SYSTEM] literal injection markers (mentioned in v6.0
  // review H-05 example).
  /\[\/?SYSTEM\b[^\]]*\]/gi,
  // <|im_start|> / <|im_end|> (ChatML-style boundary tokens).
  /<\|im_(?:start|end)\|>/gi,
  // <|system|>, <|user|>, <|assistant|> (general ChatML role tokens).
  /<\|(?:system|user|assistant)\|>/gi,
  // Anthropic-flavoured role boundary attempts.
  /\b(?:Human|Assistant)\s*:/gi,
];

export function sanitizeUserContent(text: string): string {
  if (text == null) return "";
  let out = String(text);

  // 1. Length cap before regex work to bound CPU on adversarial input.
  if (out.length > MAX_LEN) {
    out = `${out.slice(0, MAX_LEN)} [truncated]`;
  }

  // 2. Replace each adversarial pattern with the [redacted] sentinel.
  for (const pattern of INJECTION_PATTERNS) {
    out = out.replace(pattern, "[redacted]");
  }

  return out;
}
