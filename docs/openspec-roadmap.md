# OpenSpec backlog roadmap

Координирующий обзор активных OpenSpec-change-ей: порядок, зависимости и что
делать с каждым. Источник истины по задачам — сами `openspec/changes/*`; этот
файл лишь связывает их в один план. Обновлять при смене состава бэклога.

> Дата составления: 2026-06-04. Запусти `openspec list`, если прогресс устарел.

## Ключевая идея

Три change-а независимо описывают одно и то же — **per-role Playwright-свип на
console-ошибки**: `behavioral-ui-regression-gate`, `verify-a11y-recommended-flip`,
`final-gates-resweep`. Это дублирование. Решение: **один Driver обслуживает всех
трёх**. `behavioral-ui-regression-gate` строит движок свипа (Scenario Catalog +
swappable Driver); остальные два — его потребители, а не отдельные харнессы.

## Карта зависимостей

```
behavioral-ui-regression-gate   ← ФУНДАМЕНТ (Driver + каталог = движок свипа)
        ├── verify-a11y-recommended-flip   (потребитель: a11y-проверки через Driver)
        ├── ratchet-lint-to-strict         (Driver = страховка от origin-класса бага)
        └── final-gates-resweep            (его «re-sweep 4 ролей» = прогон Driver-а)

establish-scenario-catalog      ← DEFERRED (file:line каталог; отдаёт парк-генераторы)
defer-uat-codequality-vercel    ← DEFERRED родитель (Wave 1–5; final-gates = Wave 5)
```

## Порядок и действие по каждому change

| #   | Change                                    | Действие                                                                                                                                                                                                                  |
| --- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `behavioral-ui-regression-gate`           | **Первым.** Движок свипа + страховочная сеть. Дизайн готов (грил-сессия 2026-06-04). Дальше: прогнать генератор `lead`, восстановить `dev-auth` из git, собрать Driver.                                                   |
| 2   | `verify-a11y-recommended-flip`            | Не строить отдельный свип. 480-тестовый a11y-каталог превратить в intent-ы и **прогнать через Driver** из #1. Долг верификации закрывается прогоном.                                                                      |
| 3   | `ratchet-lint-to-strict`                  | Независимый трек. Рискованные флипы (`no-unsafe-*`, `no-unnecessary-condition`) — ровно origin-класс бага. Автофикс-кластер можно сейчас; рискованные — **после** того, как #1 даёт свип, и прогонять свип после каждого. |
| 4   | `final-gates-resweep`                     | **Закрытие, последним.** Его «re-sweep 4 ролей, 0 console ERRORS» = финальный прогон Driver-а из #1. Переписать acceptance на «прогон behavioral Driver-а зелёный», не дублировать харнесс.                               |
| 5   | `establish-scenario-catalog`              | DEFERRED. Отдаёт парк-генераторы (уже переиспользованы в #1). file:line drift-gate — после стабилизации кода.                                                                                                             |
| 6   | `defer-uat-codequality-vercel-2026-05-26` | DEFERRED родитель. Единственная конкретная незакрытая поставка = final-gates (#4). Wave 3 (code-quality агенты) — по явному «вперёд».                                                                                     |

## Критический путь

Весь бэклог упирается в #1: довести `behavioral-ui-regression-gate` до рабочего
Driver-а (lead-каталог → `dev-auth` → Driver). Это разблокирует #2 и #4 и
страхует #3.

## Что НЕ делаем

- Не строим свип в #2/#4 отдельно — только через Driver из #1.
- Не реактивируем file:line Coverage Catalog (#5) до стабилизации кода.
- Не запускаем Wave 3 code-quality агентов (#6) без явного «вперёд».
