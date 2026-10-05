#!/usr/bin/env bash
# Human-like pass over the key pages of the 4 roles, with Jev as a second judge of every page.
#   dogfood.sh [--out <dir>] [--no-jev]
# Per role: SAML sign-in in a named agent-browser session, then each key page is opened, screenshotted
# and read (snapshot, console, page errors). Jev (read-only, no typing) gets the session cookie from a
# file; it is an action model without a prose verdict, so its signals (clicked, left the page, stuck,
# failing requests) are summarised by scripts/full-run/dogfood-summary.ts. A page passes only when its snapshot has
# content and the browser reported no errors; Jev signals are leads to check against the screenshot,
# never a verdict. Exploratory dogfood (agent-browser skills get dogfood) is run by the agent on top
# of this evidence and written to dogfood-notes.md in the same directory.
set -euo pipefail
. "$(dirname "$0")/env.sh"

OUT="$STATE_DIR/dogfood-$(date +%Y%m%d-%H%M%S)"
JEV=1
while [ $# -gt 0 ]; do
  case "$1" in
    --out) OUT=${2:?--out needs a value}; shift 2 ;;
    --no-jev) JEV=0; shift ;;
    *) echo "Usage: $0 [--out <dir>] [--no-jev]" >&2; exit 2 ;;
  esac
done
command -v agent-browser >/dev/null || { echo "Missing tool: agent-browser (see README.md)" >&2; exit 1; }
[ "$JEV" = 0 ] || [ -n "${TYPESAFE_API_KEY:-}" ] || { echo "TYPESAFE_API_KEY is not set: pass --no-jev" >&2; exit 1; }
. "$STATE_DIR/secrets.env"
mkdir -p "$OUT"
BASE="http://localhost:$APP_PORT"
export AGENT_BROWSER_SESSION="${AGENT_BROWSER_SESSION:-$(agent-browser session id --scope worktree --prefix "dogfood-$(date +%s)-$$")}"
AB() { agent-browser "$@"; }

ROLES="lead:lead1@customreport.local:PW_LEAD1 head:head@customreport.local:PW_HEAD viewer:viewer@customreport.local:PW_VIEWER admin:admin@customreport.local:PW_ADMIN"
PAGES_lead="HOME /reports /reports/trends"
PAGES_head="/head/dashboard /reports /reports/trends"
PAGES_viewer="/reports/latest /reports /reports/trends"
PAGES_admin="/admin?tab=users /admin?tab=groups /admin?tab=products /admin?tab=periods /admin?tab=jobs /pdf-exports"

login() { # login <email> <password>
  AB cookies clear >/dev/null
  AB open "$BASE" >/dev/null
  AB wait --load networkidle >/dev/null
  AB eval "[...document.querySelectorAll('a')].find((a) => /sign in/i.test(a.textContent))?.click()" >/dev/null
  AB wait "#username" >/dev/null
  AB fill "#username" "$1" >/dev/null
  AB fill "#password" "$2" >/dev/null
  AB click "#kc-login" >/dev/null
  AB wait --url "$BASE/**" >/dev/null
  AB wait --load networkidle >/dev/null
}

echo -e "role\tpage\tverdict\tdetail\tjev" >"$OUT/summary.tsv"
for entry in $ROLES; do
  IFS=: read -r role email pwkey <<<"$entry"
  dir="$OUT/$role"; mkdir -p "$dir"
  # One retry: the stand allows 5 sign-ins a minute per address.
  login "$email" "${!pwkey}" || { sleep 65; login "$email" "${!pwkey}"; }
  home=$(AB eval "location.pathname" | tr -d '"')
  cookie="$dir/.cookie"
  (umask 077; AB cookies get --json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).data.cookies.find(c=>c.name==="customreport_session").value))' >"$cookie")
  pages_var="PAGES_$role"
  for page in ${!pages_var}; do
    [ "$page" = HOME ] && page=$home
    slug=$(echo "$page" | tr -c 'A-Za-z0-9\n' '_' | sed 's/^_*//')
    AB errors >/dev/null 2>&1 || true # drain earlier errors
    AB open "$BASE$page" >/dev/null
    AB wait --load networkidle >/dev/null
    sleep 1
    AB screenshot --full "$dir/$slug.png" >/dev/null
    AB snapshot -i >"$dir/$slug.snapshot.txt"
    AB console >"$dir/$slug.console.txt" 2>&1 || true
    AB errors >"$dir/$slug.errors.txt" 2>&1 || true
    final=$(AB eval "location.pathname + location.search" | tr -d '"')
    lines=$(wc -l <"$dir/$slug.snapshot.txt" | tr -d ' ')
    errs=$(grep -c . "$dir/$slug.errors.txt" || true)
    verdict=PASS; detail="$lines snapshot lines"
    [ "$lines" -ge 5 ] || { verdict=FAIL; detail="empty snapshot ($lines lines)"; }
    [ "$errs" -eq 0 ] || { verdict=FAIL; detail="$detail; $errs page errors"; }
    [ "$final" = "$page" ] || detail="$detail; landed on $final"
    jevnote=-
    if [ "$JEV" = 1 ]; then
      npx -y @jkudish/jev-browser run \
        "Read this page as a first-time $role user: scroll once to see it all. Do not click, open menus or change anything." \
        "$BASE$page" --no-typing --max-steps 3 --max-seconds 90 \
        --cookie-file "customreport_session=@$cookie" --screenshot "$dir/$slug.jev.jpg" >"$dir/$slug.jev.json" 2>"$dir/$slug.jev.err" || true
      jevnote=$slug.jev.json
    fi
    echo -e "$role\t$page\t$verdict\t$detail\t$jevnote" >>"$OUT/summary.tsv"
    echo "$role $page $verdict ($detail)"
  done
  rm -f "$cookie"
  sleep 15
done
echo "Dogfood evidence: $OUT (summary.tsv)"
