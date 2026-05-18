---
name: LOCK-01 done — lock badge for foreign-author view
description: isPinnedAuthorView lock badge landed in main; key data-source lesson
type: project
originSessionId: b8d5b2af-032c-46f8-b3d9-3c5632cab382
---

LOCK-01 реализован (коммиты fb9e138 + 0463aea на main, 2026-05-18).

Когда `isPinnedAuthorView=true`, в заголовке `/lead/report` появляется chip с замочком и именем автора секции.

**Why:** отличать «смотрю чужую секцию» от «моя секция в submitted/read-only».

**Ключевое различие источников данных в lead-form.tsx:**

- `currentUser.name` → `activeQ.data.authorName` → имя залогиненного пользователя (Василий)
- `draftSection.authorName` → имя автора загруженной секции (может быть Борис, если `?authorId=BORIS`)

Для badge нужен `draftSection.authorName`, НЕ `currentUser.name`.

**How to apply:** при любой работе с именем в контексте foreign-author view — всегда проверять, из `activeQ` или из `byPeriodQ` берётся данное.
