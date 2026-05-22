#!/usr/bin/env -S node --experimental-strip-types
/**
 * accumulated-work-audit — entry point.
 *
 * Forensic scan of Claude transcripts, Codex sessions, `.planning` ledgers,
 * memory and git; classifies every recovered unit into one of 9 buckets and
 * writes paired markdown + JSON reports to `.planning/audits/`.
 *
 * Run: `pnpm audit-work` (or `/goal goals/accumulated-work-audit/goal.md`).
 * Flags: --repo <path> · --since <YYYY-MM-DD> · --out-dir <dir>
 *
 * Read-only: writes only under `.planning/audits/`, never state files.
 */

import fs from 'node:fs';
import path from 'node:path';
import { runScan } from './lib/scan-engine.ts';
import { buildItems } from './lib/status-classifier.ts';
import { aggregateRetro } from './lib/retro-aggregator.ts';
import { extractDecisions } from './lib/decisions-log.ts';
import { emitMarkdown } from './lib/emit-md.ts';
import { emitJson } from './lib/emit-json.ts';

interface Args {
  repo: string;
  since?: string;
  outDir: string;
}

function parseArgs(argv: string[]): Args {
  const repoDefault = process.cwd();
  const args: Args = { repo: repoDefault, outDir: '' };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--repo') args.repo = argv[++i];
    else if (a.startsWith('--repo=')) args.repo = a.slice(7);
    else if (a === '--since') args.since = argv[++i];
    else if (a.startsWith('--since=')) args.since = a.slice(8);
    else if (a === '--out-dir') args.outDir = argv[++i];
    else if (a.startsWith('--out-dir=')) args.outDir = a.slice(10);
  }
  args.repo = path.resolve(args.repo);
  if (!args.outDir) args.outDir = path.join(args.repo, '.planning', 'audits');
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(args.repo)) {
    console.error('repo does not exist: ' + args.repo);
    process.exit(2);
  }

  const scan = await runScan(args.repo, args.since);
  const items = buildItems(scan);
  const retro = aggregateRetro(scan);
  const decisions = extractDecisions(scan);

  const md = emitMarkdown(scan, items, retro, decisions);
  const json = emitJson(scan, items, retro, decisions);

  const date = json.audit_date;
  fs.mkdirSync(args.outDir, { recursive: true });
  const mdPath = path.join(args.outDir, `accumulated-work-status-${date}.md`);
  const jsonPath = path.join(args.outDir, `accumulated-work-status-${date}.json`);
  fs.writeFileSync(mdPath, md);
  fs.writeFileSync(jsonPath, JSON.stringify(json, null, 2) + '\n');

  process.stderr.write(`[audit] items=${items.length} retro=${retro.length} decisions=${decisions.length}\n`);
  process.stderr.write(`[audit] wrote ${path.relative(args.repo, mdPath)}\n`);
  process.stderr.write(`[audit] wrote ${path.relative(args.repo, jsonPath)}\n`);
  // Echo the summary header line for quick eyeballing.
  const header = md.split('\n').find((l) => l.startsWith('`') && l.includes('DONE'));
  if (header) process.stderr.write('[audit] ' + header.replace(/`/g, '') + '\n');
}

main().catch((err) => {
  console.error(String(err && err.stack ? err.stack : err));
  process.exit(1);
});
