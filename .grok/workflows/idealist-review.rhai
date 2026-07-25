// idealist-review — per-file scoring toward a 1000/1000 excellence bar.
//
// Not a "looks fine" pass. Every file is graded against CustomReport's
// exemplary standard PLUS extra idealist dimensions (AI-navigability,
// contract honesty, fail-closed elegance, spec alignment, …).
//
// Args:
//   root       (string, required)  — e.g. packages/ui/src, apps/api/src/modules/auth
//   max_files  (int, default 36)   — files this run
//   batch_size (int, default 4)    — files per scoring agent
//   max_verify (int, default 24)   — gaps to adversarially verify
//
// Full monorepo = many runs with different roots (or raise caps + agent_budget).
// Output: scratch/idealist-report.md + structured scores.

let meta = #{
    name: "idealist-review",
    description: "Per-file idealist scoring (1000/1000 bar): style, architecture, elegance, correctness, security, tests, AI-nav, contract honesty — adversarial verify gaps",
    when_to_use: "When you want every file graded against the strictest bar, not just lint-green or comment hygiene",
    phases: [
        #{ title: "Inventory", detail: "list product source under root" },
        #{ title: "Score", detail: "parallel batch scorers against 1000-pt rubric" },
        #{ title: "Verify", detail: "adversarial verify top gaps (fail-closed)" },
        #{ title: "Report", detail: "ranked scores + confirmed gaps to perfect" },
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
        },
    },
};

let scores_schema = #{
    "type": "object",
    "required": ["files"],
    "properties": #{
        "files": #{
            "type": "array",
            "maxItems": 12,
            "items": #{
                "type": "object",
                "required": ["file", "total", "verdict", "subscores", "gaps"],
                "properties": #{
                    "file": #{ "type": "string" },
                    "total": #{ "type": "integer", "minimum": 0, "maximum": 1000 },
                    "verdict": #{
                        "type": "string",
                        "enum": ["exemplary", "good", "needs-attention", "defect"],
                    },
                    "subscores": #{
                        "type": "object",
                        "required": [
                            "style_clarity",
                            "architecture",
                            "correctness",
                            "elegance_depth",
                            "functional_immutable",
                            "comments_jsdoc",
                            "naming_language",
                            "tests_quality",
                            "security_authz",
                            "performance",
                            "observability",
                            "config_explicit",
                            "dead_surface",
                            "contract_honesty",
                            "fail_closed",
                            "ai_navigability",
                            "spec_alignment",
                            "a11y_i18n",
                        ],
                        "properties": #{
                            "style_clarity": #{ "type": "integer", "minimum": 0, "maximum": 70 },
                            "architecture": #{ "type": "integer", "minimum": 0, "maximum": 90 },
                            "correctness": #{ "type": "integer", "minimum": 0, "maximum": 100 },
                            "elegance_depth": #{ "type": "integer", "minimum": 0, "maximum": 70 },
                            "functional_immutable": #{ "type": "integer", "minimum": 0, "maximum": 60 },
                            "comments_jsdoc": #{ "type": "integer", "minimum": 0, "maximum": 50 },
                            "naming_language": #{ "type": "integer", "minimum": 0, "maximum": 50 },
                            "tests_quality": #{ "type": "integer", "minimum": 0, "maximum": 70 },
                            "security_authz": #{ "type": "integer", "minimum": 0, "maximum": 90 },
                            "performance": #{ "type": "integer", "minimum": 0, "maximum": 40 },
                            "observability": #{ "type": "integer", "minimum": 0, "maximum": 35 },
                            "config_explicit": #{ "type": "integer", "minimum": 0, "maximum": 40 },
                            "dead_surface": #{ "type": "integer", "minimum": 0, "maximum": 35 },
                            "contract_honesty": #{ "type": "integer", "minimum": 0, "maximum": 50 },
                            "fail_closed": #{ "type": "integer", "minimum": 0, "maximum": 45 },
                            "ai_navigability": #{ "type": "integer", "minimum": 0, "maximum": 50 },
                            "spec_alignment": #{ "type": "integer", "minimum": 0, "maximum": 35 },
                            "a11y_i18n": #{ "type": "integer", "minimum": 0, "maximum": 20 },
                        },
                    },
                    "gaps": #{
                        "type": "array",
                        "maxItems": 12,
                        "items": #{
                            "type": "object",
                            "required": ["dimension", "severity", "detail", "fix_hint", "line"],
                            "properties": #{
                                "dimension": #{ "type": "string" },
                                "severity": #{ "type": "integer", "minimum": 1, "maximum": 100 },
                                "detail": #{ "type": "string" },
                                "fix_hint": #{ "type": "string" },
                                "line": #{ "type": "integer" },
                            },
                        },
                    },
                    "rationale": #{ "type": "string" },
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

// --- args --------------------------------------------------------------------

let root = if args == () { () } else { args.root };
if root == () || root == "" {
    pause("verification", "Pass args.root — e.g. packages/ui/src or apps/api/src/modules/auth");
}

let max_files = 36;
if args != () && args.max_files != () { max_files = args.max_files; }

let batch_size = 4;
if args != () && args.batch_size != () { batch_size = args.batch_size; }
if batch_size < 1 { batch_size = 1; }
if batch_size > 8 { batch_size = 8; }

let max_verify = 24;
if args != () && args.max_verify != () { max_verify = args.max_verify; }

// --- rubric (embedded; cold agents must not invent softer bars) --------------

let RUBRIC = "";
RUBRIC += "IDEALIST 1000/1000 RUBRIC for CustomReport. Perfect means a senior architect + security + ";
RUBRIC += "staff-level reviewer would ship this file as a teaching example. Be harsh but fair.\n";
RUBRIC += "Read every line of each file with read_file. Do not score from memory or path names alone.\n";
RUBRIC += "Do NOT spend points on pure formatting/import-order (eslint/prettier own that).\n";
RUBRIC += "\n";
RUBRIC += "SUBSCORES (max; total must equal sum of subscores, cap 1000):\n";
RUBRIC += "1) style_clarity (70) — single abstraction level, scannable, no clever noise, no dead branches.\n";
RUBRIC += "2) architecture (90) — module owns only its domain; injection over cross-imports; hexagon/ports where applicable;\n";
RUBRIC += "   web slices / api modules respect import boundaries; no god-object leakage.\n";
RUBRIC += "3) correctness (100) — invariants, edge cases, period dual-state, role-coverage, race/version CAS where relevant;\n";
RUBRIC += "   tests or types prove the hard paths. Bugs and lying comments cost heavily.\n";
RUBRIC += "4) elegance_depth (70) — deep modules (small interface, rich body OR clear pure helpers); no shallow wrapper soup;\n";
RUBRIC += "   no entanglement (Ousterhout); extractions have independent names worth reading alone.\n";
RUBRIC += "5) functional_immutable (60) — const-only product code; no let/mutation/param reassign; map/filter/reduce/spread;\n";
RUBRIC += "   side effects at edges. Inline eslint-disable for let only with concrete WHY.\n";
RUBRIC += "6) comments_jsdoc (50) — default NO comment; ≤3-line WHY; no archaeology/narration; JSDoc public-API-only\n";
RUBRIC += "   (packages/shared|ui exports); internal JSDoc is a defect; TODO(<ref>): form.\n";
RUBRIC += "7) naming_language (50) — ubiquitous language matches openspec/domain; no vague util/helper/manager/data.\n";
RUBRIC += "8) tests_quality (70) — if co-located tests exist, score them; if none and file is logic-heavy, deduct.\n";
RUBRIC += "   Vacuous tests (assert true / only mocks) lose hard. Prefer behavior over implementation.\n";
RUBRIC += "9) security_authz (90) — authn/authz, cookies, redirects, secrets, injection, IDOR, CSRF, least privilege.\n";
RUBRIC += "   Non-security files still score high if they cannot introduce surface; deduct if they touch untrusted input poorly.\n";
RUBRIC += "10) performance (40) — hot-path waste, N+1, unbounded work, client waterfalls (web), missing keys, thrash.\n";
RUBRIC += "11) observability (35) — structured logs/metrics where failures matter; no silent swallow; useful error context.\n";
RUBRIC += "12) config_explicit (40) — no silent product defaults/fallbacks (?? localhost, zod .default for product env);\n";
RUBRIC += "    requireEnv pattern; named constants for non-obvious literals.\n";
RUBRIC += "13) dead_surface (35) — unused exports, dead code, unreachable branches, zombie feature flags.\n";
RUBRIC += "14) contract_honesty (50) — types/Zod/tRPC/JSDoc match runtime; no lie comments; schema = wire truth.\n";
RUBRIC += "15) fail_closed (45) — errors typed/loud; deferred paths throw TODO(ref) stubs; no silent empty success;\n";
RUBRIC += "    authz deny-by-default; parse failures reject.\n";
RUBRIC += "16) ai_navigability (50) — file <250 lines ideal; fn ≤50; one job per file; names teach; no archaeology;\n";
RUBRIC += "    an agent can safely edit without reading half the monorepo.\n";
RUBRIC += "17) spec_alignment (35) — load-bearing behavior points at openspec when non-obvious; no contradiction with specs.\n";
RUBRIC += "18) a11y_i18n (20) — web UI: focus, labels, keyboard; English product UI strings (RU only in data/tests).\n";
RUBRIC += "    Non-UI files: award full 20 if N/A.\n";
RUBRIC += "\n";
RUBRIC += "VERDICT mapping (after total):\n";
RUBRIC += "  950–1000 exemplary | 800–949 good | 600–799 needs-attention | <600 defect\n";
RUBRIC += "A single Critical correctness/security gap caps total at 599 (defect) even if other subscores are high.\n";
RUBRIC += "gaps[]: only concrete, line-anchored, fixable items with severity points you actually deducted.\n";
RUBRIC += "Empty gaps only if total ≥950 AND you read the whole file.\n";
RUBRIC += "REPO GUARDRAILS — do NOT deduct for: ComingSoon deferred UI; Russian in seeds/tests/comments;\n";
RUBRIC += "single init Prisma migration posture; English product UI by policy.\n";

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
    let ok_ext = false;
    if path.len() >= 3 && path.sub_string(path.len() - 3, 3) == ".ts" { ok_ext = true; }
    if path.len() >= 4 && path.sub_string(path.len() - 4, 4) == ".tsx" { ok_ext = true; }
    if !ok_ext { return false; }
    if has_substr(path, ".test.") { return false; }
    if has_substr(path, ".spec.") { return false; }
    if has_substr(path, "/generated/") { return false; }
    if has_substr(path, ".config.") { return false; }
    if has_substr(path, "__tests__") { return false; }
    if has_substr(path, "/e2e/") { return false; }
    true
}

// --- Phase 1: Inventory ------------------------------------------------------

phase("Inventory");
log("idealist-review root=" + root + " max_files=" + max_files.to_string());

let inv_prompt = "";
inv_prompt += "List product TypeScript source under repo-relative root: " + root + ".\n";
inv_prompt += "Use list_dir recursively / grep. Real paths only.\n";
inv_prompt += "Include .ts/.tsx product source. EXCLUDE tests, e2e, generated, *.config.*, node_modules, dist.\n";
inv_prompt += "Return at most " + max_files.to_string() + " sorted repo-relative paths.\n";
inv_prompt += "Prefer riskier / larger / more complex files if over cap, but only real listed paths.\n";

let inv = agent(inv_prompt, #{
    label: "inventory",
    capability_mode: "read-only",
    output_schema: files_schema,
});

let files = [];
if inv != () && inv.success && inv.output.files != () {
    for f in inv.output.files {
        if is_product_ts(f) && starts_with_root(f, root) {
            if files.len() < max_files { files.push(f); }
        } else {
            log("dropped inventory path: " + f);
        }
    }
}

if files.len() == 0 {
    complete(#{ summary: "No files under " + root, root: root, files: 0, scores: [] });
}

log("scoring " + files.len().to_string() + " files");

// --- Phase 2: Score ----------------------------------------------------------

phase("Score");

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

let score_jobs = [];
let si = 0;
for shard in shards {
    let file_list = "";
    for f in shard {
        if file_list != "" { file_list += "\n"; }
        file_list += f;
    }
    let p = "";
    p += RUBRIC;
    p += "\nScore EACH of these files independently (read full contents):\n";
    p += file_list;
    p += "\n\nFor each file return {file, total, verdict, subscores, gaps, rationale}.\n";
    p += "total MUST equal the sum of all 18 subscores (0–1000).\n";
    p += "Be harsh: 1000 is rare. If unsure whether a gap is real, still list it with lower severity ";
    p += "rather than inventing praise. Empty gaps only for near-perfect files you fully read.\n";

    score_jobs.push(#{
        prompt: p,
        label: "score-" + si.to_string(),
        capability_mode: "read-only",
        output_schema: scores_schema,
    });
    si += 1;
}

let score_results = parallel(score_jobs);

let scored = [];
for r in score_results {
    if r != () && r.success && r.output.files != () {
        for f in r.output.files {
            if f.file != () && starts_with_root(f.file, root) {
                scored.push(f);
            } else {
                log("dropped out-of-scope score: " + (if f.file != () { f.file } else { "?" }));
            }
        }
    }
}

log("scored files: " + scored.len().to_string());

// collect gaps for verify
let raw_gaps = [];
for f in scored {
    if f.gaps != () {
        for g in f.gaps {
            raw_gaps.push(#{
                file: f.file,
                dimension: g.dimension,
                severity: g.severity,
                detail: g.detail,
                fix_hint: g.fix_hint,
                line: g.line,
            });
        }
    }
}

// --- Phase 3: Verify gaps ----------------------------------------------------

phase("Verify");

let to_verify = [];
let vi = 0;
while vi < raw_gaps.len() && to_verify.len() < max_verify {
    to_verify.push(raw_gaps[vi]);
    vi += 1;
}
if raw_gaps.len() > max_verify {
    log("verify capped " + max_verify.to_string() + " of " + raw_gaps.len().to_string() + " gaps");
}

let confirmed_gaps = [];
let rejected = 0;
let unverified = 0;

if to_verify.len() > 0 {
    let vjobs = [];
    let vix = 0;
    for g in to_verify {
        let detail = if g.detail != () { g.detail } else { "" };
        let line_s = if g.line != () { g.line.to_string() } else { "?" };
        let dim = if g.dimension != () { g.dimension } else { "?" };
        let enc = json_encode(detail);
        let vp = "";
        vp += RUBRIC;
        vp += "\nAdversarially verify this idealist gap by reading the shipped file.\n";
        vp += "File: " + g.file + " Line: " + line_s + " Dimension: " + dim + "\n";
        vp += "Claim (JSON): " + enc + "\n";
        vp += "Set real=true ONLY with concrete independent evidence. Prefer real=false on doubt.\n";
        vp += "evidence must quote code or prove absence.\n";

        vjobs.push(#{
            prompt: vp,
            label: "verify-" + vix.to_string(),
            capability_mode: "read-only",
            output_schema: verdict_schema,
        });
        vix += 1;
    }

    let verdicts = parallel(vjobs);
    let idx = 0;
    for v in verdicts {
        if v != () && v.success && v.output.real == true
            && v.output.evidence != () && v.output.evidence != "" {
            confirmed_gaps.push(to_verify[idx]);
        } else if v != () && v.success && v.output.real == false {
            rejected += 1;
        } else {
            unverified += 1;
        }
        idx += 1;
    }
}

log("gaps confirmed=" + confirmed_gaps.len().to_string()
    + " rejected=" + rejected.to_string()
    + " unverified=" + unverified.to_string());

// --- Phase 4: Report ---------------------------------------------------------

phase("Report");

// simple average total
let sum = 0;
let n = 0;
let min_t = 1000;
let max_t = 0;
let c_ex = 0;
let c_good = 0;
let c_na = 0;
let c_def = 0;
for f in scored {
    if f.total != () {
        sum += f.total;
        n += 1;
        if f.total < min_t { min_t = f.total; }
        if f.total > max_t { max_t = f.total; }
    }
    if f.verdict == "exemplary" { c_ex += 1; }
    if f.verdict == "good" { c_good += 1; }
    if f.verdict == "needs-attention" { c_na += 1; }
    if f.verdict == "defect" { c_def += 1; }
}

let avg = 0;
if n > 0 { avg = sum / n; }

let report = "";
report += "# Idealist review — 1000/1000 bar\n\n";
report += "- **root:** `" + root + "`\n";
report += "- **files scored:** " + scored.len().to_string() + "\n";
report += "- **avg total:** " + avg.to_string() + " / 1000\n";
report += "- **min / max:** " + min_t.to_string() + " / " + max_t.to_string() + "\n";
report += "- **verdicts:** exemplary=" + c_ex.to_string()
    + " good=" + c_good.to_string()
    + " needs-attention=" + c_na.to_string()
    + " defect=" + c_def.to_string() + "\n";
report += "- **raw gaps / verified real / rejected:** "
    + raw_gaps.len().to_string() + " / "
    + confirmed_gaps.len().to_string() + " / "
    + rejected.to_string() + "\n\n";

report += "## Rubric dimensions (max points)\n\n";
report += "| dim | max |\n| --- | ---: |\n";
report += "| style_clarity | 70 |\n| architecture | 90 |\n| correctness | 100 |\n";
report += "| elegance_depth | 70 |\n| functional_immutable | 60 |\n| comments_jsdoc | 50 |\n";
report += "| naming_language | 50 |\n| tests_quality | 70 |\n| security_authz | 90 |\n";
report += "| performance | 40 |\n| observability | 35 |\n| config_explicit | 40 |\n";
report += "| dead_surface | 35 |\n| contract_honesty | 50 |\n| fail_closed | 45 |\n";
report += "| ai_navigability | 50 |\n| spec_alignment | 35 |\n| a11y_i18n | 20 |\n";
report += "| **total** | **1000** |\n\n";

report += "## Per-file scores\n\n";
report += "| file | total | verdict |\n| --- | ---: | --- |\n";
for f in scored {
    let t = if f.total != () { f.total.to_string() } else { "?" };
    let v = if f.verdict != () { f.verdict } else { "?" };
    let path = if f.file != () { f.file } else { "?" };
    report += "| `" + path + "` | " + t + " | " + v + " |\n";
}

report += "\n## Confirmed gaps (survived adversarial verify)\n\n";
if confirmed_gaps.len() == 0 {
    report += "_None confirmed (or no gaps verified)._\n\n";
} else {
    for g in confirmed_gaps {
        let line_s = if g.line != () { g.line.to_string() } else { "?" };
        let det = if g.detail != () { g.detail } else { "" };
        let fix = if g.fix_hint != () { g.fix_hint } else { "" };
        let dim = if g.dimension != () { g.dimension } else { "?" };
        let sev = if g.severity != () { g.severity.to_string() } else { "?" };
        report += "### `" + g.file + "`:" + line_s + " — `" + dim + "` (−" + sev + ")\n\n";
        report += "- **detail:** " + det + "\n";
        report += "- **fix:** " + fix + "\n\n";
    }
}

report += "## Path to 1000\n\n";
report += "Close confirmed gaps first (highest severity). Re-run this workflow on the same root until ";
report += "avg ≥950 and zero confirmed Critical/High gaps. Then expand root coverage across the monorepo.\n";

let out_path = write_scratch_file("idealist-report.md", report);

let summary = "avg " + avg.to_string() + "/1000 over " + scored.len().to_string()
    + " files; " + confirmed_gaps.len().to_string() + " confirmed gaps (" + root + ")";

complete(#{
    summary: summary,
    path: out_path,
    root: root,
    files: scored.len(),
    avg: avg,
    min: min_t,
    max: max_t,
    exemplary: c_ex,
    good: c_good,
    needs_attention: c_na,
    defect: c_def,
    confirmed_gaps: confirmed_gaps,
    scores: scored,
});
