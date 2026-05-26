# Unify SDLC Stage Ownership

## Problem

В коде два независимых места вычисляют «кому принадлежит SDLC-стадия»:

```text
Место 1: lib/mappers/lead-form.ts:296
  → функция buildStageGrid()
  → устанавливает stage.ownership при построении грида

Место 2: lead-form.tsx:795
  → cross-author upgrade path
  → свой независимый расчёт ownership
```

Если менять логику в одном месте — второе не обновится.
Это потенциальный баг, когда поведение для своих и чужих разделов
начнёт расходиться.

## Solution

Вытащить единый helper `resolveStageOwnership(authorId, currentUserId)`,
переключить оба места на него, удалить маркер `TODO(v8.5-C-ownership)`.

## Scope

Только `apps/web/src/`:

- `lib/mappers/lead-form.ts` — заменить inline-расчёт на вызов helper
- `components/lead/lead-form.tsx` — то же самое в cross-author пути
- Новый файл (или добавить в существующий util) — сам helper + unit-тесты

Backend и `packages/shared` не затронуты.
