## Context

`@react-email/components@^1.0.12` is the only consumer-facing dependency in the
batch flagged **Deprecated** rather than carrying a normal `latest` target. It
powers the transactional email templates on the nodemailer path:
`deadline.template.tsx` and `escalation.template.tsx`. Rendering goes through
`@react-email/render@^2.0.8` in `render-template.ts`, which is **not**
deprecated.

The deprecation creates an identification problem before a migration problem:
the registry does not give a `current -> latest` number, so the successor must
be discovered from the deprecation message first. The react-email project has
historically shipped components three ways — the `@react-email/components`
meta-package, the `react-email` umbrella, and individual
`@react-email/<component>` scoped packages — so the successor could be any of
them. Committing to one before reading the actual notice risks importing from a
path that does not re-export the component set this repo uses.

## Decision

Treat this as **investigation-gated and isolated**.

1. **Discovery before edit.** The first deliverable is the confirmed successor
   recorded from the registry deprecation notice, not a code change. If the
   notice points at multiple candidates, prefer the one that re-exports the
   exact imported set (`Html, Head, Preview, Tailwind, Body, Container,
Heading, Text, Button, Section`) with the least import-site churn.
2. **Isolation.** Only `@react-email/components` moves (plus a coordinated
   `@react-email/render` bump _iff_ the successor's peer range forces it). No
   other major/minor dependency rides along, so a failed validation is
   rejectable without collateral. The merge decision stays with the user.
3. **Behavior preservation.** The rendered multipart output (HTML + plaintext)
   is the contract. `render-template.test.ts` is the guard. HTML-shape changes
   are migrated deliberately with recorded justification, never masked by
   skipping a test.
4. **Blockable.** If no maintained successor covers the imported components, the
   change stops and reports rather than forcing a half-working swap. This keeps
   the deprecated-but-functional `1.0.12` in place as the safe fallback until a
   real successor exists.

## Alternatives considered

- **Pin `1.0.12` and ignore the deprecation.** Rejected as the standing answer:
  deprecated packages stop receiving fixes and drift from the React/peer
  baseline. Acceptable only as the explicit fallback if discovery finds no
  successor — which is an outcome of this change, not a way to skip it.
- **Inline the handful of components** (drop react-email, hand-write the HTML +
  `<Tailwind>` equivalent). Rejected: re-implements a maintained library,
  loses the `<Tailwind>` class-to-inline-style compilation the templates rely
  on, and expands the diff well beyond an isolated dependency swap.
- **Bundle with the minor/patch batch** (e.g. the `nodemailer 8.0.7 -> 8.0.10`
  bump). Rejected: a deprecated-package replacement carries unknown breaking
  risk and must be independently rejectable, which is the whole point of the
  Wave-3 isolated-upgrade pattern.
