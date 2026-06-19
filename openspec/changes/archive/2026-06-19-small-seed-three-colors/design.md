# Design — small seed three colors

## Target matrix (lead = Vasily; co-owners Maria, Igor)

| Product              | Health | Driven by                                   | Stage ownership                          |
| -------------------- | ------ | ------------------------------------------- | ---------------------------------------- |
| Маркетинговый портал | RED    | a blocked stage (incl. a foreign-owned one) | broad enough to show the foreign blocker |
| Платформа интеграций | YELLOW | one at-risk stage, no blocked               | broad enough to read yellow              |
| Внутренний BI        | GREEN  | no risk, all owned stages on-track          | all 7 owned except Support vacant        |

## Green BI ownership (the showcase)

- Planning → Vasily (on-track)
- Analysis → Maria (on-track)
- Design → Maria (on-track)
- Development → Vasily (on-track)
- Testing → Maria (on-track) ← was previously unowned on BI
- DevOps → Igor (on-track) ← was previously the blocked stage
- Support → VACANT (unowned) ← the deliberate "unfilled role" demo

The primary lead (Vasily) still owns exactly two stages (Planning, Development),
satisfying the existing "internal project owns exactly two" scenario. The vacant
stage moves from Testing to Support.

## Blocker relocation (net-zero risk)

Today Igor's blocked DevOps risk sits on BI. To make BI green, that blocked
demonstration MOVES to Маркетинговый портал (Igor owns a blocked stage there, or the
existing Portal blocker is foreign-owned). This is a relocation of the EXISTING
blocked row, not a new risk — the dataset's total risk count is unchanged, so the
"Co-owner foreign content ... MUST NOT add any new risk" clause is respected (no
net-new risk is added; one moves products).

## Determinism

Keep fixed ids, authors, and stage assignments. No wall-clock / random drift
(`seed-determinism`). Reseed via `prisma migrate reset` per the disposable-DB rule.

## Risk / regression watch

- The cross-author requirement names "Maria on Testing, Igor on DevOps" — Maria now
  also owns Testing on BI (on-track) and Igor owns DevOps on BI (on-track) plus the
  relocated blocker on Portal. Keep both co-owners' both-week-bucket on-track foreign
  content intact.
- The "fully-green product" was Integrations (`seed-all-green-example-product`); it
  becomes at-risk. Update any test that asserts Integrations is the green one — the
  green product is now BI.
- Verify health resolution live after reseed: Portal red, Integrations yellow, BI
  green with a grey vacant Support chip.

## Out of scope

Middle/huge tiers; non-seed surfaces.
