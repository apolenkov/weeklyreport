/**
 * decisions-log — extract locked decisions (what was decided, when, where).
 *
 * Mines two committed sources: `.planning` ledgers/memory and branch git commit
 * subjects with decision language. Each entry is a one-line summary + date +
 * source ref — no verbatim transcript quotes.
 */

import type { Decision, ScanResult } from './types.ts';
import { redact } from './redact.ts';

// Decision markers only. Bare lowercase "drop" (e.g. "drop weekly from header",
// SQL "DROP INDEX") is a code change, not a locked decision — so require the
// ledger convention DROPPED, or explicit lock/decision/default phrasing.
const DECISION_RE =
  /(\bDROPPED\b|\bLOCKED\b|LOCK-\d+|\bUNLOCKED\b|\bрешено\b|решение\s*[:—-]|применя\w* default|\bdefault\s*[:—-]|outcome\s*[:—-]|decision\s*[:—-]|deferred deferred|зафиксир|locked decision|по умолчанию)/i;

const DATE_RE = /(20\d{2}-\d{2}-\d{2})/;
const MAX_LEN = 160;
const CAP = 80;

function dateFromContext(line: string, file: string): string {
  const inLine = line.match(DATE_RE);
  if (inLine) return inLine[1];
  const inFile = file.match(DATE_RE);
  return inFile ? inFile[1] : '';
}

export function extractDecisions(scan: ScanResult): Decision[] {
  const out: Decision[] = [];
  const seen = new Set<string>();

  // 1. Ledger / memory decisions.
  for (const source of scan.ledgerSources) {
    for (const rawLine of source.text.split(/\n/)) {
      const line = rawLine.replace(/^[\s>#*\-+]+/, '').trim();
      if (line.length < 12 || line.length > 400) continue;
      if (line.startsWith('|') || line.startsWith('```')) continue;
      if (!DECISION_RE.test(line)) continue;
      const text = redact(line).slice(0, MAX_LEN);
      const dedupe = text.toLowerCase().slice(0, 60);
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      out.push({
        date: dateFromContext(line, source.file),
        session: source.file,
        text,
      });
      if (out.length >= CAP) break;
    }
    if (out.length >= CAP) break;
  }

  // 2. Branch commit subjects that record a decision.
  for (const commit of scan.git.commits) {
    if (out.length >= CAP) break;
    if (!DECISION_RE.test(commit.subject)) continue;
    const text = redact(commit.subject).slice(0, MAX_LEN);
    const dedupe = text.toLowerCase().slice(0, 60);
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push({ date: commit.date, session: 'git', text });
  }

  // Newest first.
  return out.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}
