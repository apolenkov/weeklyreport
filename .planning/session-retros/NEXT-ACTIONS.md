# NEXT ACTIONS

updated: 2026-05-18T14:20:00Z source: Demo-retro (LOCK-01 done + core-principles config deployed)

## RUN FIRST

1. [ ] `git push origin main` — отправить 2 коммита LOCK-01 (после снятия SSL-блокера)

## AGENT

1. [ ] `git tag v8.1.0 && git push origin v8.1.0` — после merge/push в main
2. [ ] `/gsd-complete-milestone v8.1` — после тега
3. [ ] TD-06: подключить `PolicyApplicatorService` к `period.service.ts`
       файл: `apps/api/src/modules/admin/admin.prisma-repository.ts:717-719`
4. [ ] e2e спецификация `?authorId=<BORIS>` → read-only секция (нет кнопок Add/Edit)
       файл: `apps/web/e2e/regression/lead-form-foreign-author.spec.ts`

## HUMAN

1. [ ] `git branch -D worktree-agent-a5d15de9ea7f77c37` — заблокировано политикой прав
2. [ ] UAT в браузере: `/lead/report?authorId=<BORIS_UUID>` → badge показывает имя Бориса
3. [ ] Снять SSL-блокер для `forge.example.org` (VPN или настройка сертификата)

## BLOCKED

1. [ ] `git push` — SSL-ошибка на `forge.example.org` (внешний блокер)

## VERIFY

```bash
pnpm typecheck                        # 5/5 successful
pnpm test                             # 472/472 pass
git log --oneline origin/main..HEAD   # 0 после push
git tag --list 'v8.1*'               # v8.1.0 после тегирования
```
