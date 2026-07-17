#!/usr/bin/env python3
"""Render the mass-review dataset into the self-contained artifact page."""
import html
import json
import os

SC = os.path.dirname(os.path.abspath(__file__))
data = json.load(open(f"{SC}/review-data.json"))
codex = json.load(open(f"{SC}/codex-verdicts.json")) if os.path.exists(f"{SC}/codex-verdicts.json") else []
council = json.load(open(f"{SC}/council.json")) if os.path.exists(f"{SC}/council.json") else None

codex_by_key = {(c["file"], c["line"]): c for c in codex}

files = []
for f in data["files"]:
    path = f["file"]
    if path.startswith("/home/user/work/customreport/"):
        path = path[len("/home/user/work/customreport/"):]
    findings = []
    for fd in f["findings"]:
        k = (f["file"], fd["line"])
        status = "minor"
        note = ""
        if fd["severity"] in ("major", "blocker"):
            cm = next((m for m in data["confirmedMajors"] if (m["file"], m["line"]) == k), None)
            rm = next((m for m in data["refutedMajors"] if (m["file"], m["line"]) == k), None)
            cx = codex_by_key.get(k)
            if cm:
                status, note = "confirmed", ""
            elif rm:
                status, note = "refuted", rm.get("reason", "")
            elif cx:
                status = "refuted" if cx["refuted"] else "confirmed"
                note = "Codex: " + cx.get("reason", "")
            else:
                status = "unverified"
        findings.append({"sev": fd["severity"], "line": fd["line"], "issue": fd["issue"], "status": status, "note": note})
    verdict = f["verdict"]
    majors = [x for x in findings if x["sev"] != "minor"]
    # Downgrade a defect verdict ONLY when every major finding was explicitly
    # refuted; an unverified major keeps the defect verdict (never hide risk).
    if verdict == "defect" and majors and all(x["status"] == "refuted" for x in majors):
        verdict = "needs-attention"
    files.append({"file": path, "verdict": verdict, "summary": f["summary"], "findings": findings})

files.sort(key=lambda f: ({"defect": 0, "needs-attention": 1, "good": 2, "exemplary": 3}[f["verdict"]], f["file"]))
counts = {}
for f in files:
    counts[f["verdict"]] = counts.get(f["verdict"], 0) + 1
confirmed = [
    {"file": f["file"], "line": x["line"], "issue": x["issue"], "note": x["note"]}
    for f in files for x in f["findings"] if x["status"] == "confirmed"
]

DATA = json.dumps({"files": files}, ensure_ascii=False).replace("</", "<\\/")

def chip(v, n=None):
    label = {"exemplary": "exemplary", "good": "good", "needs-attention": "needs attention", "defect": "defect"}[v]
    return f'<span class="chip chip-{v}">{label}{"" if n is None else f" · {n}"}</span>'

stat_row = "".join(
    f'<div class="stat"><div class="stat-n">{counts.get(v, 0)}</div><div class="stat-l">{chip(v)}</div></div>'
    for v in ("exemplary", "good", "needs-attention", "defect")
)

conf_rows = "".join(
    f'<li><code>{html.escape(c["file"])}:{c["line"]}</code><p>{html.escape(c["issue"])}</p>'
    + (f'<p class="note">{html.escape(c["note"])}</p>' if c["note"] else "")
    + "</li>"
    for c in confirmed
)

council_html = ""
if council:
    seats = "".join(
        f'<div class="seat"><h3>{html.escape(s["seat"])}</h3><p>{html.escape(s["opinion"])}</p></div>'
        for s in council["seats"]
    )
    plan = "".join(f'<li><strong>{html.escape(p["title"])}</strong> — {html.escape(p["detail"])}</li>' for p in council["plan"])
    council_html = f'<section><h2>Council & action plan</h2><div class="seats">{seats}</div><ol class="plan">{plan}</ol></section>'

page = f"""<title>CustomReport — mass review, {len(files)} files</title>
<style>
:root {{
  --bg:#f7f8fa; --panel:#ffffff; --ink:#1c2433; --muted:#5b6577; --line:#dfe3ea;
  --accent:#3451b2; --ok:#0f7a58; --neut:#5b6577; --warn:#9a6a10; --crit:#b03030;
  --ok-bg:#e5f4ee; --neut-bg:#eef0f4; --warn-bg:#f8efdc; --crit-bg:#f9e7e7;
}}
@media (prefers-color-scheme: dark) {{ :root {{
  --bg:#141821; --panel:#1c2230; --ink:#e6eaf2; --muted:#98a2b5; --line:#2b3346;
  --accent:#8ea4e8; --ok:#4cc39a; --neut:#98a2b5; --warn:#d9a84e; --crit:#e07b7b;
  --ok-bg:#17342a; --neut-bg:#232a3a; --warn-bg:#38301c; --crit-bg:#3a2323;
}} }}
:root[data-theme="light"] {{
  --bg:#f7f8fa; --panel:#ffffff; --ink:#1c2433; --muted:#5b6577; --line:#dfe3ea;
  --accent:#3451b2; --ok:#0f7a58; --neut:#5b6577; --warn:#9a6a10; --crit:#b03030;
  --ok-bg:#e5f4ee; --neut-bg:#eef0f4; --warn-bg:#f8efdc; --crit-bg:#f9e7e7;
}}
:root[data-theme="dark"] {{
  --bg:#141821; --panel:#1c2230; --ink:#e6eaf2; --muted:#98a2b5; --line:#2b3346;
  --accent:#8ea4e8; --ok:#4cc39a; --neut:#98a2b5; --warn:#d9a84e; --crit:#e07b7b;
  --ok-bg:#17342a; --neut-bg:#232a3a; --warn-bg:#38301c; --crit-bg:#3a2323;
}}
body {{ background:var(--bg); color:var(--ink); font:15px/1.55 system-ui,-apple-system,sans-serif; margin:0; }}
main {{ max-width:70rem; margin:0 auto; padding:2.5rem 1.25rem 5rem; display:flex; flex-direction:column; gap:2.25rem; }}
h1 {{ font-size:1.6rem; margin:0; text-wrap:balance; }}
h2 {{ font-size:1.15rem; margin:0 0 .75rem; }}
.sub {{ color:var(--muted); margin:.35rem 0 0; }}
.stats {{ display:flex; gap:1rem; flex-wrap:wrap; }}
.stat {{ background:var(--panel); border:1px solid var(--line); border-radius:6px; padding:.9rem 1.3rem; min-width:8.5rem; }}
.stat-n {{ font-size:1.9rem; font-weight:650; font-variant-numeric:tabular-nums; }}
.chip {{ display:inline-block; font-size:.72rem; letter-spacing:.04em; text-transform:uppercase; padding:.12rem .5rem; border-radius:999px; font-weight:600; }}
.chip-exemplary {{ color:var(--ok); background:var(--ok-bg); }}
.chip-good {{ color:var(--neut); background:var(--neut-bg); }}
.chip-needs-attention {{ color:var(--warn); background:var(--warn-bg); }}
.chip-defect {{ color:var(--crit); background:var(--crit-bg); }}
section {{ background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:1.4rem 1.5rem; }}
code {{ font:0.85em ui-monospace,SFMono-Regular,monospace; }}
.confirmed li {{ margin:0 0 1rem; }} .confirmed p {{ margin:.25rem 0 0; }}
.note {{ color:var(--muted); font-size:.88em; }}
.filters {{ display:flex; gap:.5rem; flex-wrap:wrap; margin-bottom:1rem; align-items:center; }}
.filters button {{ border:1px solid var(--line); background:var(--panel); color:var(--ink); border-radius:999px; padding:.3rem .85rem; cursor:pointer; font:inherit; font-size:.85rem; }}
.filters button[aria-pressed="true"] {{ border-color:var(--accent); color:var(--accent); font-weight:600; }}
.filters input {{ flex:1; min-width:14rem; border:1px solid var(--line); background:var(--bg); color:var(--ink); border-radius:6px; padding:.45rem .7rem; font:inherit; }}
.filters button:focus-visible, .filters input:focus-visible, details summary:focus-visible {{ outline:2px solid var(--accent); outline-offset:2px; }}
#tbl {{ display:flex; flex-direction:column; gap:.25rem; }}
details {{ border-bottom:1px solid var(--line); }}
details summary {{ display:flex; gap:.9rem; align-items:baseline; padding:.5rem .25rem; cursor:pointer; list-style:none; }}
details summary::-webkit-details-marker {{ display:none; }}
details .body {{ padding:.25rem .25rem 1rem; color:var(--muted); }}
details .body ul {{ margin:.5rem 0 0; padding-left:1.2rem; }}
.f-path {{ font:0.85rem ui-monospace,monospace; flex:1; overflow-wrap:anywhere; }}
.sev {{ font-weight:600; }}
.sev-confirmed {{ color:var(--crit); }} .sev-refuted {{ color:var(--muted); text-decoration:line-through; }}
.sev-unverified {{ color:var(--warn); }} .sev-minor {{ color:var(--muted); }}
.seats {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(16rem,1fr)); gap:1rem; margin-bottom:1rem; }}
.seat {{ border:1px solid var(--line); border-radius:6px; padding:.9rem 1rem; }}
.seat h3 {{ margin:0 0 .4rem; font-size:.8rem; letter-spacing:.05em; text-transform:uppercase; color:var(--accent); }}
.seat p {{ margin:0; font-size:.92em; }}
.plan li {{ margin:0 0 .6rem; }}
</style>
<main>
<header>
  <h1>CustomReport — массовое ревью кода</h1>
  <p class="sub">{len(files)} файлов · Opus-ревью каждого файла · адверсарная верификация major-находок (Opus + Codex) · 2026-07-17 · main@c9bb1edc</p>
</header>
<div class="stats">{stat_row}</div>
<section><h2>Подтверждённые находки ({len(confirmed)})</h2><ul class="confirmed">{conf_rows}</ul></section>
{council_html}
<section>
<h2>Все файлы</h2>
<div class="filters">
  <button data-v="all" aria-pressed="true">все</button>
  <button data-v="defect" aria-pressed="false">defect</button>
  <button data-v="needs-attention" aria-pressed="false">needs attention</button>
  <button data-v="good" aria-pressed="false">good</button>
  <button data-v="exemplary" aria-pressed="false">exemplary</button>
  <input id="q" type="search" placeholder="фильтр по пути…" aria-label="фильтр по пути">
</div>
<div id="tbl"></div>
</section>
</main>
<script>
const DATA = {DATA};
const tbl = document.getElementById("tbl");
const q = document.getElementById("q");
let verdict = "all";
const chipCls = v => "chip chip-" + v;
const chipTxt = v => v === "needs-attention" ? "needs attention" : v;
function render() {{
  const needle = q.value.toLowerCase();
  const rows = DATA.files.filter(f =>
    (verdict === "all" || f.verdict === verdict) && f.file.toLowerCase().includes(needle));
  tbl.innerHTML = rows.slice(0, 1500).map(f => {{
    const fs = f.findings.map(x =>
      `<li><span class="sev sev-${{x.sev === "minor" ? "minor" : x.status}}">${{x.sev === "minor" ? "minor" : x.status}}</span> · :${{x.line}} — ${{esc(x.issue)}}${{x.note ? `<div class="note">${{esc(x.note)}}</div>` : ""}}</li>`).join("");
    return `<details><summary><span class="${{chipCls(f.verdict)}}">${{chipTxt(f.verdict)}}</span><span class="f-path">${{esc(f.file)}}</span><span class="note">${{f.findings.length ? f.findings.length + " наход." : ""}}</span></summary><div class="body">${{esc(f.summary)}}${{fs ? "<ul>" + fs + "</ul>" : ""}}</div></details>`;
  }}).join("");
}}
function esc(s) {{ const d = document.createElement("i"); d.textContent = s; return d.innerHTML; }}
document.querySelectorAll(".filters button").forEach(b => b.addEventListener("click", () => {{
  verdict = b.dataset.v;
  document.querySelectorAll(".filters button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
  render();
}}));
q.addEventListener("input", render);
render();
</script>
"""
out = f"{SC}/mass-review-artifact.html"
open(out, "w").write(page)
print("written", out, "bytes:", os.path.getsize(out), "| verdicts:", counts, "| confirmed:", len(confirmed))
