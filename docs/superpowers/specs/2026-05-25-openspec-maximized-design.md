# OpenSpec: максимальная конфигурация

**Дата:** 2026-05-25
**Статус:** approved (brainstorming session)

## Проблема

OpenSpec инициализирован, но работает как статический архив: одна спека,
один завершённый change, нет правил для агента о том, когда и как создавать
новые changes. Каждая новая фича v8.4+ требует ручного решения — «нужен ли
здесь openspec change?».

## Цель

Превратить OpenSpec в **рабочий журнал изменений** — каждая фича ≥ 1
коммита автоматически получает change, агент сам инициирует по контексту
задачи, archive происходит после merge PR.

## Что делаем

### 1. config.yaml — добавить change_lifecycle rules

Добавить раздел `rules.change_lifecycle` рядом с существующими
`rules.proposal / design / tasks / specs`. Агент читает эти правила как
инструкцию к действию:

```yaml
rules:
  change_lifecycle:
    create_when: |
      Agent starts a new feature task that will produce >= 1 commit.
      Before writing code, run `openspec list` and create a change via
      `openspec change new <slug>` if no relevant active change exists.
    archive_when: |
      PR is merged to main. Run `openspec archive <name>`, commit, push.
    slug_format: "<verb>-<noun>  (e.g. versioning-ux, save-disc)"
    required_artifacts: [proposal.md, tasks.md]
    optional_artifacts: [design.md]
    design_required_when: "change touches schema, data-flow, or shared contracts"
    link_specs_when:
      - "new tRPC procedure  →  link role-coverage-gate"
      - "Report write path   →  link period-dual-state"
      - "AI module           →  link ai-module-facade"
      - "deferred UI element →  link deferred-feature-pattern"
      - "prisma destructive  →  link destructive-db-guard"
```

Также дополнить `context.sources_of_truth`: добавить `openspec/` как
четвёртый источник рядом с `.planning/codebase/`, `prisma/schema.prisma`,
`packages/shared/src/schemas/`.

### 2. Четыре инвариантные спеки

Каждая — отдельный файл `openspec/specs/<capability>/spec.md` со структурой
`## Purpose` + `## Requirements` → `### Requirement: <name>` →
`#### Scenario: <name>`. Один commit на capability.

| Capability                 | Порядок             | Consumer surface                                 |
| -------------------------- | ------------------- | ------------------------------------------------ |
| `deferred-feature-pattern` | 1-й (самый простой) | `apps/web/src/components/navigation/nav-bar.tsx` |
| `role-coverage-gate`       | 2-й                 | CI gate + `apps/api/src/infrastructure/trpc/`    |
| `period-dual-state`        | 3-й                 | `apps/api/src/modules/weekly-report/`            |
| `ai-module-facade`         | 4-й (самый сложный) | `apps/api/src/modules/ai/` + ESLint rule         |

**deferred-feature-pattern** — 3 требования:

- UI-deferred → `ComingSoonBadge` на инертном контроле, не `hidden` / feature flag
- Backend-deferred → `throw new Error('Not implemented — see TODO(<ref>)')`
- Активация → удалить badge/stub целиком, не включить флаг

**role-coverage-gate** — 3 требования:

- Каждый tRPC procedure MUST использовать один из 7 canonical chain-builders
- CI сравнивает по reference identity, не по значению — wrapper не обходит gate
- Новый procedure без builder → CI fail (не runtime error)

**period-dual-state** — 4 требования:

- Каждый write к `Report` обновляет `periodState` И legacy period tuple в одной транзакции
- Нет DB constraint — инвариант программный, нарушается молча
- 6 writers (lead sections, head publish, carry-over, archive, etc.) — все должны соблюдать
- Расхождение → рассинхрон видимого периода между ролями

**ai-module-facade** — 4 требования:

- AI-модуль не импортирует `@prisma/client` напрямую — только через facade
- Бюджет 50K токенов/час: guard проверяет перед каждым вызовом LLM
- Sanitize layer: 8 redact-паттернов (PII, secrets) до отправки в LLM
- ESLint rule enforcement — нарушение = lint error, не runtime

### 3. Workflow: как change связывается со specs

Если фича затрагивает инвариант, change несёт delta-спеку:

```
openspec/changes/<slug>/
  proposal.md
  tasks.md
  specs/
    <capability>/
      spec.md   ← delta format: ## ADDED / ## MODIFIED Requirements
                   (без ## Purpose — это не standalone spec)
```

После `openspec archive` → `openspec specs apply` переносит дельту в
мастер-спеку. Standalone specs в `openspec/specs/` обновляются через apply,
не вручную.

```
[фича затрагивает инвариант]
          ↓
  changes/<slug>/specs/<cap>/spec.md  (delta)
          ↓ archive + apply
  specs/<cap>/spec.md  (мастер обновлён)
```

## Файлы для изменения

- `openspec/config.yaml` — добавить `rules.change_lifecycle` + обновить `context`
- `openspec/specs/deferred-feature-pattern/spec.md` — создать
- `openspec/specs/role-coverage-gate/spec.md` — создать
- `openspec/specs/period-dual-state/spec.md` — создать
- `openspec/specs/ai-module-facade/spec.md` — создать

## Верификация

```bash
openspec list --specs
# → 5 specs: destructive-db-guard + 4 новых, каждый requirements N > 0

openspec validate --specs
# → 5/5 passed, 0 failed

openspec validate --strict
# → changes + specs — всё зелёное
```
