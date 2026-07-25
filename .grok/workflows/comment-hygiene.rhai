// comment-hygiene — audit (and optionally fix) CustomReport documentation markers:
// comments, JSDoc, TODO/FIXME/HACK, deferred-feature stubs.
//
// Policy sources (agents MUST follow these, not invent softer rules):
//   docs/exemplary-code-standard.md §1.3
//   openspec/specs/lint-max-strictness-standard (JSDoc public-API-only)
//   openspec/specs/deferred-feature-pattern (TODO(<ref>) + loud stub)
//   openspec change tighten-comment-policy (3-line budget, relocate-first)
//   Agents.md → "Doc / comment / marker hygiene"
//
// Finding families:
//   comment-budget | comment-narration | comment-archaeology
//   comment-relocate-to-spec | jsdoc-on-internal | jsdoc-missing-public
//   | jsdoc-malformed | todo-malformed | todo-stale | fixme-orphan
//
// Args:
//   root       (string, required) — path prefix under the repo, e.g. "apps/api/src/modules/auth"
//   mode       (string) "audit" | "fix" — default "audit" (read-only report)
//   max_files  (int) files to process this run — default 48
//   batch_size (int) files per audit agent — default 8
//   max_verify (int) findings to adversarially verify — default 32
//   max_fix    (int) confirmed findings to fix when mode=fix — default 24
//
// Full-repo coverage = many runs with different roots (or raise max_files + agent_budget).

let meta = #{
    name: "comment-hygiene",
    description: "Audit/fix comments, JSDoc (public API only), and TODO/FIXME markers to the repo doc policy",
    when_to_use: "Clean comments, JSDoc, TODOs/FIXMEs across a folder after mass review, or before exemplary sign-off",
    phases: [
        #{ title: "Inventory", detail: "list in-scope .ts/.tsx files under root" },
        #{ title: "Audit", detail: "parallel shard scanners for comment/JSDoc/TODO policy" },
        #{ title: "Verify", detail: "adversarial verify capped findings (fail-closed)" },
        #{ title: "Fix", detail: "optional apply of confirmed fixes (mode=fix only)" },
        #{ title: "Report", detail: "markdown report + counts by kind" },
    ],
};

// --- schemas -----------------------------------------------------------------

let files_schema = #{
    "type": "object",
    "required": ["files"],
    "properties": #{
        "files": #{
            "type": "array",
            "maxItems": 200,
            "items": #{ "type": "string" },
            "description": "Repo-relative paths to .ts/.tsx product source (no tests, no generated)",
        },
    },
};

let findings_schema = #{
    "type": "object",
    "required": ["findings"],
    "properties": #{
        "findings": #{
            "type": "array",
            "maxItems": 40,
            "items": #{
                "type": "object",
                "required": ["file", "kind", "line", "issue", "action"],
                "properties": #{
                    "file": #{ "type": "string" },
                    "kind": #{
                        "type": "string",
                        "enum": [
                            "comment-budget",
                            "comment-narration",
                            "comment-archaeology",
                            "comment-relocate-to-spec",
                            "jsdoc-on-internal",
                            "jsdoc-missing-public",
                            "jsdoc-malformed",
                            "todo-malformed",
                            "todo-stale",
                            "fixme-orphan",
                        ],
                    },
                    "line": #{ "type": "integer" },
                    "issue": #{ "type": "string" },
                    "action": #{
                        "type": "string",
                        "description": "Concrete fix: delete / compress / relocate / rewrite JSDoc / reformat TODO(ref) / remove stale marker",
                    },
                    "snippet": #{ "type": "string" },
                },
            },
        },
    },
};

let verdict_schema = #{
    "type": "object",
    "required": ["real", "reason", "evidence"],
    "properties": #{
        "real": #{ "type": "boolean" },
        "reason": #{ "type": "string" },
        "evidence": #{ "type": "string" },
    },
};

let fix_schema = #{
    "type": "object",
    "required": ["file", "applied", "notes"],
    "properties": #{
        "file": #{ "type": "string" },
        "applied": #{ "type": "integer" },
        "notes": #{ "type": "string" },
        "skipped": #{
            "type": "array",
            "items": #{ "type": "string" },
        },
    },
};

// --- args --------------------------------------------------------------------

let root = if args == () { () } else { args.root };
if root == () || root == "" {
    pause("verification", "Pass args.root — a repo-relative path prefix, e.g. apps/api/src/modules/auth or packages/shared/src");
}

let mode = "audit";
if args != () && args.mode != () && args.mode != "" {
    mode = args.mode;
}

let max_files = 48;
if args != () && args.max_files != () {
    max_files = args.max_files;
}

let batch_size = 8;
if args != () && args.batch_size != () {
    batch_size = args.batch_size;
}
if batch_size < 1 { batch_size = 1; }
if batch_size > 20 { batch_size = 20; }

let max_verify = 32;
if args != () && args.max_verify != () {
    max_verify = args.max_verify;
}

let max_fix = 24;
if args != () && args.max_fix != () {
    max_fix = args.max_fix;
}

// --- policy blurb (embedded so cold agents don't invent rules) ---------------

let POLICY = "";
POLICY += "CustomReport DOC / COMMENT / MARKER policy (MUST enforce; do not invent softer rules).\n";
POLICY += "\n";
POLICY += "=== A. Plain comments (// and /* */) ===\n";
POLICY += "1) Default is NO comment. Justify ONLY a non-obvious WHY the code cannot express.\n";
POLICY += "2) Budget: at most THREE lines. Over-budget load-bearing WHY → kind comment-relocate-to-spec ";
POLICY += "(verify/add openspec/specs/ or ADR first, leave <=2-line pointer). Never silent-delete load-bearing WHY.\n";
POLICY += "3) Delete narration that restates names/types/code ('this function does X').\n";
POLICY += "4) Delete archaeology: ticket/phase/plan refs (UFB-036, AUTH-08, Phase 35-08, R3a-4), ";
POLICY += "change-log narration (moved/extracted/graduated into/from). Git history holds that. ";
POLICY += "Live openspec/spec names as pointers are OK. Detector: scripts/find-archaeology.mjs.\n";
POLICY += "\n";
POLICY += "=== B. JSDoc — where and how to fill ===\n";
POLICY += "5) SCOPE: REQUIRED only on exported declarations from packages/shared (./ and ./trpc entry points) ";
POLICY += "and packages/ui public surface. REMOVE on apps/* (including Nest providers and tRPC routers) ";
POLICY += "and on non-exported helpers anywhere. Missing required public JSDoc → jsdoc-missing-public. ";
POLICY += "Present but wrong place → jsdoc-on-internal.\n";
POLICY += "6) SHAPE when JSDoc is required (malformed → jsdoc-malformed):\n";
POLICY += "   - English only.\n";
POLICY += "   - First line: contract / non-obvious behavior (not a restatement of the symbol name).\n";
POLICY += "   - @param / @returns / @throws only when types alone do not carry the contract ";
POLICY += "(units, invariants, sentinel values, error cases). Skip obvious typed params.\n";
POLICY += "   - No @example walls, no changelog, no ticket/phase archaeology, no implementation walkthrough.\n";
POLICY += "   - Prefer <=6 lines total; if longer, relocate the deep rationale to openspec and keep a short pointer.\n";
POLICY += "   - Do NOT add @type annotations that fight TypeScript.\n";
POLICY += "\n";
POLICY += "=== C. TODO / FIXME / HACK / XXX markers ===\n";
POLICY += "7) Canonical form: TODO(<ref>): short imperative note — e.g. TODO(multi-org): drop id='singleton'.\n";
POLICY += "   <ref> is a stable kebab or slug id (not a ticket archaeology slug like UFB-036 unless that ";
POLICY += "is still the live deferred-feature id). Bare TODO/FIXME/HACK/XXX without (ref) → todo-malformed.\n";
POLICY += "8) FIXME/HACK/XXX: either convert to TODO(<ref>): ... with a real follow-up, or remove if obsolete. ";
POLICY += "Orphan FIXME with no owner/ref/plan → fixme-orphan.\n";
POLICY += "9) Stale markers: if the code already implements what the TODO describes, or the deferred path ";
POLICY += "is live with no loud stub, → todo-stale (delete marker; do not leave dead TODOs).\n";
POLICY += "10) Deferred features (openspec deferred-feature-pattern):\n";
POLICY += "   - Backend deferred entry: throw new Error('Not implemented — see TODO(<ref>)') AND a matching ";
POLICY += "TODO(<ref>) at the activation point. Never silent mock/empty return.\n";
POLICY += "   - UI deferred: ComingSoonBadge on an inert control — never a hidden flag.\n";
POLICY += "   A TODO that promises a deferred feature without the loud stub / ComingSoon surface is a defect.\n";
POLICY += "\n";
POLICY += "=== D. Safety & language ===\n";
POLICY += "11) Security-sensitive paths (auth, JWT, cookies, redirects, rate-limit, CSRF, secrets, authz): ";
POLICY += "never strip load-bearing rationale without relocating; prefer compress/relocate over delete.\n";
POLICY += "12) Product UI strings stay English. Comments/TODOs/JSDoc themselves: English preferred; ";
POLICY += "Russian allowed only as data/seed/test fixtures, not as product copy.\n";
POLICY += "13) Fix mode: edit ONLY comments/JSDoc/markers unless a deferred stub must be added to match policy. ";
POLICY += "No renames, no behavior refactors, no test rewrites.\n";

// --- helpers -----------------------------------------------------------------

fn starts_with_root(path, prefix) {
    if type_of(path) != "string" { return false; }
    if path == prefix { return true; }
    let p = prefix + "/";
    if path.len() < p.len() { return false; }
    path.sub_string(0, p.len()) == p
}

fn has_substr(s, needle) {
    if type_of(s) != "string" || type_of(needle) != "string" { return false; }
    if needle.len() == 0 { return true; }
    if s.len() < needle.len() { return false; }
    let i = 0;
    let last = s.len() - needle.len();
    while i <= last {
        if s.sub_string(i, needle.len()) == needle { return true; }
        i += 1;
    }
    false
}

fn is_product_ts(path) {
    if type_of(path) != "string" { return false; }
    if path.len() < 4 { return false; }
    // crude extension check without regex
    let ok_ext = false;
    if path.len() >= 3 && path.sub_string(path.len() - 3, 3) == ".ts" { ok_ext = true; }
    if path.len() >= 4 && path.sub_string(path.len() - 4, 4) == ".tsx" { ok_ext = true; }
    if !ok_ext { return false; }
    // drop tests / generated / configs by substring
    if has_substr(path, ".test.") { return false; }
    if has_substr(path, ".spec.") { return false; }
    if has_substr(path, "/generated/") { return false; }
    if has_substr(path, ".config.") { return false; }
    if has_substr(path, "__tests__") { return false; }
    if has_substr(path, "/e2e/") { return false; }
    true
}

fn kind_allowed(k) {
    k == "comment-budget" || k == "comment-narration" || k == "comment-archaeology"
        || k == "comment-relocate-to-spec" || k == "jsdoc-on-internal" || k == "jsdoc-missing-public"
        || k == "jsdoc-malformed" || k == "todo-malformed" || k == "todo-stale" || k == "fixme-orphan"
}

// --- Phase 1: Inventory ------------------------------------------------------

phase("Inventory");
log("Inventory under root=" + root + " mode=" + mode + " max_files=" + max_files.to_string());

let inv_prompt = "";
inv_prompt += "Inventory product TypeScript source files under the repo-relative root: " + root + ".\n";
inv_prompt += "Use list_dir recursively and/or grep. Do NOT invent paths.\n";
inv_prompt += "Include only .ts / .tsx product source. EXCLUDE: *.test.*, *.spec.*, e2e/, generated/, ";
inv_prompt += "*.config.*, node_modules, dist, .next, prisma/generated.\n";
inv_prompt += "Return at most " + max_files.to_string() + " paths, sorted, repo-relative (e.g. apps/api/src/foo.ts).\n";
inv_prompt += "If the tree has more files, prefer files that still look doc-dirty ";
inv_prompt += "(long /** blocks, bare TODO/FIXME, ticket-like slugs in comments) but always return real paths you listed.\n";
inv_prompt += "Empty list only after you confirmed the root has no matching product source.\n";

let inv = agent(inv_prompt, #{
    label: "inventory",
    capability_mode: "read-only",
    output_schema: files_schema,
});

let files = [];
if inv != () && inv.success && inv.output.files != () {
    for f in inv.output.files {
        if is_product_ts(f) && starts_with_root(f, root) {
            if files.len() < max_files {
                files.push(f);
            }
        } else {
            log("dropped out-of-scope inventory path: " + f);
        }
    }
}

if files.len() == 0 {
    complete(#{
        summary: "No in-scope product TS files under " + root,
        root: root,
        mode: mode,
        files: 0,
        confirmed: [],
    });
}

log("inventory kept " + files.len().to_string() + " files");

// --- Phase 2: Audit (sharded) ------------------------------------------------

phase("Audit");

let shards = [];
let i = 0;
while i < files.len() {
    let shard = [];
    let j = 0;
    while j < batch_size && i < files.len() {
        shard.push(files[i]);
        i += 1;
        j += 1;
    }
    shards.push(shard);
}

log("audit shards: " + shards.len().to_string() + " x up to " + batch_size.to_string());

let audit_jobs = [];
let si = 0;
for shard in shards {
    let file_list = "";
    for f in shard {
        if file_list != "" { file_list += "\n"; }
        file_list += f;
    }
    let p = "";
    p += POLICY;
    p += "\nYou are auditing ONLY these files for comment / JSDoc / TODO-FIXME policy violations:\n";
    p += file_list;
    p += "\n\nFor EACH file: use read_file on the real file contents. Do not answer from memory.\n";
    p += "Also grep the file for TODO|FIXME|HACK|XXX so markers are not missed.\n";
    p += "Report concrete findings with {file, kind, line, issue, action, snippet}.\n";
    p += "Kinds must be exactly one of: comment-budget, comment-narration, comment-archaeology, ";
    p += "comment-relocate-to-spec, jsdoc-on-internal, jsdoc-missing-public, jsdoc-malformed, ";
    p += "todo-malformed, todo-stale, fixme-orphan.\n";
    p += "Rules of judgment:\n";
    p += "- comment-budget: // or /* WHY block >3 lines (not large enough to be relocate).\n";
    p += "- comment-relocate-to-spec: load-bearing rationale clearly >3 lines → move to openspec.\n";
    p += "- comment-narration: restates what names/types/code already say.\n";
    p += "- comment-archaeology: ticket/phase/changelog noise (UFB-*, Phase N, moved/extracted into...).\n";
    p += "- jsdoc-on-internal: /** ... */ on apps/* anything, non-exported helpers, Nest/tRPC wiring.\n";
    p += "- jsdoc-missing-public: packages/shared|ui public export lacking JSDoc.\n";
    p += "- jsdoc-malformed: required public JSDoc that narrates, has archaeology, @example walls, ";
    p += "redundant @param for obvious types, wrong language, or fails the SHAPE rules in the policy.\n";
    p += "- todo-malformed: bare TODO/FIXME/HACK/XXX without TODO(<ref>): note form.\n";
    p += "- todo-stale: marker describes work already done, or deferred path is live without matching stub.\n";
    p += "- fixme-orphan: FIXME/HACK with no stable ref and no actionable note.\n";
    p += "Do NOT report style nits, missing tests, complexity, or magic literals — out of scope.\n";
    p += "At most 40 findings total for this shard. Empty findings[] is valid only after reading every file.\n";
    p += "action must be specific (e.g. 'delete L12-18 internal JSDoc', 'rewrite public JSDoc to 3-line contract', ";
    p += "'reformat to TODO(multi-org): ...', 'remove stale TODO — feature shipped').\n";

    audit_jobs.push(#{
        prompt: p,
        label: "audit-" + si.to_string(),
        capability_mode: "read-only",
        output_schema: findings_schema,
    });
    si += 1;
}

let audit_results = parallel(audit_jobs);

let raw_findings = [];
let dropped_kind = 0;
let dropped_scope = 0;
for r in audit_results {
    if r != () && r.success && r.output.findings != () {
        for f in r.output.findings {
            if f.file == () || f.kind == () { continue; }
            if !kind_allowed(f.kind) {
                dropped_kind += 1;
                continue;
            }
            if !starts_with_root(f.file, root) {
                dropped_scope += 1;
                continue;
            }
            raw_findings.push(f);
        }
    }
}

if dropped_kind > 0 { log("dropped " + dropped_kind.to_string() + " findings with unknown kind"); }
if dropped_scope > 0 { log("dropped " + dropped_scope.to_string() + " findings outside root"); }
log("raw findings: " + raw_findings.len().to_string());

if raw_findings.len() == 0 {
    let clean_report = "";
    clean_report += "# Comment hygiene — " + root + "\n\n";
    clean_report += "Mode: `" + mode + "`\n\n";
    clean_report += "Scanned **" + files.len().to_string() + "** files. No policy findings.\n";
    let path = write_scratch_file("comment-hygiene-report.md", clean_report);
    complete(#{
        summary: "Clean: 0 findings in " + files.len().to_string() + " files under " + root,
        path: path,
        root: root,
        mode: mode,
        files: files.len(),
        confirmed: [],
    });
}

// --- Phase 3: Verify (fail-closed, capped) -----------------------------------

phase("Verify");

let to_verify = [];
let vi = 0;
while vi < raw_findings.len() && to_verify.len() < max_verify {
    to_verify.push(raw_findings[vi]);
    vi += 1;
}
if raw_findings.len() > max_verify {
    log("verify capped: " + max_verify.to_string() + " of " + raw_findings.len().to_string() + " findings");
}

let vjobs = [];
let vix = 0;
for f in to_verify {
    let issue = if f.issue != () { f.issue } else { "" };
    let action = if f.action != () { f.action } else { "" };
    let line_s = if f.line != () { f.line.to_string() } else { "?" };
    let enc_issue = json_encode(issue);
    let enc_action = json_encode(action);

    let vp = "";
    vp += POLICY;
    vp += "\nAdversarially verify this comment/JSDoc policy finding by reading the shipped file.\n";
    vp += "File: " + f.file + "\n";
    vp += "Kind: " + f.kind + "\n";
    vp += "Line: " + line_s + "\n";
    vp += "Claimed issue (JSON): " + enc_issue + "\n";
    vp += "Claimed action (JSON): " + enc_action + "\n";
    vp += "Use read_file on " + f.file + ". Set real=true ONLY if you independently see the violation ";
    vp += "and the kind fits the policy. Prefer real=false on doubt, stale line numbers, or narration that ";
    vp += "is actually non-obvious load-bearing WHY. evidence must quote the actual comment or show absence.\n";

    vjobs.push(#{
        prompt: vp,
        label: "verify-" + vix.to_string(),
        capability_mode: "read-only",
        output_schema: verdict_schema,
    });
    vix += 1;
}

let verdicts = parallel(vjobs);

let confirmed = [];
let rejected = 0;
let unverified = 0;
let idx = 0;
for v in verdicts {
    if v != () && v.success && v.output.real == true
        && v.output.evidence != () && v.output.evidence != "" {
        confirmed.push(to_verify[idx]);
    } else if v != () && v.success && v.output.real == false {
        rejected += 1;
    } else {
        unverified += 1;
    }
    idx += 1;
}

log("verified real=" + confirmed.len().to_string()
    + " rejected=" + rejected.to_string()
    + " unverified=" + unverified.to_string());

// --- Phase 4: Fix (optional) -------------------------------------------------

let fix_results = [];
if mode == "fix" && confirmed.len() > 0 {
    phase("Fix");

    // Group confirmed findings by file for one write agent per file (safer).
    let by_file = [];
    // parallel arrays: file path + list of findings (Rhai has no map-of-arrays easily;
    // use array of #{ file, items: [] } and linear search).
    for f in confirmed {
        let found = false;
        let bi = 0;
        while bi < by_file.len() {
            if by_file[bi].file == f.file {
                by_file[bi].items.push(f);
                found = true;
                break;
            }
            bi += 1;
        }
        if !found {
            let items = [];
            items.push(f);
            by_file.push(#{ file: f.file, items: items });
        }
    }

    let fix_jobs = [];
    let fi = 0;
    for bucket in by_file {
        if fi >= max_fix { break; }
        let findings_json = json_encode(bucket.items);
        let fp = "";
        fp += POLICY;
        fp += "\nApply CONFIRMED doc/comment/marker fixes to this single file only: " + bucket.file + "\n";
        fp += "Confirmed findings (JSON): " + findings_json + "\n";
        fp += "Rules:\n";
        fp += "- Edit ONLY " + bucket.file + ". Use read_file first, then search_replace carefully.\n";
        fp += "- Delete narration, archaeology, jsdoc-on-internal, stale TODOs as directed.\n";
        fp += "- comment-budget: compress to <=3 lines pure WHY; keep load-bearing content.\n";
        fp += "- comment-relocate-to-spec: if covering openspec/specs/ exists, leave <=2-line pointer; ";
        fp += "if missing, SKIP and note — do NOT invent specs.\n";
        fp += "- jsdoc-missing-public / jsdoc-malformed: write SHAPE-correct English JSDoc ";
        fp += "(contract first line; @param/@returns only when types are insufficient; no archaeology).\n";
        fp += "- todo-malformed / fixme-orphan: rewrite to TODO(<ref>): imperative note, or remove if obsolete.\n";
        fp += "- todo-stale: remove the marker; if a deferred loud stub is wrongly present for shipped code, ";
        fp += "do NOT delete runtime stubs unless the finding explicitly says the feature is live — prefer SKIP.\n";
        fp += "- Do not change runtime behavior, renames, or non-doc code except a required deferred stub ";
        fp += "when the finding action explicitly requires matching TODO(<ref>) + throw.\n";
        fp += "- Security paths: if unsure a comment is load-bearing, SKIP rather than delete.\n";
        fp += "Return applied count and notes. List skipped items with reasons.\n";

        fix_jobs.push(#{
            prompt: fp,
            label: "fix-" + fi.to_string(),
            capability_mode: "read-write",
            output_schema: fix_schema,
        });
        fi += 1;
    }

    if by_file.len() > max_fix {
        log("fix capped: " + max_fix.to_string() + " of " + by_file.len().to_string() + " files");
    }

    if fix_jobs.len() > 0 {
        fix_results = parallel(fix_jobs);
    }
} else if mode == "fix" {
    phase("Fix");
    log("fix mode but nothing confirmed — skip edits");
} else {
    phase("Fix");
    log("mode=audit — skip fix stage");
}

// --- Phase 5: Report ---------------------------------------------------------

phase("Report");

// counts by kind
let c_budget = 0;
let c_narr = 0;
let c_arch = 0;
let c_reloc = 0;
let c_js_int = 0;
let c_js_miss = 0;
let c_js_bad = 0;
let c_todo_bad = 0;
let c_todo_stale = 0;
let c_fixme = 0;
for f in confirmed {
    if f.kind == "comment-budget" { c_budget += 1; }
    if f.kind == "comment-narration" { c_narr += 1; }
    if f.kind == "comment-archaeology" { c_arch += 1; }
    if f.kind == "comment-relocate-to-spec" { c_reloc += 1; }
    if f.kind == "jsdoc-on-internal" { c_js_int += 1; }
    if f.kind == "jsdoc-missing-public" { c_js_miss += 1; }
    if f.kind == "jsdoc-malformed" { c_js_bad += 1; }
    if f.kind == "todo-malformed" { c_todo_bad += 1; }
    if f.kind == "todo-stale" { c_todo_stale += 1; }
    if f.kind == "fixme-orphan" { c_fixme += 1; }
}

let applied_total = 0;
if mode == "fix" {
    for r in fix_results {
        if r != () && r.success && r.output.applied != () {
            applied_total += r.output.applied;
        }
    }
}

let report = "";
report += "# Comment hygiene report\n\n";
report += "- **root:** `" + root + "`\n";
report += "- **mode:** `" + mode + "`\n";
report += "- **files scanned:** " + files.len().to_string() + "\n";
report += "- **raw findings:** " + raw_findings.len().to_string() + "\n";
report += "- **verified real:** " + confirmed.len().to_string() + "\n";
report += "- **rejected / unverified:** " + rejected.to_string() + " / " + unverified.to_string() + "\n";
if mode == "fix" {
    report += "- **fix actions applied:** " + applied_total.to_string() + "\n";
}
report += "\n## Counts by kind (confirmed)\n\n";
report += "| kind | count |\n| --- | ---: |\n";
report += "| comment-budget | " + c_budget.to_string() + " |\n";
report += "| comment-narration | " + c_narr.to_string() + " |\n";
report += "| comment-archaeology | " + c_arch.to_string() + " |\n";
report += "| comment-relocate-to-spec | " + c_reloc.to_string() + " |\n";
report += "| jsdoc-on-internal | " + c_js_int.to_string() + " |\n";
report += "| jsdoc-missing-public | " + c_js_miss.to_string() + " |\n";
report += "| jsdoc-malformed | " + c_js_bad.to_string() + " |\n";
report += "| todo-malformed | " + c_todo_bad.to_string() + " |\n";
report += "| todo-stale | " + c_todo_stale.to_string() + " |\n";
report += "| fixme-orphan | " + c_fixme.to_string() + " |\n";
report += "\n## Confirmed findings\n\n";

for f in confirmed {
    let line_s = if f.line != () { f.line.to_string() } else { "?" };
    let issue = if f.issue != () { f.issue } else { "" };
    let action = if f.action != () { f.action } else { "" };
    report += "### `" + f.file + "`:" + line_s + " — `" + f.kind + "`\n\n";
    report += "- **issue:** " + issue + "\n";
    report += "- **action:** " + action + "\n\n";
}

if mode == "fix" && fix_results.len() > 0 {
    report += "## Fix notes\n\n";
    for r in fix_results {
        if r != () && r.success && r.output != () {
            let ff = if r.output.file != () { r.output.file } else { "?" };
            let notes = if r.output.notes != () { r.output.notes } else { "" };
            let ap = if r.output.applied != () { r.output.applied.to_string() } else { "0" };
            report += "- `" + ff + "`: applied=" + ap + " — " + notes + "\n";
        }
    }
    report += "\n";
}

report += "## Policy reminder\n\n";
report += "JSDoc is **not** repo-wide coverage: only `packages/shared` and `packages/ui` public exports, ";
report += "filled to SHAPE (contract, no narration). Internal JSDoc is a defect. Comments are 3-line WHY max. ";
report += "Markers use `TODO(<ref>): note`. Bare FIXME/HACK and stale TODOs are defects. ";
report += "Deferred paths need loud stubs / ComingSoonBadge — see `deferred-feature-pattern`.\n";

let out_path = write_scratch_file("comment-hygiene-report.md", report);

let summary = confirmed.len().to_string() + " confirmed / " + raw_findings.len().to_string()
    + " raw in " + files.len().to_string() + " files (" + root + ", mode=" + mode + ")";

complete(#{
    summary: summary,
    path: out_path,
    root: root,
    mode: mode,
    files: files.len(),
    raw: raw_findings.len(),
    confirmed_count: confirmed.len(),
    confirmed: confirmed,
    applied: applied_total,
});
