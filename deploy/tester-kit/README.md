# WeeklyReport: стенд для тестировщиков

Своё приложение на своём компьютере: Kubernetes, свой вход через Keycloak, почта в Mailpit, PDF.
Собирать образы не нужно.

## Что нужно

- **OrbStack** или **Docker Desktop** с включённым Kubernetes.
- Свободно **6 ГБ ОЗУ** для кластера и **10 ГБ** на диске.
- `kubectl`, `helm`, `openssl`, `envsubst`, `curl`, а также Node 26 и `pnpm` (они нужны для загрузки демо-данных).
- Копия репозитория: `git clone https://gitlab.example.org/acme/weeklyreport.git`.
- Доступ к реестру образов `gitlab.example.org:5005/acme/weeklyreport`. Если нужен вход:
  `REGISTRY_USER=<логин> REGISTRY_PASSWORD=<токен> deploy/tester-kit/start.sh`.
- Свободные порты `8080`, `8081`, `8026`. Если на машине уже работает другой стенд, остановите его.

## Запуск

```bash
cd weeklyreport
deploy/tester-kit/start.sh                 # образы из реестра, тег = коммит вашей копии
deploy/tester-kit/start.sh --tag <sha>     # образы другого коммита main
deploy/tester-kit/start.sh --local         # образы wr/*, собранные на этой машине
```

Первый запуск занимает несколько минут. В конце скрипт печатает адреса и пароли. Он безопасно запускается повторно:
заново поднимает доступ к страницам, если он пропал.

## Адреса и пользователи

| Что      | Адрес                                                       |
| -------- | ----------------------------------------------------------- |
| Стенд    | http://localhost:8080 (кнопка **Sign in**, вход через SAML) |
| Почта    | http://localhost:8026 (Mailpit, все письма стенда)          |
| Keycloak | http://localhost:8081 (`admin`, пароль в `secrets.env`)     |

Пользователи: `lead1@customreport.local` (лид), `head@customreport.local` (руководитель),
`viewer@customreport.local` (наблюдатель), `admin@customreport.local` (администратор).
Пароли печатает `start.sh` и хранит файл `~/.local/state/wr-tester/secrets.env`.

## Сброс и остановка

- `deploy/tester-kit/reset.sh` стирает базу стенда и загружает демо-данные заново (спросит «yes»).
- `deploy/tester-kit/stop.sh` удаляет стенд вместе с данными. Пароли остаются в `~/.local/state/wr-tester`.

## Если что-то не работает

| Симптом                       | Что делать                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------- |
| «Kubernetes context is …»     | Включите Kubernetes в OrbStack или Docker Desktop, выберите его контекст.       |
| Образы не скачиваются         | Проверьте доступ к реестру, добавьте логин и токен, либо используйте `--local`. |
| «Port … is busy»              | Освободите порт и запустите `start.sh` снова.                                   |
| Страница не открывается       | Запустите `start.sh` ещё раз.                                                   |
| «Too many requests» при входе | Подождите минуту: вход ограничен по частоте.                                    |

## Как сообщить о проблеме

Приложите к сообщению: что делали, ожидали и получили, скриншот и вывод команд

```bash
kubectl -n wr-tester get pods
kubectl -n wr-tester logs deploy/api --tail=100
```

Задача: TASK-145.54.
