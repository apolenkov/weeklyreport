---
name: Jira PRJ-проект — конвенция лейблов и отсутствие Tempo
description: Лейблы PRJ задач строятся как prj:<codename>; Tempo не используется в PRJ-проекте; timesheets секция в .jira не нужна
type: feedback
originSessionId: 32223757-8778-4d1b-8910-37480c159bf7
---

Лейблы PRJ-задач имеют префикс `fit:` с маркетинговым кодовым именем продукта — не именем репозитория.

- customreport репозиторий → продукт называется **pulse** → лейбл `prj:pulse`
- aiLabel: `prj:ai-integration`
- Доменные лейблы: `prj:back`, `prj:front`, `prj:devops`, `prj:arch`, `prj:test`, `prj:org`

**Why:** пользователь поправил «Почему customreport? Это ж пульс» — продукт называется pulse, а не по имени репозитория.

**How to apply:** При создании задач PRJ-проекта всегда использовать `prj:pulse` как базовый лейбл. Не использовать имя репозитория напрямую.

## Tempo в PRJ-проекте

Tempo **не используется** — worklog, Account, ФНС, Service Object настраивать не нужно.

- `noTimeLog: true` для всех типов задач в `.jira`
- Секции `timesheets`, `automation.tempoWebhook` из `.jira` убрать
- Поля `customfield_10410` (Account), `customfield_13220` (ФНС), `customfield_16410` (Service Object) недоступны через Jira REST API — управляются только Tempo плагином (работает только для CP-проекта)
