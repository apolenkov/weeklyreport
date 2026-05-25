/**
 * Shared contracts for the accumulated-work-audit tool.
 *
 * Vocabulary mirrors the `Demo-session-scan` skill (RecoveredItem / scan layer)
 * but is self-contained: this tool streams transcripts line-by-line and does
 * not import core-principles `session-evidence.ts`, to stay robust when that
 * checkout is absent and to bound memory on multi-hundred-MB transcripts.
 */

export type Status =
  | 'done'
  | 'in-progress'
  | 'not-started'
  | 'needs-research'
  | 'blocked'
  | 'loops'
  | 'ideas-unfiled';

export const STATUS_ORDER: readonly Status[] = [
  'done',
  'in-progress',
  'not-started',
  'needs-research',
  'blocked',
  'loops',
  'ideas-unfiled',
];

/** Section headers in the markdown report, in emit order. */
export const SECTION_TITLES: Record<Status, string> = {
  done: 'DONE',
  'in-progress': 'IN-PROGRESS',
  'not-started': 'NOT-STARTED',
  'needs-research': 'NEEDS-RESEARCH',
  blocked: 'BLOCKED',
  loops: 'LOOPS',
  'ideas-unfiled': 'IDEAS-UNFILED',
};

/** Per-token aggregate built during the streaming transcript pass. */
export interface MentionAggregate {
  token: string;
  count: number;
  /** distinct transcript files (proxy for distinct sessions) */
  sessions: Set<string>;
  runtimes: Set<string>;
  firstTs: string | null;
  lastTs: string | null;
}

/** A single recovered unit of work / idea / decision candidate. */
export interface AuditItem {
  id: string;
  title: string;
  status: Status;
  secondary: Status[];
  /** representative session/file ref for drill-down */
  sessionId: string;
  firstMention: string | null;
  lastTouch: string | null;
  recommendation: string;
  sources: string[];
  mentions: number;
  /** number of distinct sessions touching this item */
  distinctSessions: number;
}

export interface RetroEntry {
  kind: 'good' | 'bad' | 'learned';
  text: string;
  source: string;
}

export interface Decision {
  date: string;
  session: string;
  text: string;
}

/** Output of the scan layer, consumed by classifier + emitters. */
export interface ScanResult {
  repo: string;
  since: string;
  claude: { files: number; lines: number };
  codex: { filesScanned: number; repoFiles: number; lines: number };
  planning: { files: number; keyFiles: number };
  memory: { files: number };
  git: {
    branch: string;
    status: string;
    lastTag: string;
    branchLog: string;
    recent: string;
    /** branch commits (origin/main..HEAD) newest-first */
    commits: Array<{ date: string; subject: string }>;
  };
  /** token -> aggregate, evidence-anchored later */
  mentions: Map<string, MentionAggregate>;
  /** concatenated evidence text from git + planning + memory + todos */
  evidenceText: string;
  /** raw planning/memory text used by retro + decisions miners */
  ledgerSources: Array<{ file: string; text: string }>;
  /** unchecked / checked checkbox items from NEXT-ACTIONS */
  checkboxes: Array<{ checked: boolean; text: string; file: string }>;
  /** pending todo files */
  todos: Array<{ title: string; file: string }>;
}
