---
generated: 2026-05-11
target: apps/web/src/app/page.tsx (landing)
brand: Your PULSE? (display) / your-pulse (code)
budget: <50k tokens, 8 WebSearch queries used
verified_deps:
  installed:
    - next@^16.2.3
    - react@^19.2.5
    - tailwindcss@^4.2.2
    - geist@^1.7.0
    - lucide-react@^0.500.0
  NOT_installed:
    - framer-motion
    - motion
    - react-type-animation
    - gsap
constraints:
  - palette: starbucks-green (#1E3932, #006241, #00754A) + gold accent
  - tone: enterprise / corporate, not playful
  - perf: 60fps mobile, no lib > 3kb for animation
---

# Your PULSE? — Landing Rebrand Research

## 1. Existing solutions evaluated

Mandatory per `~/.claude/rules/behavior.md` "Wheel-reinvention gate". Before
writing any custom code, evaluated OSS / SaaS that already solve the pieces:

| Tool                                        | License | Coverage                                                  | Why not chosen                                                                                                                                     |
| ------------------------------------------- | ------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `motion` (ex `framer-motion`) v12           | MIT     | Full animation lib, has built-in `<Typewriter />` (1.3kb) | Adds ~30-50kb runtime for a single landing page. Worth it only if we use motion site-wide. Decision: **defer until 2nd animation surface needed**. |
| `react-type-animation`                      | MIT     | Dedicated typewriter, sequences                           | ~6kb. Overkill for our single phrase rotator.                                                                                                      |
| Aceternity UI / Magic UI / `shadcn.io/text` | MIT     | Copy-paste hero blocks, animated grid, beams              | Most components pull `framer-motion` as peer dep. Patterns usable, dependency not. **Steal the CSS, skip the lib.**                                |
| `tailwindcss-hero-patterns`                 | MIT     | SVG hero background plugin                                | Static patterns only; we need a living/animated background.                                                                                        |
| Vercel Geist Pixel / Geist Mono             | MIT     | Display + mono variable fonts                             | `geist@^1.7.0` already installed — reuse, do not add a new family.                                                                                 |
| Lottie + bodymovin ECG                      | MIT     | Designer-driven heartbeat animation                       | Adds `lottie-web` (~250kb). Vastly overkill for a single ECG line that pure SVG + CSS can do in <1kb.                                              |
| `auroral` (LunarLogic)                      | MIT     | Pure-CSS aurora background                                | Reference-only; we will inline the 30-line CSS, not add a dep.                                                                                     |

**Conclusion — hybrid.** Reuse Geist (already installed) + inline CSS / SVG +
≤30 lines of vanilla TS for the headline rotator. Defer `motion` until a
second site-wide animation surface (dashboard, transitions) justifies the
runtime cost. This is the "wheel" answer: there is no whole-product to adopt,
but there is plenty of pattern-level prior art to copy without taking on
dependencies.

```
decision tree:
  need animation?
       │
   ┌───┴───┐
  yes      no
   │        └─→ static SVG hero pattern (current)
   │
  scope?
   │
   ┌────────┬─────────┐
  1 page   3+ pages   complex timeline
   │         │            │
   ▼         ▼            ▼
 CSS +     motion       GSAP
 vanilla   library      (overkill here)
 TS        ← future
 ← NOW
```

---

## 2. Hero typography — three variants

### Variant A — Geist Variable, weight-axis kinetic reveal ← рекомендую

Visual: `Your` thin (weight 200) → `PULSE` ultra (weight 900) → `?` italic gold,
slightly oversized, baseline-shifted up. Single line, no decoration. The
weight gradient _is_ the brand statement — light → heavy mirrors the "pulse
building up" metaphor without literal iconography.

Font: **Geist Variable** (already installed via `geist@1.7.0`). Variable fonts
crossed from trend to best-practice in 2026; weight is a continuous axis so we
can animate it smoothly on mount without cross-fading two font files.

```tsx
// apps/web/src/app/page.tsx (hero block)
<h1 className="font-sans flex items-baseline gap-[0.05em] text-[clamp(48px,8vw,112px)] leading-none tracking-[-0.04em] text-white">
  <span style={{ fontVariationSettings: '"wght" 250' }} className="opacity-80">
    Your
  </span>
  <span
    style={{ fontVariationSettings: '"wght" 900' }}
    className="bg-gradient-to-b from-white to-white/85 bg-clip-text text-transparent"
  >
    PULSE
  </span>
  <span
    aria-hidden
    className="text-[var(--color-starbucks-gold)] italic translate-y-[-0.08em]"
    style={{ fontVariationSettings: '"wght" 700' }}
  >
    ?
  </span>
</h1>
```

Trade-off: variable-axis trick reads premium only with Geist's full variable
file — confirm the bundle ships the variable subset, not 9 fixed weights. If
`geist@1.7` exposes only fixed cuts, fall back to `font-thin` / `font-black`
(visually 90% of the effect, loses the kinetic-mount option).

Source: [Vercel Geist Typography](https://vercel.com/geist/typography),
[Kittl: Variable fonts in 2026](https://www.kittl.com/blogs/why-variable-fonts-are-winning-fnt/).

### Variant B — Geist Mono, terminal-credibility framing

Visual: `your-pulse?` in Geist Mono, lowercase, with the `?` glyph rendered
in gold and a blinking cursor `_` after it. Whole line treated as a CLI token.
Speaks to a developer/internal-tool audience.

```tsx
<h1 className="font-mono text-[clamp(36px,5vw,72px)] tracking-[-0.02em] text-white">
  <span className="opacity-60">$&nbsp;</span>
  your-pulse
  <span className="text-[var(--color-starbucks-gold)]">?</span>
  <span className="ml-1 inline-block w-[0.4em] animate-pulse bg-white/90 align-baseline h-[1em]" />
</h1>
```

Trade-off: terminal aesthetic is recognised by tech audiences (Linear, Vercel,
Stripe) but reads "internal tooling" rather than "executive product". For a
Development department lead-facing app this is on-brand, but the director (final
consumer of reports) may read it as low-polish. Pick this if leads are the
primary audience.

Source: [SaaS terminal aesthetic — Linear/Vercel/Stripe](https://www.loungelizard.com/blog/font-trend/).

### Variant C — Editorial display, Yahoo-style angled punctuation

Visual: `Your PULSE` set in Geist Black, the `?` rotated ~15°, sized 1.2× the
cap height, in gold. Mimics Pentagram's Yahoo `!` treatment — the punctuation
becomes the logo mark. The slanted glyph doubles as a brand mark that can
extract into the favicon / nav.

```tsx
<h1 className="font-sans text-[clamp(56px,9vw,128px)] font-black leading-[0.95] tracking-[-0.045em] text-white">
  Your PULSE
  <span
    className="inline-block text-[var(--color-starbucks-gold)] origin-bottom-left translate-y-[0.05em]"
    style={{ transform: "rotate(15deg) scale(1.2)", display: "inline-block" }}
  >
    ?
  </span>
</h1>
```

Trade-off: strongest brand-mark potential (the rotated `?` extracts into a
standalone logo), but rotation can read "playful" — risky for enterprise
context unless rotation stays subtle (≤15°). Highest visual identity payoff,
highest taste risk.

Source: [Pentagram Yahoo rebrand](https://www.pentagram.com/work/yahoo/story),
[Dezeen on Yahoo `!` treatment](https://www.dezeen.com/2019/09/26/yahoo-logo-rebrand-pentagram/).

---

## 3. Text animation — three variants

### Variant A — Pure CSS `@keyframes` headline rotator ← рекомендую

Implementation: under the hero, a sub-headline that cycles through a list
of value propositions. Pure CSS keyframes drive a vertical translate +
opacity per frame. Zero JS, zero deps, hardware-accelerated.

```css
/* globals.css — locked to the rotator class */
@keyframes rotator-cycle {
  0%,
  18% {
    transform: translateY(0);
    opacity: 1;
  }
  22%,
  25% {
    transform: translateY(-100%);
    opacity: 0;
  }
  29%,
  47% {
    transform: translateY(-100%);
    opacity: 1;
  }
  51%,
  54% {
    transform: translateY(-200%);
    opacity: 0;
  }
  /* …continue per phrase, end frame returns to 0% */
}
.rotator-track {
  display: inline-flex;
  flex-direction: column;
  animation: rotator-cycle 12s infinite cubic-bezier(0.7, 0, 0.3, 1);
}
@media (prefers-reduced-motion: reduce) {
  .rotator-track {
    animation: none;
  }
}
```

```tsx
<p className="text-lg text-white/70 overflow-hidden h-[1.4em]">
  Pulse of&nbsp;
  <span className="rotator-track text-[var(--color-starbucks-gold)]">
    <span>products</span>
    <span>weekly status</span>
    <span>your department</span>
    <span>products</span>
    {/* loop seam */}
  </span>
</p>
```

Perf cost: ~0 bytes JS, GPU-accelerated `transform` + `opacity` (only
properties browsers can composite without layout). 60fps trivial on mobile.

Trade-off: phrase list is baked into CSS — adding/removing entries needs both
JSX and keyframe edits. For >4 phrases or i18n-driven content, switch to
Variant B.

Source: [LogRocket: CSS-only typewriter](https://blog.logrocket.com/creating-typewriter-animation-css/),
[HowToGeek: pure-CSS typing](https://www.howtogeek.com/add-a-smooth-typewriter-animation-to-your-website-without-any-javascript/).

### Variant B — Vanilla TS rotator with `useEffect` + Web Animations API

For dynamic / i18n phrase lists. ~25 lines of TS, no library.

```tsx
const PHRASES = ["products", "weekly status", "your department", "leadership"];
function useRotator(phrases: string[], dwell = 2400) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = window.setInterval(
      () => setI((v) => (v + 1) % phrases.length),
      dwell,
    );
    return () => window.clearInterval(id);
  }, [phrases, dwell]);
  return phrases[i];
}
// Pair with CSS transition on opacity + translateY for the swap.
```

Perf cost: one `setInterval`, one re-render per dwell window. Trivial.

Trade-off: needs reduced-motion handling in JS (`matchMedia`), and the swap
animation still lives in CSS — you're paying JS for orchestration only.

Source: [LogRocket: 5 ways to implement typing animation in React](https://blog.logrocket.com/5-ways-implement-typing-animation-react/).

### Variant C — `motion`'s `<Typewriter />` (1.3kb component, requires the lib)

Only if we commit to adding `motion@12` site-wide. Best ergonomics, worst
trade for a single-surface use.

```tsx
import { Typewriter } from "motion-plus/react";
<Typewriter sequence={["products", 1500, "weekly status", 1500 /*…*/]} />;
```

Perf cost: the component is 1.3kb, but the runtime (`motion`) is ~30-50kb.
Bundle math only works if motion ships ≥2 other animations on the page.

Trade-off: cleanest API, dynamic sequences, intelligent backspacing — all
wasted budget when CSS keyframes solve the rotation in 0 JS.

Source: [motion.dev Typewriter docs](https://motion.dev/docs/react-typewriter).

---

## 4. Background — three variants

### Variant B — SVG ECG line, single-stroke `stroke-dashoffset` loop ← рекомендую

Visual: one horizontal ECG/heartbeat path drawn across the full hero width,
fading on the edges via a CSS mask. Animates by sweeping
`stroke-dashoffset` from `pathLength` to `0`, then resetting. Gives the
literal "pulse" metaphor without medical-app cliché — restraint is key.

```tsx
// In the hero panel, behind the typography
<svg
  className="pointer-events-none absolute inset-0 h-full w-full opacity-25 [mask-image:linear-gradient(to_right,transparent,black_15%,black_85%,transparent)]"
  viewBox="0 0 1200 200"
  preserveAspectRatio="none"
  aria-hidden
>
  <path
    d="M0,100 L300,100 L320,100 L335,60 L355,140 L370,100 L1200,100"
    stroke="var(--color-starbucks-gold)"
    strokeWidth="2"
    fill="none"
    pathLength="1"
    className="ecg-path"
  />
</svg>
```

```css
.ecg-path {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: ecg-sweep 4s linear infinite;
}
@keyframes ecg-sweep {
  0% {
    stroke-dashoffset: 1;
  }
  60% {
    stroke-dashoffset: 0;
  }
  100% {
    stroke-dashoffset: 0;
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .ecg-path {
    animation: none;
    stroke-dashoffset: 0;
    opacity: 0.25;
  }
}
```

Perf budget: single SVG path, ~150 bytes, animated via compositor-friendly
`stroke-dashoffset` (Chrome / Safari / Firefox handle this on GPU since ~2022).
60fps trivial. Bundle delta: zero.

Trade-off: SVG `stroke-dashoffset` is technically a paint-property animation
in some engines — measure with `chrome-devtools-mcp` Performance panel before
shipping to verify it doesn't trigger main-thread paint storms on mobile
Safari. If it does, fall back to Variant A.

Source: [Codeconvey CSS heartbeat monitor](https://codeconvey.com/css-heartbeat-monitor-animation/),
[CampusHippo heartbeat with CSS+SVG](https://campushippo.com/lessons/how-to-animate-a-heartbeat-with-css-and-svg-10918291a),
[Vectosolve SVG animation 2026](https://vectosolve.com/blog/svg-animations-css-javascript-2026).

### Variant A — Aurora gradient (Stripe / Apple style), stacked radial-gradients

Visual: three radial-gradient layers in starbucks-green family + one gold
highlight, each animated on `background-position` with different speeds.
A 100px blur filter blends them into the "aurora" wash. Living, atmospheric,
non-literal.

```tsx
<div className="absolute inset-0 -z-10 overflow-hidden">
  <div
    className="absolute -inset-20 opacity-70 blur-[100px]"
    style={{
      background: `
        radial-gradient(circle at 20% 30%, #006241 0%, transparent 40%),
        radial-gradient(circle at 80% 20%, #00754A 0%, transparent 45%),
        radial-gradient(circle at 50% 80%, #cba258 0%, transparent 35%),
        #1E3932
      `,
      animation: "aurora-drift 18s ease-in-out infinite alternate",
      backgroundSize: "200% 200%",
    }}
  />
</div>
```

```css
@keyframes aurora-drift {
  0% {
    background-position: 0% 0%;
  }
  100% {
    background-position: 100% 100%;
  }
}
```

Perf budget: `blur(100px)` is the cost driver — measurably expensive on low-end
mobile (filter triggers compositor-layer rasterization). Mitigate with
`will-change: transform` and a smaller blur radius on mobile via media query.

Trade-off: best atmospheric/premium feel, but loses the literal "pulse"
metaphor. Pair with Variant B (ECG) on top for the win, see §5.

Source: [Albert Walicki: Aurora UI with CSS](https://dev.to/albertwalicki/aurora-ui-how-to-create-with-css-4b6g),
[Dalton Walsh: Aurora CSS background](https://daltonwalsh.com/blog/aurora-css-background-effect/).

### Variant C — Animated dot/cross grid with mask fade

Visual: the current cross-pattern, but with a slow drift animation via
`background-position` keyframes and a radial-gradient mask that fades the
pattern toward the edges. Closest to the existing look — lowest disruption,
lowest payoff.

```tsx
<div
  className="absolute inset-0 opacity-40"
  style={{
    backgroundImage: `url("data:image/svg+xml,…cross pattern…")`,
    backgroundSize: "60px 60px",
    animation: "grid-drift 30s linear infinite",
    maskImage: "radial-gradient(ellipse at center, black 40%, transparent 90%)",
  }}
/>
```

```css
@keyframes grid-drift {
  from {
    background-position: 0 0;
  }
  to {
    background-position: 60px 60px;
  }
}
```

Perf budget: ~0 — `background-position` on a small tile is the cheapest
animation in the browser.

Trade-off: visually static — fails the "pulse / living rhythm" brief. Keep as
a fallback under Variant B's ECG line for texture.

Source: [Magic UI animated grid pattern](https://magicui.design/docs/components/animated-grid-pattern),
[Aceternity hero with beams + grid](https://ui.aceternity.com/blocks/hero-sections/hero-section-with-beams-and-grid).

---

## 5. Recommended combo

```
┌─ Your PULSE? winning stack ─────────────────────────────┐
│ typography:  Variant A — Geist Variable, weight-kinetic │
│ animation:   Variant A — pure-CSS keyframe rotator      │
│ background:  Variant B — SVG ECG line  (on top of)      │
│              Variant C — drifting cross-grid (texture)  │
│ deps added:  none                                       │
│ bundle Δ:    ~0 bytes JS, ~200 bytes inline SVG/CSS     │
│ a11y:        prefers-reduced-motion respected on all 3  │
└─────────────────────────────────────────────────────────┘
```

Why this combo wins for our context (corporate SaaS, dark-green palette,
"pulse" metaphor, audience = department leads + director):

1. **Zero new dependencies.** Stack is Next 16 + React 19 + Tailwind v4 +
   Geist — all already shipped. The whole rebrand is CSS + SVG + JSX. No
   `motion`, no `gsap`, no Lottie. Aligns with the wheel-reinvention rule:
   we are explicitly _not_ adding a runtime when CSS solves it.
2. **Pulse metaphor expressed three ways.** Weight gradient in the headline
   (`Your`→`PULSE`) = visual crescendo. Sub-headline rotator = rhythmic
   cadence. ECG sweep behind = literal heartbeat. The three reinforce each
   other without any single element being heavy-handed.
3. **Perf budget intact.** Every animation uses compositor-friendly
   properties (`transform`, `opacity`, `stroke-dashoffset`). 60fps trivially
   achievable on mid-range mobile. No `blur()` filter in the recommended
   path — Aurora was rejected for this reason on the primary path, though
   it remains a strong fallback if the ECG reads too "medical".
4. **Brand identity is extractable.** The Geist-Variable headline + gold `?`
   accent can mint a favicon and nav mark (`y!`-style monogram approach
   from Pentagram). No rebuild needed for derived surfaces.
5. **Enterprise-credible.** No playful rotation, no neon, no glitch effects.
   The "pulse" is read at second glance, not first — which is the right tone
   for a system the director consumes weekly.

**Risk on the primary path:** if `geist@1.7` ships only fixed weight cuts and
not the variable subset, the headline kinetic-mount degrades to a static
weight contrast (still 90% of the effect). Verify in commit 1 before
shipping the kinetic mount animation.

---

## 6. Implementation roadmap

5 commits, each independently shippable and verifiable:

```
[c1] verify geist variable ──┐
[c2] hero typography swap ───┼─ parallel after c1
[c3] CSS rotator             │
[c4] ECG SVG + grid drift ───┘
                              ▼
[c5] cleanup + perf trace + a11y check
```

| #   | Commit                                                                   | Files                                                                                                                                                                                                                 | Verification                                                                                                        |
| --- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| c1  | `chore(web): verify Geist variable axis available`                       | inspect `node_modules/geist/dist/*` for variable woff2; doc finding in `RESEARCH.md` followup                                                                                                                         | `font-variation-settings: "wght" 600` renders distinctly from `"wght" 700` in devtools                              |
| c2  | `feat(web): UFB-XXX — Your PULSE? hero typography (rebrand 01)`          | `apps/web/src/app/page.tsx` (replace left-panel `<div>{orgShortName}</div>` block with variant-A headline; preserve `orgQ` fallback gracefully — when API returns custom org, show org name instead of "Your PULSE?") | manual visual at `/?stay=1`; Playwright visual snapshot update                                                      |
| c3  | `feat(web): UFB-XXX — animated sub-headline rotator (rebrand 02)`        | `apps/web/src/app/page.tsx` (sub-headline), `apps/web/src/app/globals.css` (`@keyframes rotator-cycle`, `.rotator-track`, reduced-motion guard)                                                                       | DOM: track element exists; animation listed in devtools Animations panel; `prefers-reduced-motion` disables it      |
| c4  | `feat(web): UFB-XXX — ECG pulse + drifting grid background (rebrand 03)` | `apps/web/src/app/page.tsx` (replace inline SVG cross-pattern bg with stacked grid-drift + ECG line), `apps/web/src/app/globals.css` (`@keyframes ecg-sweep`, `grid-drift`)                                           | `chrome-devtools-mcp` Performance trace: hero ≤3 dropped frames per 5s capture; no main-thread block >50ms          |
| c5  | `chore(web): UFB-XXX — perf trace + a11y audit (rebrand close)`          | docs: trace screenshot, axe report, ROADMAP/backlog close                                                                                                                                                             | `pnpm -F @customreport/web test:e2e -- --grep landing` green; axe shows no new violations; visual snapshots updated |

Each commit keeps the right-panel SSO card untouched — the rebrand is
left-panel only. The `orgQ` fallback chain (`shortName` → "Demo") becomes:
when `orgQ.data?.shortName === 'Demo'` or undefined, render the new "Your
PULSE?" headline; otherwise render the customer org name in the same typo
treatment so the rebrand doubles as a multi-tenant identity slot.

---

## Sources

- [Vercel Geist Typography](https://vercel.com/geist/typography)
- [Kittl — Variable fonts winning in 2026](https://www.kittl.com/blogs/why-variable-fonts-are-winning-fnt/)
- [Lounge Lizard — 2026 font trends](https://www.loungelizard.com/blog/font-trend/)
- [Creative Bloq — 2026 typography trends](https://www.creativebloq.com/design/fonts-typography/breaking-rules-and-bringing-joy-top-typography-trends-for-2026)
- [Pentagram — Yahoo rebrand case study](https://www.pentagram.com/work/yahoo/story)
- [Dezeen — Yahoo `!` 22.5° angle](https://www.dezeen.com/2019/09/26/yahoo-logo-rebrand-pentagram/)
- [motion.dev — Typewriter component (1.3kb)](https://motion.dev/docs/react-typewriter)
- [LogRocket — CSS-only typewriter animation](https://blog.logrocket.com/creating-typewriter-animation-css/)
- [LogRocket — 5 ways typing animation in React](https://blog.logrocket.com/5-ways-implement-typing-animation-react/)
- [HowToGeek — pure-CSS typewriter](https://www.howtogeek.com/add-a-smooth-typewriter-animation-to-your-website-without-any-javascript/)
- [LogRocket — best React animation libs 2026](https://blog.logrocket.com/best-react-animation-libraries/)
- [Codeconvey — CSS heartbeat monitor animation](https://codeconvey.com/css-heartbeat-monitor-animation/)
- [CampusHippo — heartbeat animation with CSS+SVG](https://campushippo.com/lessons/how-to-animate-a-heartbeat-with-css-and-svg-10918291a)
- [Vectosolve — SVG animations 2026](https://vectosolve.com/blog/svg-animations-css-javascript-2026)
- [Albert Walicki — Aurora UI with CSS](https://dev.to/albertwalicki/aurora-ui-how-to-create-with-css-4b6g)
- [Dalton Walsh — Aurora CSS background](https://daltonwalsh.com/blog/aurora-css-background-effect/)
- [Magic UI — animated grid pattern](https://magicui.design/docs/components/animated-grid-pattern)
- [Aceternity UI — hero with beams + grid](https://ui.aceternity.com/blocks/hero-sections/hero-section-with-beams-and-grid)
