# Change A adversarial review — confirmed findings (2026-06-24)

Source: background Workflow over main..HEAD. 19 agents, 13 confirmed.
3 of the P3 auth-saml entries are VERIFIED-CLEAN confirmations (no defect).

## [P2/high] Admin snapshot write never recomputes denormalized `name` server-side — the composeName invariant has zero data-layer enforcement

- **file:** apps/api/src/modules/admin/admin-snapshot-write.queries.ts:57-79
- **dimension:** schema-data
- **why:** The whole premise of this change is that `User.name` is the denormalized display value, recomputed from the structured parts via composeName on write. But `upsertUsers` writes `name: user.name` verbatim in BOTH the update and create branches and never calls composeName. The only place composeName is ever invoked is the web form mapper (apps/web/src/lib/mappers/admin-form-inputs.ts:74). So the `name === composeName({lastName,firstName,middleName})` invariant is enforced by exactly one client and nothing at the API/data layer. Any other caller, a future client, a direct snapshot import, or a hand-built AdminSnapshot persists arbitrary drift between `name` and the parts. The Zod adminUserSchema (packages/shared/src/schemas/report.schema.ts:93-100) validates `name.min(1)` and the parts independently but does NOT assert they agree.
- **fix:** Recompute the denormalized value inside `upsertUsers` for both branches: `name: composeName({ lastName: user.lastName, firstName: user.firstName, middleName: user.middleName })` instead of `name: user.name`, so the server owns the denormalization regardless of client. Prefer recompute-on-write over a schema `.superRefine` that asserts equality — a refine would make `getSnapshot` THROW on any already-drifted row (e.g. the seed trio below), which could break admin-panel load.
- **verdict:** CONFIRMED. Verified directly from `git show HEAD`.

Mechanics, all accurate:

1. `apps/api/src/modules/admin/admin-snapshot-write.queries.ts` — `upsertUsers` writes `name: user.name` verbatim in BOTH branches (update line 60, create line 73) and never calls composeName. It writes lastName/firstName/middleName independently, so server-side recompute is feasible.
2. `git grep composeName HEAD` proves the only non-definition/non-test invocation is the web form mapper at apps/web/src/lib/mappers/admin-form-inputs.ts:74. The data layer has zero enforcement of the `name === composeName(parts)` invari

## [P2/high] Existing 'preserves role=admin on existing user update (samlId rebind)' test now exercises the create-only return-existing branch — name is a lie, gives false confidence on the central contract

- **file:** apps/api/src/modules/auth/auth.routes.test.ts:126-153
- **dimension:** tests-contracts
- **why:** This change made SAML create-only: in buildUserSession, an existing row with resyncExisting !== true is returned UNTOUCHED and prisma.user.update is never called. The test calls buildUserSession(prisma, profile) WITHOUT resyncExisting, so it now hits the return-existing branch. Its name ('existing user update', 'samlId rebind') is false — no update/rebind happens. It only asserts session.role==='admin' (trivially true since existing.role==='admin') and reportSection.create not called. It would still pass even if create-only were broken and the row WAS overwritten, because it never inspects the update payload. So the test gives false confidence over the single most important contract of this change.
- **fix:** Upgrade this into the tracked §10.2 create-only test: assert prisma.user.update was NOT called, and that the returned session.name/role/lastName equal the EXISTING row's values (not profile.displayName/profile.role). Add a sibling case with resyncExisting:true (dev-login) proving update IS called. Rename the describe to reflect create-only.
- **verdict:** CONFIRMED — the finding is real and accurately reasoned; every step verified against `git show HEAD` and `git show main`.

Evidence:

1. Implementation (git show HEAD:apps/api/src/modules/auth/auth.routes.ts:253-269): buildUserSession has signature `(prisma, profile, options: { resyncExisting?: boolean } = {})`. The create-only branch is `const user = existing && options.resyncExisting !== true ? existing : await writeProvisionedUser(...)`. writeProvisionedUser (lines 194-247) holds the ONLY user.update (line 227) and user.create (line 238). So with an existing row and no resyncExisting, the ex

## [P2/high] toAdminUserInput composeName-recompute-on-write has zero direct test — the core parts→name write transform is unguarded

- **file:** apps/web/src/lib/mappers/admin-form-inputs.ts:58-82
- **dimension:** tests-contracts
- **why:** toAdminUserInput now recomputes the denormalized `name` via composeName({lastName,firstName,middleName}) and trims middleName/position to null. This is the write-direction transform that keeps `name` consistent with the parts (the whole point of the change, since the server trusts the client-composed name in admin-snapshot-write.queries.ts). admin.test.ts only covers mapAdminSnapshot (read) and mapAdminSettings — there is no test calling toAdminUserInput. composeName itself is unit-tested, but the mapper wiring (passing trimmed parts in surname-first order, recomputing name, null-collapsing empties) is not. A regression (e.g. name set from a stale field, wrong order, missing trim) would ship green.
- **fix:** Add unit tests for toAdminUserInput asserting: name === composeName output for full ФИО and patronymic-absent cases; middleName/position '' -> null; whitespace-only parts trimmed; id preserved on edit vs generated on create.
- **verdict:** CONFIRMED. Verified from git show HEAD on every cited line.

1. toAdminUserInput (apps/web/src/lib/mappers/admin-form-inputs.ts:54-82) is exactly as claimed: it trims lastName/firstName, null-collapses middleName (`form.middleName.trim() || null`) and position, recomputes the denormalized name via `composeName({ lastName, firstName, middleName })` (line 75), and sets id = existingId ?? newId() (create vs edit).

2. Zero test coverage of this function. admin.test.ts:10 imports only `__testing, mapAdminSettings, mapAdminSnapshot`; its describe blocks are `mapAdminSnapshot` (line 125, read) and `

## [P3/high] SAML create-only is correctly enforced; no existing-user clobber path (verified clean)

- **file:** apps/api/src/modules/auth/auth.routes.ts:289-294
- **dimension:** auth-saml
- **why:** Reviewed as the primary risk and found CORRECT, recorded so it is not re-flagged. The SAML callback calls buildUserSession(prisma, profile) with no options (line 379). With resyncExisting undefined, the guard `existing && options.resyncExisting !== true` returns the existing row UNTOUCHED, so writeProvisionedUser — and its entire reportingGroup-fallback block — is never reached for an existing SAML user. The update branch (lines 226-235) is reachable only via dev-login, which passes {resyncExisting:true}. dev-login's update writes name:profile.displayName where displayName is read fresh from the same DB row (auth.routes.ts:497), so it is a no-op, not a clobber. lastName/firstName/middleName/position are never touched on update, preserving admin-authored parts.
- **fix:** No change needed. Add the tracked SAML re-login no-overwrite test (§10.2, already known-missing) to lock this invariant against regression.
- **verdict:** CONFIRMED accurate. The finding is a "verified clean / no defect" note (P3), and its conclusion that SAML create-only is correctly enforced with no existing-user clobber path is reproducible from `git show HEAD:apps/api/src/modules/auth/auth.routes.ts`.

Evidence verified line-by-line:

- buildUserSession signature: line 253-256, options default `{}`, so resyncExisting is undefined unless passed.
- Guard (line 267): `existing && options.resyncExisting !== true ? existing : await writeProvisionedUser(...)`. With resyncExisting undefined, an existing user is returned UNTOUCHED — writeProvisionedU

## [P3/high] SAML role-free is consistent and fails closed across both verify branches (verified clean)

- **file:** apps/api/src/modules/auth/saml.strategy.ts:113-145
- **dimension:** auth-saml
- **why:** Both the devMode branch (line 118) and the prod schema branch (line 138) hard-code role:'viewer'; neither reads any asserted role attribute. A parse failure in prod returns {ok:false} (line 130) which the passport verify callback turns into done(error) → failureRedirect, i.e. fail-closed. SamlProfileSchema is .strict() so an injected role field is rejected at parse time. The two role-carrying types — SamlProfile (auth.routes.ts:20) and VerifiedSamlProfile (saml.strategy.ts:14) — are structurally identical {samlId,email,displayName,role:Role}. dev-login correctly still passes a real role + resyncExisting:true. No fail-open or role-injection path exists.
- **fix:** No change needed.
- **verdict:** CONFIRMED. The finding is an accurate "verified clean" assessment; every sub-claim checks out against `git show HEAD`, and the conclusion (no fail-open, no role-injection path) is correct.

Evidence from git show HEAD:apps/api/src/modules/auth/saml.strategy.ts:

- devMode branch hard-codes role: "viewer" at line 117 (profile object), reading only nameID/email/displayName/cn — no role attribute read.
- prod branch hard-codes role: "viewer" at line 142, after re-building a whitelisted {nameID, email, displayName} object (lines 121-125) — rawProfile.role is never forwarded.
- Parse failure returns

## [P3/high] firstName=' ' SAML stub placeholder is safe across canSave, initials, and min(1) (verified clean)

- **file:** apps/api/src/modules/auth/auth.routes.ts:191,244
- **dimension:** auth-saml
- **why:** The single-space placeholder satisfies the NOT NULL firstName column and the session schema's name:min(1) on the denormalized name (which is set to displayName, never empty). It cannot be re-saved: users-tab canSave trims (form.firstName.trim().length>0, users-tab.tsx:223), so the admin must enter a real first name before Save enables. It produces no visible artifact in initials(): firstLetter(' ') trims to '', so initials fall back to the surname initial only. nav-bar routes through the null-safe initials() helper (deriveInitials), and the two shortName() call sites (users-tab.tsx:333, stage-assignment-editor.tsx:189) receive MockUser rows whose lastName/firstName are required non-null (sourced from NOT NULL DB columns), so the shortName-on-undefined TypeError risk does not materialize.
- **fix:** No change needed.
- **verdict:** CONFIRMED as stated — the claim ("firstName=' ' placeholder is safe across canSave, initials, and min(1)") is accurate; verified clean is correct, no defect. (isReal=true means the claim's analysis is accurate per the subtask's "if the claim misreads, set false" polarity.)

Reproduced every sub-claim from `git show HEAD:<path>`:

1. NOT NULL column satisfied: SAML_STUB_FIRST_NAME_PLACEHOLDER = " " (auth.routes.ts:191); create sets firstName: placeholder (auth.routes.ts:244). prisma/schema.prisma:17 firstName String and migration.sql:58 "firstName" TEXT NOT NULL — a single space (length 1) sati

## [P3/high] Seed PM trio (Борис/Виктор/Галина) violates the name=composeName invariant: given name in the surname slot + trailing-period drift

- **file:** prisma/seed-simple.ts:511-539
- **dimension:** schema-data
- **why:** Three additional PM-lead seed rows store `name: "Борис С."` with `lastName: "Борис", firstName: "С", middleName: null` (and likewise "Виктор Л."/"Галина М."). Two concrete defects: (1) composeName({lastName:"Борис", firstName:"С"}) = "Борис С" WITHOUT the trailing period, so the stored `name` already disagrees with the parts — the exact drift finding #1 leaves unguarded, now present in seed data. (2) The given name "Борис" is placed in the surname (lastName) slot, so `initials()` renders "БС" and `shortName` happens to render "Борис С." only by coincidence. On the first admin edit of one of these users the form recomputes `name` via composeName and silently rewrites the stored display name from "Борис С." to "Борис С". All other seed users in seed-simple.ts and seed-constants.ts are consistent; only this trio is wrong. No test pins these literals, so it is latent (no failing test), but it would surface as a name visibly changing mid-demo on first edit.
- **fix:** Give these three real ФИО parts whose composeName equals the intended display name, e.g. lastName="Сорокин", firstName="Борис", middleName=null with name="Сорокин Борис" (or whatever full surname is intended), matching the pattern used by the other seed rows. Do NOT leave a given name in the surname slot.
- **verdict:** CONFIRMED on every claim, verified against `git show HEAD:` content.

Seed rows (prisma/seed-simple.ts:509-539, P13 PM trio):

- 511-514: name="Борис С.", lastName="Борис", firstName="С", middleName=null
- 523-526: name="Виктор Л.", lastName="Виктор", firstName="Л", middleName=null
- 535-538: name="Галина М.", lastName="Галина", firstName="М", middleName=null

Against composeName (packages/shared/src/name/user-name.ts:32) which joins trimmed non-empty [lastName, firstName, middleName] with a single space:

- composeName({lastName:"Борис", firstName:"С", middleName:null}) = "Борис С" (NO trailing

## [P3/high] Stale schema comment claims SAML stubs leave name parts null, contradicting the NOT-NULL columns and the create code

- **file:** prisma/schema.prisma:13-18
- **dimension:** schema-data
- **why:** The comment above the new columns states 'SAML stubs leave the parts null and carry only `name` (= displayName)'. But `lastName` and `firstName` are declared NOT NULL (required) and the SAML create path (apps/api/src/modules/auth/auth.routes.ts:243-245) sets `lastName: profile.displayName.trim() || profile.email` and `firstName: SAML_STUB_FIRST_NAME_PLACEHOLDER` (a single space). Leaving the parts null would in fact violate the NOT-NULL constraint. A later commit (3ae1fc42) already corrected the auth.routes.ts comment to say the stub synthesizes parts, but this schema comment was not updated and now misdescribes the actual contract — a maintenance trap for the next reader.
- **fix:** Update the schema comment to match the implementation: SAML stubs put displayName (or email fallback) into lastName and a whitespace placeholder into firstName; the parts are required NOT-NULL columns the IdP cannot supply truthfully.
- **verdict:** Confirmed against the committed tree. prisma/schema.prisma:15 (git show HEAD) states: "SAML stubs leave the parts null and carry only `name` (= displayName)." But the very next lines declare lastName (schema:16) and firstName (schema:17) as NOT NULL (String, no `?`); only middleName (schema:18) is nullable (String?). The committed SAML create path in apps/api/src/modules/auth/auth.routes.ts:244-245 sets lastName: profile.displayName.trim() || profile.email and firstName: SAML_STUB_FIRST_NAME_PLACEHOLDER, where the constant is defined as " " (a single space) at auth.routes.ts:186. So the stub d

## [P3/high] Admin mock-data fixture stores Western first-last order, disagreeing with surname-first composeName

- **file:** apps/web/src/components/admin/mock-data.ts:144-238
- **dimension:** schema-data
- **why:** Mock users store e.g. `name: "Alexey Petrov"` with `lastName: "Petrov", firstName: "Alexey"`. composeName is surname-first and would yield "Petrov Alexey", so the fixture's stored `name` disagrees with its own parts (same invariant-drift class as the seed trio). Impact is limited: UsersTab consumes live tRPC snapshot data and only imports `MockUser` as a TYPE (apps/web/src/components/admin/users-tab.tsx:11,55-59), so this fixture is not the live render source. It is still a misleading example that, if ever fed through the edit form, would flip the displayed name to surname-first.
- **fix:** Make each fixture's `name` equal composeName of its parts (surname-first), e.g. name: "Petrov Alexey", or swap the parts to match the intended display order. Low priority since it is fixture-only.
- **verdict:** Confirmed against committed HEAD.

1. composeName ordering (packages/shared/src/name/user-name.ts:32-37) is surname-first: `[parts.lastName, parts.firstName, parts.middleName].join(" ")`. The JSDoc/header explicitly state surname-first ФИО order.

2. Mock fixtures (apps/web/src/components/admin/mock-data.ts:141-238) store `name` in Western first-last order while parts are surname/given. Example u1 (lines 143-146): `name: "Alexey Petrov"` with `lastName: "Petrov", firstName: "Alexey", middleName: null`. composeName of these parts yields "Petrov Alexey", which disagrees with the stored "Alexey P

## [P3/high] Four hand-cloned initialsFromName helpers in web mappers duplicate the shared helper — already caused the divergence bug commit 8fd7e8bf had to fix in 4 places

- **file:** apps/web/src/lib/mappers/dashboard.ts:112; apps/web/src/lib/mappers/lead-form.ts:245; apps/web/src/lib/mappers/weekly-report-groupers.ts:23; apps/web/src/components/dashboard/activity-live-panel.tsx:224
- **dimension:** frontend-initials
- **why:** packages/shared/src/name/user-name.ts already exports a canonical initialsFromName (surname-first, first+second token) and is exported from the package index (packages/shared/src/index.ts:6). The four web sites each maintain a private copy of the same logic instead of importing it. This is not a hypothetical risk: commit 8fd7e8bf is direct evidence the duplication already diverged — all four copies used first+last token (which on the new surname-first ФИО produced surname+patronymic, the WRONG initials) and had to be patched in lockstep. The copies are correct now, but the next ФИО rule change (or a missed file) re-opens exactly the same 4-way divergence. The clones also differ subtly from the shared helper: they drop the .filter(Boolean) the shared one has and return "??" on an empty name where the shared one returns "" — proof they have already drifted in behavior, not just location.
- **fix:** Import { initialsFromName } from "@customreport/shared" in the four files and delete the local copies (nav-bar.tsx and stage-assignment-editor.tsx already consume the shared initials/shortName, so the import path is proven). If the "??" empty-name fallback is wanted at a call site, wrap the shared helper there (const i = initialsFromName(name) || "??") rather than re-implementing the token logic. Add one shared-package test asserting surname+given for a 3-token ФИО so a future regression is caught once, centrally, instead of per-clone.
- **verdict:** CONFIRMED real, but severity corrected P2 -> P3 (maintainability / incomplete refactor, no live bug).

EVIDENCE (all from `git show HEAD`):

- Four hand-cloned helpers exist with identical surname-first logic:
  - apps/web/src/lib/mappers/dashboard.ts:112 `function initialsFromName`
  - apps/web/src/lib/mappers/lead-form.ts:245 `function initialsFromName`
  - apps/web/src/lib/mappers/weekly-report-groupers.ts:23 `export function initialsFromName`
  - apps/web/src/components/dashboard/activity-live-panel.tsx:224 `function initials`
- Canonical shared helper exists and is exported: packages/share

## [P3/high] nav-bar 'renders the user initials' test passes via the name-string FALLBACK, not the new structured-parts path — structured initials could be fully broken and stay green

- **file:** apps/web/src/components/navigation/nav-bar.test.tsx:259-267
- **dimension:** tests-contracts
- **why:** NavBar now derives initials via deriveInitials({lastName, firstName, name}). The test's session mock (nav-bar.test.tsx:65-72) sets only name:'Test User' with NO lastName/firstName, so deriveInitials falls through to initialsFromName('Test User') -> 'TU'. The assertion (textContent === 'TU') therefore exercises only the fallback branch. The new structured-parts branch (surname-initial + given-initial, e.g. 'БА' from parts) is never hit, so a break in the preferred path would not fail this test. This is distinct from the tracked nav-avatar missing test: the existing test creates an illusion that initials are covered.
- **fix:** Either set lastName/firstName in this mock and assert the parts-derived initials, or add a second case with parts present asserting the surname+given initials (and one with only name asserting the fallback). Keep both branches covered.
- **verdict:** CONFIRMED, with a severity downgrade to P3.

Evidence (all from `git show HEAD:<path>`):

- nav-bar.tsx:221-224 derives initials via deriveInitials({lastName: visibleUser.lastName, firstName: visibleUser.firstName, name: visibleUser.name}).
- nav-bar.test.tsx:65-72 (the setRole mock) sets user with only name:"Test User"; no lastName/firstName. A grep of the whole test file confirms zero occurrences of lastName/firstName.
- user-name.ts:80-90 (initials): fromParts = firstLetter(lastName)+firstLetter(firstName); with both undefined this is "" (falsy), so it falls through to initialsFromName(name

## [P3/high] No test proves session name parts (lastName/firstName/middleName) survive sign->verify and are not stripped

- **file:** apps/api/src/infrastructure/trpc/**tests**/role-claim.contract.test.ts:44-51
- **dimension:** tests-contracts
- **why:** The change adds optional lastName/firstName/middleName to userSessionSchema so the nav avatar can render structured initials. The token round-trips through userSessionSchema.parse -> jwt.sign -> verify -> parse (auth.controller.ts). The only sign->verify round-trip test is role-claim.contract.test.ts, whose buildSession helper sets only userId/email/name/role and omits the new parts — so nothing asserts the parts survive the JWT round-trip. If the schema later drops/strips them (or a payload omits them), no test catches it; the avatar silently degrades to name-string initials. Low blast radius (degradation, not crash). This is an ADDITIONAL gap, separate from the three tracked tests.
- **fix:** Add a session-schema round-trip test (in auth.test.ts or role-claim.contract.test.ts) that signs a session WITH lastName/firstName/middleName set and asserts verifySessionToken returns them unchanged, including middleName:null preserved.
- **verdict:** Confirmed against the committed tree (HEAD = 3ae1fc42).

The data path is real: createJwtSigner.signSession does userSessionSchema.parse(payload) -> jwt.sign, and verifySession does jwt.verify -> userSessionSchema.parse(decoded) (apps/api/src/modules/auth/auth.controller.ts:25-37). The schema adds optional lastName/firstName/middleName (packages/shared/src/schemas/auth.ts:28-34), and the nav avatar consumes them for initials with a name-string fallback (apps/web/src/components/navigation/nav-bar.tsx:220-224).

No existing test signs a session carrying the new parts and asserts they survive ver

## [P3/high] SAML stub create values (lastName=displayName, firstName=' ' placeholder, middleName/position null) are untested

- **file:** apps/api/src/modules/auth/auth.routes.ts:233-241
- **dimension:** tests-contracts
- **why:** writeProvisionedUser maps a SAML stub into structured columns: lastName = displayName.trim() || email, firstName = SAML_STUB_FIRST_NAME_PLACEHOLDER (' '), middleName/position null. The placeholder is load-bearing (satisfies the non-empty firstName column while name helpers treat ' ' as absent, and canSave trims so it can't be re-saved). No test asserts these create-data values. A regression (e.g. firstName left empty -> schema/DB violation, or displayName put in the wrong column) would not be caught by the existing admin-login test, which uses existingUser:null but only asserts role on the create arg.
- **fix:** In the create branch test, assert the create data: lastName === displayName, firstName === ' ' placeholder, middleName === null, position === null; and a fallback case where displayName is blank asserts lastName === email.
- **verdict:** CONFIRMED. Verified from `git show HEAD`.

Code (apps/api/src/modules/auth/auth.routes.ts):

- Line 186: `const SAML_STUB_FIRST_NAME_PLACEHOLDER = " ";` — single-space placeholder, exactly as claimed.
- Lines 216-249, create branch: `lastName: profile.displayName.trim() || profile.email`, `firstName: SAML_STUB_FIRST_NAME_PLACEHOLDER`, `middleName: null`, `position: null`. Mapping matches the finding precisely.
- Comment at 179-185 confirms the placeholder is load-bearing: it satisfies the non-empty required column while name helpers treat " " as absent, and canSave trims so it cannot be re-save
