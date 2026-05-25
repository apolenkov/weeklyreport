/**
 * redact — strip credentials / secrets before any text reaches the report.
 * Defence in depth: ledger text is already committed, but a stray token could
 * have been pasted into a handoff. Applied to every emitted free-text field.
 */

const PATTERNS: ReadonlyArray<[RegExp, string]> = [
  [/sk-[A-Za-z0-9_-]{12,}/g, 'sk-REDACTED'],
  [/ghp_[A-Za-z0-9]{20,}/g, 'ghp_REDACTED'],
  [/gh[pousr]_[A-Za-z0-9]{20,}/g, 'gh_REDACTED'],
  [/(password|passwd|secret|token|api[_-]?key)\s*[=:]\s*\S+/gi, '$1=REDACTED'],
  [/(AUTH_[A-Z_]*|DATABASE_URL)\s*=\s*\S+/g, '$1=REDACTED'],
  [/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{6,}/g, 'JWT-REDACTED'],
];

export function redact(text: string): string {
  let out = text;
  for (const [re, repl] of PATTERNS) out = out.replace(re, repl);
  return out;
}
