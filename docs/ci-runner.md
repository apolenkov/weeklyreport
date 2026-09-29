# Локальный runner GitHub Actions

> **Статус: наследие.** Единственный remote репозитория — GitLab (`gitlab`,
> decision-067), CI для него описан в [gitlab-ci.md](./gitlab-ci.md). Документ
> описывает прежний runner GitHub Actions; состояние самого runner здесь не
> проверялось.

`weeklyreport-ci` выполняет CI репозитория `apolenkov/weeklyreport` на постоянной машине OrbStack `01M3FFXA98T6VCN6JEB6WFK4H4`. Runner `2.337.0` зарегистрирован только на уровне репозитория; GitHub API подтвердил ровно одну запись `weeklyreport-ci` со статусом `online` и метками `self-hosted`, `Linux`, `X64`, `weeklyreport-ci`. Автообновление runner оставлено включённым. Один экземпляр принимает не более одного задания одновременно.

## Машина и границы доступа

- Ubuntu 24.04 amd64, 4 CPU, 12 GiB памяти, диск 100 GiB; версия Docker Engine `29.1.3`, Compose `2.40.3`, `runc` `1.3.4`.
- OrbStack подтвердил `isolated=true`, `isolate_network=true`, `forward_ssh_agent=false`; `/mnt/mac` отсутствует, `SSH_AUTH_SOCK` пуст, а команда `mac uname -a` завершается `dial: no such file or directory`. Идентификатор Docker Engine в VM отличается от Docker Engine Mac; общий Docker socket не используется.
- Включён `weeklyreport-ci-egress-firewall.service`. Он блокирует новые входящие соединения и маршруты к частным IPv4, link-local IPv4 и ULA IPv6 адресам. DNS к resolver OrbStack `0.250.250.200:53` разрешён. Внешний трафик в целом разрешён; проверен HTTPS к GitHub из VM и контейнера. От VM и контейнера доступ к LAN блокируется; тестовое опубликованное соединение с Mac к VM также блокировалось. Это не означает проверку всех внешних адресов и протоколов.
- В этой VM включён cgroup v2. Docker с системным cgroup-драйвером завершал `docker run` ошибкой `Inappropriate ioctl for device`; только внутри VM установлен драйвер `cgroupfs`. Ограничения проверены на контейнере: `memory.max=134217728`, `cpu.max=50000 100000` для тестового контейнера с лимитами 128 MiB и 0.5 CPU. Docker сообщает `seccomp is not enabled in your kernel`, поэтому стандартный seccomp-профиль контейнеров не применяется. Изоляция слабее обычного Linux-хоста; это зафиксированное ограничение OrbStack, обходить его нельзя.
- Команды через `orb -m weeklyreport-ci` могут получить недоступные внутри изолированной VM proxy-переменные `HTTP_PROXY`, `HTTPS_PROXY` и `ALL_PROXY`. При ручном сетевом запросе из такого сеанса удаляйте их через `env -u`. Служба runner их снимает и требует перед запуском `weeklyreport-ci-egress-firewall.service` и `docker.service`.
- Служба `actions.runner.apolenkov-weeklyreport.weeklyreport-ci.service` запускает runner от пользователя `runner`, входящего в группу `docker`. Доступ к Docker daemon даёт заданиям root-полномочия внутри VM. Все пять заданий используют точные метки runner; условие каждого пропускает pull request из внешнего fork. Runner предназначен только для доверенных веток этого закрытого репозитория.

## Проверка и управление

С Mac:

```sh
orb list
orb -m weeklyreport-ci sudo systemctl status weeklyreport-ci-egress-firewall.service docker.service
orb -m weeklyreport-ci sudo docker info --format 'Engine={{.ServerVersion}} Cgroup={{.CgroupDriver}}'
orb -m weeklyreport-ci sudo docker ps -a
orb -m weeklyreport-ci sudo systemctl status actions.runner.apolenkov-weeklyreport.weeklyreport-ci.service
gh api repos/apolenkov/weeklyreport/actions/runners --jq '.runners[] | [.name, .status, (.labels | map(.name) | join(","))] | @tsv'
```

В GitHub проверяйте, что API видит ровно один runner с именем `weeklyreport-ci`, статусом `online` и всеми четырьмя метками:

```sh
gh api repos/apolenkov/weeklyreport/actions/runners \
  --jq '.runners[] | [.name, .status, (.labels | map(.name) | join(","))] | @tsv'
```

Служба использует `KillMode=control-group`, чтобы остановка очищала только принадлежащие runner процессы OrbStack, даже когда systemd не может отследить потомков обычным способом. Не меняйте эту настройку без повторной проверки отсутствия осиротевших `Runner.Listener`.

```sh
orb -m weeklyreport-ci systemctl list-units 'actions.runner.*'
orb -m weeklyreport-ci sudo systemctl stop actions.runner.apolenkov-weeklyreport.weeklyreport-ci.service
orb -m weeklyreport-ci sudo systemctl start actions.runner.apolenkov-weeklyreport.weeklyreport-ci.service
orb -m weeklyreport-ci sudo journalctl -u actions.runner.apolenkov-weeklyreport.weeklyreport-ci.service -n 100 --no-pager
```

Остановка службы делает runner `offline`, запуск возвращает его в `online`. Не останавливайте VM для штатной паузы runner. Для обслуживания гостевой системы дождитесь отсутствия заданий, остановите runner, выполните обновление пакетов внутри VM, затем запустите runner и проверьте его статус.

## Восстановление runner

Установленные файлы находятся в `/opt/actions-runner`; рабочие каталоги и диагностические журналы принадлежат пользователю `runner`. Операционные файлы учётных данных, созданные официальным runner, имеют режим `0600` и принадлежат `runner`; не копируйте их. Сам короткоживущий registration token отдельно не сохраняется. GitHub обновляет runner штатным механизмом, потому что при регистрации не отключалось автообновление.

Если runner удалён из GitHub, сначала убедитесь, что запись и служба принадлежат этой машине. Получите короткоживущий registration token непосредственно перед регистрацией и передайте его `config.sh` через stdin; не выводите и не сохраняйте сам token в shell history, журнале, Backlog или Git. Регистрируйте runner на `https://github.com/apolenkov/weeklyreport` с метками `self-hosted,Linux,X64,weeklyreport-ci`. Затем установите и запустите службу из `/opt/actions-runner`. Не используйте `--replace`, пока API показывает runner с тем же именем.

После задания GitHub Actions автоматически удаляет контейнеры сервисов задания. Workflow удаляет Compose-контейнеры и тома только проектов `runtime-production` и `runtime-observability`, образы пяти production-сборок по SHA и кэш BuildKit. Не очищайте весь Docker daemon: он выделен этой VM, но очистка ограничена ресурсами workflow.

## Что подтверждает успешную работу

Runner `online` подтверждает только регистрацию службы. Приёмка CI требует пяти успешных заданий на точном SHA; отдельно требуется `workflow_dispatch`, поскольку он включает runtime smoke. Сверяйте SHA из сводки задания с проверяемой веткой. Локальные проверки и статус runner не заменяют журналы реального запуска. Перед первым CI-запуском проверьте разрешение координатора на использование точной тестовой базы и отсутствие параллельного пользователя той же базы.

Сведения о безопасности и обслуживании сверяйте с [руководством GitHub по добавлению self-hosted runner](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/add-runners), [официальным руководством GitHub по runner](https://docs.github.com/en/actions/reference/runners/self-hosted-runners) и [документацией Docker по метрикам и cgroup v2](https://docs.docker.com/engine/containers/runmetrics/).
