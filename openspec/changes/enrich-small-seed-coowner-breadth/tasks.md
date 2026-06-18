# Tasks

- [ ] In `prisma/seed-demo.ts`, locate the `SMALL_DATASET` Maria sections
      (Testing co-owner on Маркетинговый портал and Платформа интеграций) and the
      Igor sections (DevOps co-owner on Внутренний BI, Маркетинговый портал,
      Платформа интеграций).
- [ ] Add a `next`-week item (`type: ItemType.next`) to Maria's existing
      `current`-week item on Платформа интеграций, on her owned stage (`Testing`),
      status `in_progress`/`done`, with fixed Russian seed text. Do NOT add a risk
      here (keeps the green Integrations anchor intact).
- [ ] Add a `next`-week item to Maria's section on Маркетинговый портал
      alongside her `current` item, on `Testing`, on-track status, fixed text — so
      her foreign content spans two shared sections and both week buckets.
- [ ] Add a `next`-week item to Igor's existing `current`-week item on
      Внутренний BI, on his owned stage (`DevOps`), on-track status, fixed text.
      Do NOT change Igor's existing blocked `current` item or his existing
      `DevOps` risk (BI must stay red).
- [ ] Give Igor a `current` + `next` item pair on one of his empty Portal or
      Integrations sections (currently `items: []`), on `DevOps`, on-track status,
      fixed text — so his foreign content also spans two shared sections. If on
      Integrations, add NO risk (keep it green).
- [ ] Keep each co-owner's existing foreign decision; do not remove the Maria
      Integrations decision or the Igor BI decision.
- [ ] Confirm no new risk row was introduced and no `productLight` value was
      changed in any `SMALL_DATASET` section.
- [ ] Reseed and verify health is unchanged: run `pnpm db:seed:small`, open the
      lead report, confirm Portal yellow / Integrations green / BI red, and confirm
      Everyone shows foreign current+next items across multiple sections.
- [ ] Reseed a second time and confirm identical ids/text (determinism).
- [ ] Run gates: `pnpm typecheck` and `pnpm lint`.
