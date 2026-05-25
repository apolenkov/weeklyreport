/**
 * retro-aggregator — mine GOOD / BAD / LEARNED signal from committed ledgers.
 *
 * Source is `.planning` memory + RETRO + handoff files (intentional summaries),
 * not raw transcripts — so output carries no verbatim transcript quotes.
 */

import type { RetroEntry, ScanResult } from './types.ts';
import { redact } from './redact.ts';

const GOOD_RE =
  /(✅|\bshipped\b|\bgreen\b|\bPASS\b|\bworking\b|works\b|закрыт|готов|отлично|успешно|landed|all tests pass)/i;
const BAD_RE =
  /(❌|\bfail(ed|s|ure)?\b|провал|блокир|\bbug\b|\bбаг\b|race condition|regression|сломал|TypeError|broke\b|over-?count|false positive)/i;
const LEARNED_RE =
  /(\blearned\b|\bурок\b|выяснил|оказалось|\blesson\b|\bвывод\b|понял что|узнал|gotcha|pitfall|root cause)/i;

const PER_KIND_CAP = 14;
const MIN_LEN = 12;
const MAX_LEN = 160;

function lineMatchesSource(file: string): boolean {
  return /memory\/|RETRO|HANDOFF|handoff|MILESTONE-AUDIT|session-/i.test(file);
}

export function aggregateRetro(scan: ScanResult): RetroEntry[] {
  const out: RetroEntry[] = [];
  const seen = new Set<string>();
  const buckets: Record<RetroEntry['kind'], number> = { good: 0, bad: 0, learned: 0 };

  for (const source of scan.ledgerSources) {
    if (!lineMatchesSource(source.file)) continue;
    for (const rawLine of source.text.split(/\n/)) {
      const line = rawLine.replace(/^[\s>#*\-+]+/, '').trim();
      if (line.length < MIN_LEN || line.length > 400) continue;
      // Skip table rows / code / frontmatter noise.
      if (line.startsWith('|') || line.startsWith('```') || line.includes('://')) continue;

      let kind: RetroEntry['kind'] | null = null;
      if (LEARNED_RE.test(line)) kind = 'learned';
      else if (BAD_RE.test(line)) kind = 'bad';
      else if (GOOD_RE.test(line)) kind = 'good';
      if (!kind) continue;
      if (buckets[kind] >= PER_KIND_CAP) continue;

      const text = redact(line).slice(0, MAX_LEN);
      const dedupe = text.toLowerCase().slice(0, 60);
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      buckets[kind] += 1;
      out.push({ kind, text, source: source.file });
    }
  }
  return out;
}
