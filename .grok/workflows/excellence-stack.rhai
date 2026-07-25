// excellence-stack — multi-lens review of one root, assembled from in-repo skills.
//
// Lenses (parallel after inventory):
//   architecture  ← codebase-design + improve-codebase-architecture vocabulary
//   correctness   ← exemplary standard + domain invariants
//   security      ← authz / secrets / fail-closed
//   elegance      ← deep modules, AI-navigability, functional immutability
//   comments      ← comment-hygiene policy (docs only)
//   web           ← vercel-react + web-design-guidelines (only if root under apps/web or packages/ui)
//
// Then adversarial verify top findings → markdown report.
//
// Args:
//   root       (required) e.g. packages/ui/src, apps/web/src/features/period
//   max_files  (default 24)
//   max_verify (default 20)
//
// Pair with: idealist-review (numeric score), comment-hygiene (fix docs),
// mass-review (whole monorepo), gates (mechanical floor).
// Operator skill: .claude/skills/idealist-excellence/SKILL.md

let meta = #{
    name: "excellence-stack",
    description: "Multi-lens excellence review of one root (architecture, correctness, security, elegance, comments, web) using in-repo skill lenses + adversarial verify",
    when_to_use: "Illuminate a folder with specialist skill lenses after or beside idealist-review; not a substitute for gates",
    phases: [
        #{ title: "Inventory", detail: "list product files under root" },
        #{ title: "Lenses", detail: "parallel specialist reviews (skill-informed)" },
        #{ title: "Verify", detail: "adversarial verify capped findings" },
        #{ title: "Report", detail: "merged confirmed gaps + next tools" },
    ],
};

let files_schema = #{
    "type": "object",
    "required": ["files"],
    "properties": #{
        "files": #{
            "type": "array",
            "maxItems": 80,
            "items": #{ "type": "string" },
        },
    },
};

let findings_schema = #{
    "type": "object",
    "required": ["findings", "lens"],
    "properties": #{
        "lens": #{ "type": "string" },
        "findings": #{
            "type": "array",
            "maxItems": 12,
            "items": #{
                "type": "object",
                "required": ["file", "line", "severity", "issue", "fix_hint"],
                "properties": #{
                    "file": #{ "type": "string" },
                    "line": #{ "type": "integer" },
                    "severity": #{
                        "type": "string",
                        "enum": ["critical", "high", "medium", "low"],
                    },
                    "issue": #{ "type": "string" },
                    "fix_hint": #{ "type": "string" },
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

let root = if args == () { () } else { args.root };
if root == () || root == "" {
    pause("verification", "Pass args.root — e.g. packages/ui/src or apps/api/src/modules/auth");
}

let max_files = 24;
if args != () && args.max_files != () { max_files = args.max_files; }

let max_verify = 20;
if args != () && args.max_verify != () { max_verify = args.max_verify; }

fn has_prefix(s, p) {
    if type_of(s) != "string" || type_of(p) != "string" { return false; }
    if s == p { return true; }
    let pre = p + "/";
    if s.len() < pre.len() { return false; }
    s.sub_string(0, pre.len()) == pre
}

fn starts_with_root(path, prefix) {
    has_prefix(path, prefix)
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
    let ok = false;
    if path.len() >= 3 && path.sub_string(path.len() - 3, 3) == ".ts" { ok = true; }
    if path.len() >= 4 && path.sub_string(path.len() - 4, 4) == ".tsx" { ok = true; }
    if !ok { return false; }
    if has_substr(path, ".test.") { return false; }
    if has_substr(path, ".spec.") { return false; }
    if has_substr(path, "/generated/") { return false; }
    if has_substr(path, ".config.") { return false; }
    if has_substr(path, "/e2e/") { return false; }
    true
}

// detect web surface for optional lens
let is_web = false;
if has_prefix(root, "apps/web") { is_web = true; }
if has_prefix(root, "packages/ui") { is_web = true; }

let BASE = "";
BASE += "CustomReport excellence review. Read real files with read_file/grep — no memory-only claims.\n";
BASE += "Standards: docs/exemplary-code-standard.md (≤250 lines/file target, fn ≤50, cognitive <10 ideal, ";
BASE += "const-only, no product config fallbacks, comment ≤3-line WHY, JSDoc public-API-only on packages/shared|ui).\n";
BASE += "OpenSpec is behavioral truth. Do NOT report prettier/eslint formatting.\n";
BASE += "Guardrails: ComingSoon is intentional deferred UI; Russian OK in data/tests/comments only; ";
BASE += "English product UI strings; single Prisma init migration is intentional.\n";
BASE += "Severity: critical (data loss/auth bypass), high (reachable bug/vuln), medium (real maintainability), low (nit).\n";
BASE += "Empty findings[] only after reading every listed file for THIS lens.\n";

// --- Inventory ---------------------------------------------------------------

phase("Inventory");
log("excellence-stack root=" + root + " web_lens=" + (if is_web { "on" } else { "off" }));

let inv_p = "";
inv_p += "List product .ts/.tsx under " + root + " (max " + max_files.to_string() + ").\n";
inv_p += "Exclude tests, e2e, generated, configs. Real paths only via list_dir/grep.\n";

let inv = agent(inv_p, #{
    label: "inventory",
    capability_mode: "read-only",
    output_schema: files_schema,
});

let files = [];
if inv != () && inv.success && inv.output.files != () {
    for f in inv.output.files {
        if is_product_ts(f) && starts_with_root(f, root) {
            if files.len() < max_files { files.push(f); }
        }
    }
}

if files.len() == 0 {
    complete(#{ summary: "No files under " + root, root: root, confirmed: [] });
}

let file_list = "";
for f in files {
    if file_list != "" { file_list += "\n"; }
    file_list += f;
}
log("files: " + files.len().to_string());

// --- Lenses ------------------------------------------------------------------

phase("Lenses");

let jobs = [];

// architecture lens
let p_arch = "";
p_arch += BASE;
p_arch += "\nLENS: architecture (skill: codebase-design + improve-codebase-architecture).\n";
p_arch += "Vocabulary: deep module, shallow module, seam, interface, locality, leverage, deletion test.\n";
p_arch += "Find shallow wrappers, wrong ownership, cross-module leakage, missing injection, god files.\n";
p_arch += "Files:\n" + file_list + "\n";
p_arch += "Return lens=\"architecture\" and up to 12 findings.\n";
jobs.push(#{ prompt: p_arch, label: "lens-architecture", capability_mode: "read-only", output_schema: findings_schema });

// correctness
let p_cor = "";
p_cor += BASE;
p_cor += "\nLENS: correctness & invariants.\n";
p_cor += "Look for logic bugs, race/version CAS misses, dual-state period issues, lying types, unhandled nulls,\n";
p_cor += "broken error paths, tests that don't exercise real entry points.\n";
p_cor += "Files:\n" + file_list + "\n";
p_cor += "Return lens=\"correctness\" and up to 12 findings.\n";
jobs.push(#{ prompt: p_cor, label: "lens-correctness", capability_mode: "read-only", output_schema: findings_schema });

// security
let p_sec = "";
p_sec += BASE;
p_sec += "\nLENS: security & fail-closed.\n";
p_sec += "Authz/authn, cookies, redirects, secrets, injection, IDOR, CSRF, least privilege, silent empty success,\n";
p_sec += "parse that accepts too much, logging secrets. Non-security files: only flag real untrusted-input issues.\n";
p_sec += "Files:\n" + file_list + "\n";
p_sec += "Return lens=\"security\" and up to 12 findings.\n";
jobs.push(#{ prompt: p_sec, label: "lens-security", capability_mode: "read-only", output_schema: findings_schema });

// elegance
let p_el = "";
p_el += BASE;
p_el += "\nLENS: elegance, functional immutability, AI-navigability.\n";
p_el += "let/mutation, magic literals, entanglement, file/fn oversize, names that don't teach, dead surface,\n";
p_el += "speculative generality. Prefer deep extractions over shallow splits.\n";
p_el += "Files:\n" + file_list + "\n";
p_el += "Return lens=\"elegance\" and up to 12 findings.\n";
jobs.push(#{ prompt: p_el, label: "lens-elegance", capability_mode: "read-only", output_schema: findings_schema });

// comments
let p_cm = "";
p_cm += BASE;
p_cm += "\nLENS: comments / JSDoc / TODO markers (same policy as comment-hygiene workflow).\n";
p_cm += "3-line WHY budget; no narration/archaeology; JSDoc only packages/shared|ui public exports;\n";
p_cm += "TODO(<ref>): form; relocate-first for over-budget load-bearing.\n";
p_cm += "Files:\n" + file_list + "\n";
p_cm += "Return lens=\"comments\" and up to 12 findings.\n";
jobs.push(#{ prompt: p_cm, label: "lens-comments", capability_mode: "read-only", output_schema: findings_schema });

if is_web {
    let p_web = "";
    p_web += BASE;
    p_web += "\nLENS: web/React (skills: vercel-react-best-practices, vercel-composition-patterns, web-design-guidelines).\n";
    p_web += "Waterfalls, bundle bloat, boolean prop soup, missing composition, a11y (focus/labels/keyboard),\n";
    p_web += "English product strings, RSC/client boundaries mistakes.\n";
    p_web += "Files:\n" + file_list + "\n";
    p_web += "Return lens=\"web\" and up to 12 findings.\n";
    jobs.push(#{ prompt: p_web, label: "lens-web", capability_mode: "read-only", output_schema: findings_schema });
}

let lens_results = parallel(jobs);

let raw = [];
for r in lens_results {
    if r != () && r.success && r.output.findings != () {
        let lens = if r.output.lens != () { r.output.lens } else { "unknown" };
        for f in r.output.findings {
            if f.file != () && starts_with_root(f.file, root) {
                raw.push(#{
                    lens: lens,
                    file: f.file,
                    line: f.line,
                    severity: f.severity,
                    issue: f.issue,
                    fix_hint: f.fix_hint,
                });
            }
        }
    }
}

log("raw findings: " + raw.len().to_string());

if raw.len() == 0 {
    let clean = "# Excellence stack\n\nRoot `" + root + "`: no lens findings after review.\n";
    let path = write_scratch_file("excellence-stack-report.md", clean);
    complete(#{ summary: "Clean lenses on " + root, path: path, confirmed: [] });
}

// --- Verify ------------------------------------------------------------------

phase("Verify");

let to_v = [];
let i = 0;
while i < raw.len() && to_v.len() < max_verify {
    to_v.push(raw[i]);
    i += 1;
}
if raw.len() > max_verify {
    log("verify cap " + max_verify.to_string() + " of " + raw.len().to_string());
}

let vjobs = [];
let vix = 0;
for g in to_v {
    let enc = json_encode(if g.issue != () { g.issue } else { "" });
    let line_s = if g.line != () { g.line.to_string() } else { "?" };
    let vp = "";
    vp += BASE;
    vp += "\nAdversarially verify this finding. Prefer real=false without concrete evidence.\n";
    vp += "Lens: " + g.lens + " File: " + g.file + " Line: " + line_s + "\n";
    vp += "Claim JSON: " + enc + "\n";
    vp += "Read the file. evidence must quote code.\n";
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
let idx = 0;
for v in verdicts {
    if v != () && v.success && v.output.real == true
        && v.output.evidence != () && v.output.evidence != "" {
        confirmed.push(to_v[idx]);
    } else if v != () && v.success && v.output.real == false {
        rejected += 1;
    }
    idx += 1;
}

log("confirmed=" + confirmed.len().to_string() + " rejected=" + rejected.to_string());

// --- Report ------------------------------------------------------------------

phase("Report");

let report = "";
report += "# Excellence stack report\n\n";
report += "- **root:** `" + root + "`\n";
report += "- **files:** " + files.len().to_string() + "\n";
report += "- **web lens:** " + (if is_web { "on" } else { "off" }) + "\n";
report += "- **raw / confirmed / rejected:** "
    + raw.len().to_string() + " / "
    + confirmed.len().to_string() + " / "
    + rejected.to_string() + "\n\n";

report += "## Lenses used (skill map)\n\n";
report += "| lens | skill / source |\n| --- | --- |\n";
report += "| architecture | codebase-design, improve-codebase-architecture |\n";
report += "| correctness | exemplary-code-standard, domain invariants |\n";
report += "| security | fail-closed + authz practices |\n";
report += "| elegance | deep modules, functional immutability, AI-nav |\n";
report += "| comments | comment-hygiene policy |\n";
if is_web {
    report += "| web | vercel-react-best-practices, composition-patterns, web-design-guidelines |\n";
}
report += "\n## Confirmed findings\n\n";

for g in confirmed {
    let line_s = if g.line != () { g.line.to_string() } else { "?" };
    let sev = if g.severity != () { g.severity } else { "?" };
    let iss = if g.issue != () { g.issue } else { "" };
    let fix = if g.fix_hint != () { g.fix_hint } else { "" };
    report += "### `" + g.file + "`:" + line_s + " — **" + sev + "** (`" + g.lens + "`)\n\n";
    report += "- " + iss + "\n";
    report += "- **fix:** " + fix + "\n\n";
}

report += "## What to run next\n\n";
report += "1. Doc-only gaps → `/workflow comment-hygiene` mode=fix on this root\n";
report += "2. Numeric grade → `/workflow idealist-review` on this root\n";
report += "3. Behavior (web) → skill `ai-ui-driver`\n";
report += "4. Shallow modules → skill `improve-codebase-architecture`\n";
report += "5. After edits → skill `gates`\n";
report += "6. Operator map → skill `idealist-excellence`\n";

let out = write_scratch_file("excellence-stack-report.md", report);

complete(#{
    summary: confirmed.len().to_string() + " confirmed / " + raw.len().to_string()
        + " raw on " + files.len().to_string() + " files (" + root + ")",
    path: out,
    root: root,
    files: files.len(),
    confirmed: confirmed,
    rejected: rejected,
});
