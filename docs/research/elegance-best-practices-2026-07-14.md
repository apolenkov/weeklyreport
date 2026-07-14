# Simple, Elegant Code & Architecture in a TypeScript Monorepo — Research (2026-07-14)

Scope: current (2024–2026) authoritative best practices for simple, elegant code and
architecture in a TypeScript monorepo (Next.js/React 19 frontend, NestJS/tRPC/Prisma
backend). External web research only; primary sources cited per claim.

## TL;DR

- Depth beats size: judge a function/module by interface-simplicity vs functionality hidden, not by line count. Hard line limits are contested; the Ousterhout–Martin 2025 debate is the primary source on both sides.
- Extraction test (Fowler): extract when intention and implementation separate — the new name must say _what_, freeing the caller from _how_. Never extract just to hit a length number.
- Don't abstract early: duplication is cheaper than the wrong abstraction (Metz); prefer AHA — abstract only when use cases are known (Dodds, Abramov).
- Grug doctrine: complexity is the enemy ("complexity demon"); prefer 80/20 solutions and locality of behavior over speculative factoring.
- Tidy First (Beck): structure changes and behavior changes go in separate, small, reversible commits; tidy right before the behavior change that needs it.
- Barrel files: actively discouraged for app-internal code by Next.js/Vercel (compile + bundle cost, cycle risk); acceptable only as a package's curated public entry point.
- Module boundaries must be machine-enforced (eslint-plugin-boundaries, `import/no-restricted-paths`, dependency-cruiser `no-circular`), never by convention alone.
- tRPC official pattern: nested domain routers composed in one root `appRouter`; `mergeRouters` only for a flat namespace.
- Lint regime: strict type-aware configs + ratchet (violations only monotonically decrease, per Notion); every `eslint-disable` needs a `-- reason` description, enforceable by rule.
- "Elegant" is reviewable when reduced to mechanical checks: Google's standard is "does this CL improve code health?" plus "could it be simpler?" — see the checklist in the last section.

---

## 1. Code simplicity

### Function size and complexity discipline

- Fowler's rule for extraction is semantic, not numeric: separate intention from implementation; if you must read a fragment to know _what_ it does, extract and name it after the what. He personally writes very small functions, but the driver is naming, not a line limit — and small functions only work "if the names are good". — https://martinfowler.com/bliki/FunctionLength.html
- Cognitive complexity (SonarSource) is the modern successor to cyclomatic complexity: it penalizes nesting and control-flow breaks the way a human reader experiences them, and is the metric behind `sonarjs/cognitive-complexity`. — https://www.sonarsource.com/docs/CognitiveComplexity.pdf and https://github.com/SonarSource/eslint-plugin-sonarjs/blob/master/docs/rules/cognitive-complexity.md
- Sonar's practical advice for reducing cognitive complexity: extract complex conditions into well-named helpers, use early returns, flatten nesting. — https://www.sonarsource.com/blog/5-clean-code-tips-for-reducing-cognitive-complexity/
- **Contested — hard line limits.** Ousterhout (Sept 2024–Feb 2025 debate with Robert Martin, primary source): Clean Code's 2–4-line method advice is "so extreme" it produces shallow, _entangled_ methods — methods you can't understand without reading each other — which are better recombined into one place. Martin defends small methods for readability. Read both sides in the joint document. — https://github.com/johnousterhout/aposd-vs-clean-code
- Takeaway for limits: use complexity/length lint rules as a tripwire that forces a conversation, not as a definition of good; the fix for a tripped rule is a _deep_ extraction (own abstraction, own name), never a mechanical split into entangled halves.

### Deep modules (Ousterhout) and critiques

- Core doctrine: a module's value = functionality provided minus interface cost. Deep module = small interface, substantial implementation; shallow module = interface nearly as complex as what it hides, adding cost without hiding complexity. Also: strategic (invest in design) beats tactical (fastest working code) programming. — https://github.com/johnousterhout/aposd-vs-clean-code (Ousterhout's own restatement); secondary summary with the same framing: https://blog.pragmaticengineer.com/a-philosophy-of-software-design-review/
- Critiques: (a) his Java `FileInputStream`-should-buffer-by-default example is attacked as violating single-responsibility (https://andremoniy.medium.com/not-my-philosophy-of-software-design-13d9f1e09451); (b) Martin's side of the joint debate argues deep-module doctrine under-weights readability of long methods (https://github.com/johnousterhout/aposd-vs-clean-code). Treat "deep" as a design heuristic, not an excuse for god-modules.

### When NOT to abstract

- Sandi Metz (primary): "duplication is far cheaper than the wrong abstraction"; the failure mode is a shared function accumulating parameters/flags/conditionals for every new caller. Recommended cure: inline the abstraction back and re-duplicate. — https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction
- Kent C. Dodds, AHA Programming: "Avoid Hasty Abstractions" — tolerate duplication until the use cases are confidently known; optimize for change first. — https://kentcdodds.com/blog/aha-programming
- Dan Abramov, "The WET Codebase" (talk): removing a bad abstraction must stay easy; teams should make un-DRY-ing socially acceptable. — https://overreacted.io/the-wet-codebase/
- **Contested:** Code with Jason argues the Metz slogan is overused as a license never to abstract; the real skill is fixing wrong abstractions, not avoiding abstraction. — https://www.codewithjason.com/duplication-cheaper-wrong-abstraction/

### Grug-brained developer

- Primary source: complexity is "the complexity demon" — the central enemy of software; say "no" to features/abstractions, prefer 80/20 solutions, avoid factoring the application too early ("premature abstraction" twin of premature optimization), prefer locality of behavior (code lives on the thing that does the thing) over ritual separation of concerns; tests: integration-level sweet spot. — https://grugbrain.dev/
- Published critique exists (tone, oversimplification): https://jessewarden.com/2023/08/criticisms-of-the-grug-brained-developer.html — the core anti-complexity claim itself is broadly endorsed.

### Kent Beck, "Tidy First?"

- Primary source (author's own substack): tidyings are minutes-long, behavior-preserving structure changes (guard clauses, explicit parameters, chunk statements, dead-code deletion) made _right before_ the behavior change they enable; structure changes and behavior changes must be separate commits/PRs; design is "empirical" — decided against the concrete next change, neither speculative (too early) nor reactive (after coupling costs were paid repeatedly). — https://tidyfirst.substack.com/ ; one-page summary by Beck: https://newsletter.kentbeck.com/p/tidy-first-in-one-page ; why "empirical": https://tidyfirst.substack.com/p/why-empirical

---

## 2. Architecture

### Feature-sliced design vs hexagonal

- FSD (official docs): 7 layers ordered by responsibility (app → pages → widgets → features → entities → shared); the single load-bearing rule is the import rule — a layer may import only from layers strictly below, and slices on the same layer may not import each other. This yields high cohesion / low coupling mechanically. — https://feature-sliced.design/docs/reference/layers and https://feature-sliced.design/docs/reference/slices-segments
- FSD is frontend-scoped by design; hexagonal (ports & adapters) is the corresponding backend discipline: core domain logic depends on nothing; ports define what the core needs; adapters (HTTP, DB, mail) implement ports at the edge. — https://en.wikipedia.org/wiki/Hexagonal_architecture_(software) (Cockburn's pattern); practical cost/benefit discussion: https://www.lavapi.com/blog/hexagonal-architecture-backend-services
- Practical consensus for a TS monorepo: FSD-style layers in the web app, hexagon-style core/ports/adapters in the API, shared contracts package as the only bridge. Neither replaces the other; both reduce to the same enforceable primitive — a directed acyclic import graph.
- FSD has its own official architecture linter, Steiger, which mechanizes the import rule (forbidden higher-layer imports, cross-imports between same-layer slices). — https://github.com/feature-sliced/steiger

### Barrel files in 2026 — contested, both sides

- **Against (bundler/framework side).** Vercel/Next.js primary source: importing one export from a barrel still pays for everything the barrel transitively imports — 200–800 ms per popular package, hurting dev compile, serverless cold start, and tree-shaking; `optimizePackageImports` exists precisely to neutralize _external_ packages' barrels. — https://vercel.com/blog/how-we-optimized-package-imports-in-next-js and https://nextjs.org/docs/app/api-reference/config/next-config-js/optimizePackageImports
- For your _own_ code Next.js guidance is to avoid barrels rather than optimize them; `optimizePackageImports` does not reliably cover local workspace-package barrels under Turbopack. — https://nextjs.org/docs/app/guides/package-bundling and https://github.com/vercel/next.js/issues/75148
- Barrels are also the classic incubator of circular imports (everything imports the index, the index imports everything).
- **For (encapsulation side).** A curated `index.ts` is the only lightweight way in TS to declare a package/slice _public API_ and hide internals — FSD's official structure relies on a public-API entry per slice. — https://feature-sliced.design/docs/reference/slices-segments
- Synthesis: barrels as _curated public entry points_ of a package or slice (re-exporting a handful of pure symbols) — yes; _convenience_ barrels inside an app (deep directory `index.ts` that re-exports everything) — no. Enforce the boundary with lint, not with the barrel itself.

### Module boundary enforcement

- eslint-plugin-boundaries: declare element types (layer/slice) by path pattern, then rules for which type may import which; instant feedback in-editor. — https://github.com/javierbrea/eslint-plugin-boundaries
- eslint-plugin-import `no-restricted-paths` (import "zones"): forbid directory X from importing directory Y — the minimal-dependency way to encode layer direction. — https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/no-restricted-paths.md
- dependency-cruiser (official): rule-file with `no-circular`, orphan detection, "shared code imported by only one module", plus graph visualization; runs in CI as the whole-graph complement to per-file ESLint. — https://github.com/sverweij/dependency-cruiser ; practical adoption write-up: https://xebia.com/blog/taking-frontend-architecture-serious-with-dependency-cruiser/
- The "Beyoncé rule" of architecture: if you liked the boundary, you should have put a lint rule on it — conventions not enforced by CI decay. — https://frontendatscale.com/issues/36/

### tRPC router composition (official, v11)

- Recommended structure: one root `appRouter` composing nested domain routers (`router({ users: usersRouter, posts: postsRouter })`); each domain router lives in its own file. — https://trpc.io/docs/server/routers and https://trpc.io/docs/server/merging-routers
- `t.mergeRouters` is only for flattening several routers into a single namespace; nesting is the default composition tool. — https://trpc.io/docs/server/merging-routers
- Reusable behavior belongs in _procedure builders_ (base procedures extended with middleware: `publicProcedure`, `protectedProcedure`, …), composed once and reused by reference — not per-route hand-rolled middleware chains. — https://trpc.io/docs/server/middlewares

---

## 3. Code style regimes

### Strict type-aware lint configs

- typescript-eslint official: `strictTypeChecked` = recommended + strict + type-checked rules; the project's own guidance is to adopt it when the team is proficient in TS, and it explicitly reserves the right to tighten between majors (strictness is a moving target you opt into). — https://typescript-eslint.io/users/configs/ and https://typescript-eslint.io/getting-started/typed-linting/

### Ratchets

- Notion (primary engineering-blog source): a ratchet system records current violation counts per rule; pre-commit auto-decreases the budget when someone fixes an instance, CI blocks any increase — the codebase can only get cleaner, with no big-bang cleanup sprint. — https://www.notion.com/blog/how-we-evolved-our-code-notions-ratcheting-system-using-custom-eslint-rules
- qntm's general formulation: a ratchet is any mechanism that makes regressions mechanically impossible while allowing debt to be paid down gradually; the check must be cheap, objective, and in CI. — https://qntm.org/ratchet
- Tooling exists off the shelf (violations may only monotonically decrease): https://github.com/imbue-ai/ratchets , https://github.com/ProductPlan/eslint-formatter-ratchet

### Immutability by default in TS

- eslint-plugin-functional (primary docs): `immutable-data` bans mutation of objects/arrays (assignment, property add/delete, mutating array methods); `prefer-immutable-types` pushes `readonly` parameters/returns. The plugin ships a lenient "recommended" and a hard "strict" ruleset — the maintainers themselves position strict as for genuinely functional codebases, recommended for "functional-like" ones with 3rd-party interop. — https://github.com/eslint-functional/eslint-plugin-functional/blob/main/docs/rules/immutable-data.md and https://github.com/eslint-functional/eslint-plugin-functional/blob/main/docs/rules/prefer-immutable-types.md
- Core-ESLint complements: `no-param-reassign`, `prefer-const`; typescript-eslint adds `prefer-readonly` for class members. — https://eslint.org/docs/latest/rules/no-param-reassign , https://typescript-eslint.io/rules/prefer-readonly/

### When lint exemptions are legitimate

- ESLint official: inline disables must carry a `-- description` explaining why; configuration-level handling is preferred over inline disables; a disable is a documented exception, not a fix. — https://eslint.org/docs/latest/use/configure/rules
- Mechanical enforcement of "every suppression is justified": `@eslint-community/eslint-comments/require-description` makes an undocumented `eslint-disable` itself a lint error. — https://mysticatea.github.io/eslint-plugin-eslint-comments/rules/require-description.html
- Legitimacy test distilled from the above: a suppression is legitimate only when (a) the rule is genuinely wrong about this line (false positive / interop with an untyped 3rd party), (b) the reason is written next to it, and (c) it is the narrowest possible scope (`-next-line`, one rule — never file-wide, never blanket `eslint-disable`).

---

## 4. Elegance as a review criterion

- Google eng-practices (primary): the review standard is "does this CL improve overall code health?" — not perfection; reviewers explicitly ask "could the code be made simpler? would another developer easily understand and use this code?" Complexity means "can't be understood quickly by code readers", and over-engineering (solving problems that don't exist yet) is called out as a thing reviewers must push back on. — https://google.github.io/eng-practices/review/reviewer/standard.html and https://google.github.io/eng-practices/review/reviewer/looking-for.html
- Naming as the operational half of small functions: Fowler — extraction is only elegant if the name states intent so the reader never opens the body. — https://martinfowler.com/bliki/FunctionLength.html
- Single level of abstraction per function (SLAP): originates in Beck's "compose method"/Clean Code lineage; **contested** — qntm's widely-cited critique shows Clean Code's own SLAP-driven examples become unreadable webs of side-effectful three-line methods; Ousterhout's entanglement argument (see §1) is the theorized version of the same failure. Use SLAP as "don't mix policy with bit-fiddling in one body", not as "every body must be a list of calls". — https://qntm.org/clean and https://github.com/johnousterhout/aposd-vs-clean-code
- Deletion-first refactoring: Beck's tidying catalog leads with deleting dead code and redundant comments (cheapest tidyings, pure win); Fowler's refactoring catalog has Remove Dead Code as a named refactoring — "the best code is no code" operationalized as: before improving code, ask if it can be removed. — https://newsletter.kentbeck.com/p/tidy-first-in-one-page and https://refactoring.com/catalog/removeDeadCode.html
- Symmetry/consistency as elegance: Google's review guide treats consistency with the surrounding codebase as a review criterion below only correctness and simplicity; grug's locality-of-behavior and FSD's identical slice shape are the same idea — parallel things should look parallel, so any asymmetry signals a real difference. — https://google.github.io/eng-practices/review/reviewer/looking-for.html and https://grugbrain.dev/
- How mature teams make "elegant" objective: they don't score elegance directly — they decompose it into mechanically checkable proxies (complexity budgets, boundary lint, suppression discipline, naming/extraction tests) and reserve human judgment for what the machine can't see (is the abstraction the _right_ one). That is the pattern across Google eng-practices, Notion's ratchet, and Sonar's metric design cited above.

---

## Checks applicable to CustomReport

Mechanically checkable review criteria derived from the research. Each is phrased so a reviewer (or a lint rule) can answer yes/no.

Function/module shape:

1. Cognitive complexity per function under a fixed budget (`sonarjs/cognitive-complexity`); a trip is fixed by a _deep_ extraction with its own name, never by splitting into two entangled halves that must be read together (Ousterhout entanglement test).
2. Extraction naming test (Fowler): every extracted helper's name states _what_; if the caller still needs to read the body to trust it, the extraction is wrong — inline it back.
3. No boolean flag parameters: a `doThing(true)` call site is unreadable and marks a shallow interface; split into two named functions or pass a discriminated object.
4. Depth check for new modules/hooks/services: interface (exported surface + params) must be visibly smaller than what it hides. A pass-through wrapper (function that only calls one other function with the same args) is a shallow module — delete it.
5. Single level of abstraction, weak form only: no function mixes domain policy with low-level mechanics (string parsing, date math) in one body; but do not demand "bodies must be only calls".

Abstraction discipline:

6. Rule of three for new abstractions: a shared helper/component requires ≥2 concrete existing call sites in the diff or codebase; abstractions built for one caller "for the future" are rejected (AHA/Metz).
7. Wrong-abstraction tripwire: adding a parameter/flag/conditional to a shared function to serve one new caller is grounds to inline-and-duplicate instead (Metz's cure).
8. Deletion first: every refactoring PR states what it _removed_; dead code, unused exports (dependency-cruiser orphan check), and commented-out code are deleted, never kept "just in case".

Boundaries:

9. Import direction is lint-enforced, not conventional: every layer/slice rule that matters has a matching `boundaries`/`no-restricted-paths` entry, and dependency-cruiser `no-circular` runs in the gate (Beyoncé rule).
10. Barrels only as curated public APIs: an `index.ts` may re-export a slice/package's intended surface (pure symbols) only; no app-internal convenience barrels; no importing a sibling through its own barrel.
11. tRPC: every procedure uses one of the canonical shared procedure builders by reference; nested domain routers compose into the single root router; no hand-rolled per-route middleware chains. (Matches trpc.io guidance and the repo's existing role-coverage gate.)

Lint/style regime:

12. Ratchet, never regress: rule budgets only decrease; new code meets the full strict config (`strictTypeChecked` + functional rules) with `--max-warnings 0`.
13. Every `eslint-disable` has a `-- reason`, narrowest scope (`-next-line`, single rule), and is a false-positive/interop case — never "rule is annoying" (enforceable via `eslint-comments/require-description`).
14. Immutability by default: no `let` where `const` works, no param reassignment, no in-place mutation of shared data; mutation allowed only in a function-local scope that never escapes.

Review posture:

15. The merge bar is Google's: the change must improve code health, not achieve perfection; reviewer's standing questions are "could this be simpler?" and "will a future reader understand it without archaeology?"
16. Symmetry check: things that are the same should look the same — sibling slices/routers/components follow the identical internal shape; any structural deviation in the diff needs a stated reason.

---

Method note: findings gathered via web search over primary sources (official docs, author blogs/repos) July 2026; contested items (line limits, barrels, Metz slogan, Clean Code/SLAP) are flagged inline with both sides cited.
