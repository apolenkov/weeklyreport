# Night run 2026-07-02 — done + follow-ups for Саша

## Закоммичено (все три волны roadmap)

| Change                        | SHA        | Проверка                                                       |
| ----------------------------- | ---------- | -------------------------------------------------------------- |
| C5 responsive-compact-layout  | `b031936d` | 3 раунда ревью, гейт зелёный, ~35 контролов на 44px-floor      |
| C3 project-activity-reporting | `fe65e19a` | 2 раунда, integration 248/248, admin M:M + per-section status  |
| C2 unified-activity-entry     | `8c350495` | 5 раундов ревью, integration 256/256, полный юнит-гейт зелёный |

C2 коммитил я вручную после того, как session-лимит выбил раунд-6 воркфлоу-ревью:
основание — 5 независимых adversarial-раундов (Fable + Codex) сошлись, оба блокера
раунда 5 закрыты регресс-тестами, детерминированный гейт зелёный (typecheck 5/5,
lint, unit все пакеты, real-DB integration 256). Раунд-6 независимого прогона не было.

## Требуют ТЕБЯ (screenshot-gate / живая проверка)

- **C3 слайд**: минимальная полоса статусов активностей на слайде — под human
  screenshot-sign-off. Прогони слайды, глянь полосу.
- **C5**: живая проверка 360/768 (task 5.2 намеренно не закрыт) — прогнать в браузере.

## Follow-up миноры (не блокеры, вынесены сознательно)

C2 (все не-блокеры, ревью раунды 4–6):

1. **Zod partial-update сбрасывает 12 полей настроек в default.** C2 починил ТОЛЬКО
   `unifiedActivityView`. Тот же баг у periodLengthDays, workingDays, gracePeriodHours,
   allowLateSubmissions, autoPublishAfterDeadline, autoArchiveWeeksAfterPublish,
   defaultTimezone, defaultReminderAudience, notificationFromEmail, deadlineTime,
   allowReopenAfterPublish, reopenWindowHours. Любой частичный апдейт настроек сбросит
   пропущенное поле. **Реальный предсуществующий баг — стоит отдельного фикса.**
2. **Замок висит на опциональных методах порта** (`getPublishedLineage?`,
   `findPreviousReportId?`): репозиторий без метода молча отключает resolve-not-delete.
   Прод-репозитории метод реализуют (работает), но стоит сделать методы обязательными,
   чтобы пропуск падал компиляцией. Каскад на моки — потому отложено.
3. **Обнуление текста опубликованной записи ломает автосейв**: пустой текст выпадает из
   payload → PUBLISHED_RECORD_LOCKED на каждом автосейве. Fail-closed и восстановимо
   (ретайп), но UX плохой — нужно запретить обнуление в inline-редакторе.
4. **Fill-from на reopened-периоде жёстко реджектится** (замок), но кнопка активна —
   косметический UX-минор.
5. **Баннер carry-over без компонент-теста** (логика типизирована, но клик не покрыт).
6. **queryPublishedLineage тянет снапшоты всех reopened-отчётов** — перф-заметка;
   reopened редок/транзиентен, ограничено.

## Human-gated из #32 ci-deploy (автоматизировать нельзя)

- CSP `Report-Only`→`enforce` flip (нужна in-browser проверка на 4 ролях).
- base-image sha256 digest-пины (доступ к registry).
- docker-build + curl prod-приёмка.

## Модели воркфлоу (в скрипте waveb-autorun)

Ревью (verify) = Fable; impl/preflight/scope/gate/commit = Opus; Codex = Sonnet.
