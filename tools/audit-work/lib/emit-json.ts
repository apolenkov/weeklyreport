/**
 * emit-json — machine-readable ledger mirroring the markdown report.
 * Schema (consumed by future resume tooling):
 *   { audit_date, repo, scan_scope, counts, items[], retro{good,bad,learned}, decisions[] }
 */

import { STATUS_ORDER } from './types.ts';
import type { AuditItem, Decision, RetroEntry, ScanResult, Status } from './types.ts';
import { redact } from './redact.ts';

export interface AuditJson {
  audit_date: string;
  repo: string;
  since: string;
  scan_scope: {
    claude_files: number;
    claude_lines: number;
    codex_repo_files: number;
    codex_files_scanned: number;
    planning_key_files: number;
    memory_files: number;
    branch_commits: number;
  };
  counts: Record<Status, number> & { retro: number; decisions: number };
  items: Array<{
    id: string;
    title: string;
    status: Status;
    secondary: Status[];
    session_id: string;
    first_mention: string | null;
    last_touch: string | null;
    distinct_sessions: number;
    mentions: number;
    recommendation: string;
  }>;
  retro: { good: string[]; bad: string[]; learned: string[] };
  decisions: Array<{ date: string; session: string; text: string }>;
}

export function emitJson(
  scan: ScanResult,
  items: AuditItem[],
  retro: RetroEntry[],
  decisions: Decision[],
): AuditJson {
  const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<Status, number>;
  for (const item of items) counts[item.status] += 1;

  return {
    audit_date: new Date().toISOString().slice(0, 10),
    repo: 'customreport',
    since: scan.since,
    scan_scope: {
      claude_files: scan.claude.files,
      claude_lines: scan.claude.lines,
      codex_repo_files: scan.codex.repoFiles,
      codex_files_scanned: scan.codex.filesScanned,
      planning_key_files: scan.planning.keyFiles,
      memory_files: scan.memory.files,
      branch_commits: scan.git.commits.length,
    },
    counts: { ...counts, retro: retro.length, decisions: decisions.length },
    items: items.map((i) => ({
      id: i.id,
      title: redact(i.title),
      status: i.status,
      secondary: i.secondary,
      session_id: redact(i.sessionId),
      first_mention: i.firstMention,
      last_touch: i.lastTouch,
      distinct_sessions: i.distinctSessions,
      mentions: i.mentions,
      recommendation: redact(i.recommendation),
    })),
    retro: {
      good: retro.filter((r) => r.kind === 'good').map((r) => r.text),
      bad: retro.filter((r) => r.kind === 'bad').map((r) => r.text),
      learned: retro.filter((r) => r.kind === 'learned').map((r) => r.text),
    },
    decisions: decisions.map((d) => ({ date: d.date, session: d.session, text: d.text })),
  };
}
