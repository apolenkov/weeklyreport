/**
 * emit-md — render the 9-section markdown report.
 * Output is markdownlint-clean under the repo `.markdownlint.json`:
 * blank lines around headings/lists/fences, single trailing newline, `-`
 * bullets, no trailing punctuation in headings, no wide tables.
 */

import { SECTION_TITLES, STATUS_ORDER } from './types.ts';
import type { AuditItem, Decision, RetroEntry, ScanResult, Status } from './types.ts';
import { redact } from './redact.ts';

function fmtDate(value: string | null): string {
  return value ? value.slice(0, 10) : '—';
}

function countByStatus(items: AuditItem[]): Record<Status, number> {
  const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<Status, number>;
  for (const item of items) counts[item.status] += 1;
  return counts;
}

function pad(value: string, width: number): string {
  return value.length >= width ? value : value + ' '.repeat(width - value.length);
}

export function emitMarkdown(
  scan: ScanResult,
  items: AuditItem[],
  retro: RetroEntry[],
  decisions: Decision[],
): string {
  const date = new Date().toISOString().slice(0, 10);
  const counts = countByStatus(items);
  const good = retro.filter((r) => r.kind === 'good');
  const bad = retro.filter((r) => r.kind === 'bad');
  const learned = retro.filter((r) => r.kind === 'learned');

  const headerCounts =
    STATUS_ORDER.map((s) => `${SECTION_TITLES[s]} ${counts[s]}`).join(' · ') +
    ` · RETRO ${retro.length} · DECISIONS ${decisions.length}`;

  const L: string[] = [];
  L.push(`# Accumulated Work Audit — ${date}`);
  L.push('');
  L.push('Forensic scan of Claude transcripts, Codex sessions, `.planning` ledgers and git.');
  L.push('Read-only: this report modifies no state files.');
  L.push('');
  L.push('`' + headerCounts + '`');
  L.push('');

  // Coverage frame.
  const W = 56;
  L.push('```text');
  L.push('+--- scan coverage ' + '-'.repeat(W - 19) + '+');
  const cov = [
    `claude transcripts   ${scan.claude.files} files / ${scan.claude.lines} lines`,
    `codex sessions       ${scan.codex.repoFiles} repo / ${scan.codex.filesScanned} scanned`,
    `planning ledgers     ${scan.planning.keyFiles} key / ${scan.planning.files} files`,
    `memory files         ${scan.memory.files}`,
    `branch commits       ${scan.git.commits.length} (origin/main..HEAD)`,
    `since floor          ${scan.since}`,
  ];
  for (const line of cov) L.push('| ' + pad(line, W - 2) + '|');
  L.push('+' + '-'.repeat(W) + '+');
  L.push('```');
  L.push('');

  // Status sections.
  for (const status of STATUS_ORDER) {
    const section = items.filter((i) => i.status === status);
    L.push(`## ${SECTION_TITLES[status]} (${section.length})`);
    L.push('');
    if (section.length === 0) {
      L.push('_None detected._');
      L.push('');
      continue;
    }
    for (const item of section) {
      const secondary = item.secondary.length ? ` (+${item.secondary.join(', ')})` : '';
      L.push(`- **${redact(item.title)}** — \`${item.status}\`${secondary}`);
      L.push(`  - id: \`${item.id}\` · session: ${redact(item.sessionId)}`);
      L.push(
        `  - first: ${fmtDate(item.firstMention)} · last: ${fmtDate(item.lastTouch)} · sessions: ${item.distinctSessions} · mentions: ${item.mentions}`,
      );
      L.push(`  - next: ${redact(item.recommendation)}`);
    }
    L.push('');
  }

  // RETRO.
  L.push('## RETRO');
  L.push('');
  for (const [label, list] of [
    ['GOOD', good],
    ['BAD', bad],
    ['LEARNED', learned],
  ] as const) {
    L.push(`### ${label} (${list.length})`);
    L.push('');
    if (list.length === 0) {
      L.push('_None detected._');
      L.push('');
      continue;
    }
    for (const entry of list) L.push(`- ${entry.text} — _${entry.source}_`);
    L.push('');
  }

  // DECISIONS-LOG.
  L.push(`## DECISIONS-LOG (${decisions.length})`);
  L.push('');
  if (decisions.length === 0) {
    L.push('_None detected._');
    L.push('');
  } else {
    for (const d of decisions) {
      L.push(`- ${d.date || '—'} · _${d.session}_ · ${d.text}`);
    }
    L.push('');
  }

  // Strip per-line trailing whitespace (MD009) — ledger text may carry it —
  // and end with a single trailing newline (MD047).
  return (
    L.map((line) => line.replace(/[ \t]+$/, '')).join('\n').replace(/\n+$/, '') + '\n'
  );
}
