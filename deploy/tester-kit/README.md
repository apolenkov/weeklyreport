# Комплект для тестировщиков WeeklyReport

Локальное развёртывание приложения в Kubernetes для тестирования на собственном компьютере.

## Требования

- **Docker Desktop с Kubernetes** или **OrbStack** с включённым Kubernetes
- **kubectl** и **helm** (версия 3+)
- **4 ГБ ОЗУ** для кластера (если Docker Desktop, требует ~6 ГБ на машину)
- Доступ к реестру образов: `registry.example.com:5005/example/weeklyreport`
  - Если образы отсутствуют, используются локально собранные `wr/*:sha`
- Терминал (bash/zsh)

## Установка

### 1. Клонируй репозиторий и перейди в папку

```bash
cd /path/to/weeklyreport
```

### 2. Создай папку для состояния

Все секреты и сертификаты будут сохранены там (вне Git):

```bash
mkdir -p ~/.local/state/wr-tester
export STATE_DIR="$HOME/.local/state/wr-tester"
```

### 3. Запусти развёртывание

```bash
cd deploy/tester-kit
bash start.sh
```

Скрипт:

- Проверит подключение к кластеру
- Создаст пространство имён `wr-tester`
- Развернёт Keycloak (SAML провайдер) и Mailpit (почта)
- Установит приложение через Helm
- Дождётся готовности (/health/ready)

На дождь может потребоваться **2-3 минуты** (зависит от скорости скачивания образов).

## Доступ

Приложение доступно по адресу: **http://localhost:8080**

### Пользователи для входа

Используй SAML-аутентификацию (кнопка входа на сайте):

| Роль                   | Email                       | Пароль                                               |
| ---------------------- | --------------------------- | ---------------------------------------------------- |
| Лид (создание отчётов) | `lead1@customreport.local`  | в `~/.local/state/wr-tester/secrets.env` (PW_LEAD1)  |
| Глава (публикация)     | `head@customreport.local`   | в `~/.local/state/wr-tester/secrets.env` (PW_HEAD)   |
| Зритель (чтение)       | `viewer@customreport.local` | в `~/.local/state/wr-tester/secrets.env` (PW_VIEWER) |
| Администратор          | `admin@customreport.local`  | в `~/.local/state/wr-tester/secrets.env` (PW_ADMIN)  |

Пароли сгенерированы автоматически и сохранены в файле `secrets.env`.

### Сопутствующие сервисы

- **Keycloak** (управление учётными записями): http://localhost:8081
  - Администратор: `admin` / пароль из `secrets.env` (KC_ADMIN_PASSWORD)
- **Mailpit** (перехват писем): http://localhost:8025

## Использование

### Проверка здоровья приложения

```bash
curl http://localhost:8080/health/ready
```

Ответ `200 OK` означает, что приложение готово.

### Сброс демо-данных

```bash
bash reset.sh
```

Скрипт удалит базу данных и заполнит её свежими демо-данными. Требует подтверждения.

### Остановка

```bash
bash stop.sh
```

Удаляет пространство имён и все ресурсы в кластере (запрашивает подтверждение).

## Проблемы и решения

### Кластер не подключён

Убедись, что Docker Desktop или OrbStack с Kubernetes запущены, и проверь контекст:

```bash
kubectl config current-context
```

Для Docker Desktop контекст должен быть `docker-desktop` или `docker-for-desktop`.

### Образы не скачиваются из реестра

Если нет доступа к `registry.example.com:5005`, используй локально собранные образы:

```bash
bash start.sh --tag <git-sha> --registry wr
```

### Долгий старт или таймауты

Увеличь объём памяти для кластера в параметрах Docker Desktop (требует перезагрузки) или используй OrbStack, который гибче.

## Отправка проблем

Если возникли проблемы:

1. Проверь состояние подов:

   ```bash
   kubectl -n wr-tester get pods
   ```

2. Посмотри логи приложения:

   ```bash
   kubectl -n wr-tester logs -l app=api --tail=50
   ```

3. Опиши проблему на TASK-145.54 с указанием:
   - Вывода `kubectl version`
   - Состояния подов (`get pods`)
   - Релевантных логов
   - Версии Docker/OrbStack

## Полезные команды

```bash
# Просмотр состояния всех подов
kubectl -n wr-tester get pods

# Логи API приложения
kubectl -n wr-tester logs -f deploy/api

# Интерактивный доступ к контейнеру API
kubectl -n wr-tester exec -it deploy/api -- /bin/sh

# Переподключение к Keycloak (если вышла из-за ошибки)
kubectl -n wr-tester rollout restart deploy/keycloak

# Удаление и переустановка приложения (без удаления namespace и БД)
helm uninstall weeklyreport -n wr-tester
bash start.sh
```

---

**Создано:** 2026-10-04  
**Часть задачи:** TASK-145.54
