# FOOTBAZED — реализация аудита, этап 2

Основание: полный аудит 8 октября 2026, пункты F03/F06 и итог CI первого этапа. Исходный SHA `f03a109ce36c21ed55938e3b96be8940548a2cde`.

## Выпуск

Активировано правило GitHub **FOOTBAZED main quality gate**, ID **24746363**, только `refs/heads/main`. Оно требует PR, актуальную относительно main ветку и три проверки с конкретным источником GitHub Actions: Static, unit and E2E; Clean database and SQL tests; Secret scan. Запрещены удаление и force push, bypass list пуст. Required approvals=0: один владелец не зависит от второго аккаунта. Настройка подтверждена чтением API, а не только нажатием Create.

`scripts/check-release.mjs` проверяет production Git identity и ждёт push-run нужного workflow для точного SHA main. Успех другого workflow/ветки/коммита/форка не подходит. Проверяется не только итог run, но и завершение всех трёх jobs для того же SHA/run ID. Отказ, отмена, пропущенный job, отсутствие identity или истечение 25 минут не позволяют построить production bundle. Сетевой отказ/лимит GitHub допускает ограниченное ожидание; ответа провайдера и секрета в логах нет. Секретные GitHub/Vercel токены не добавляются: репозиторий публичный.

`scripts/build-static.mjs` вызывает gate до замены dist. `vercel.json` явно задаёт build command. Local/CI/preview не ждут GitHub, что исключает круговую зависимость. `/release.json` содержит только verified, commit и qualityRunId. Восстановление старого кода через Vercel не означает восстановления БД. Владелец по-прежнему способен изменить настройки/код сборки; эти меры не защищают от злонамеренного владельца.

Реальная проверка чтением GitHub: gate отклонил упавший run **37827458851** первого этапа и принял успешный **37794591788**, включая три настоящих jobs. Данные сайта и deployments этой диагностикой не менялись.

## Доступность

`scripts/check-production.mjs` проверяет публичные RU/EN страницы, валидный release.json, стартовые JS/CSS, строгую script CSP и отказ неавторизованному POST admin. Можно передать ожидаемый полный SHA. Запросы ограничены timeout, не следуют редиректам и не содержат сессию. Ошибки возвращают только безопасный код, без HTML, ключей и текста ответа.

Workflow **Production availability** запускает проверку примерно каждые 30 минут (GitHub может задерживать schedule) и вручную. Использует только contents:read; нет новых secrets, записей в БД или обращений к футбольному API. Отказ виден в Actions; доставка писем зависит от уже существующих настроек GitHub владельца. Это первый слой F06, не полный runtime error reporting/RUM, контроль свежести каталога или внешний paging. Владелец проекта — bonineswerh; реакция на ошибку описана в README.

## Ошибки проверок первого этапа

На Linux четыре image assertions очереди жалоб сравнивали меню без новой вкладки «Журнал». Просмотрены actual/diff изображения: изменилось только меню (включая мобильное смещение полосы вкладок), содержимое жалоб не изменилось. Обновлены четыре Linux и четыре Windows эталона; настройки сравнения не ослаблены. Linux actual получены из артефакта того же CI SHA. Windows эталоны сформированы новым локальным прогоном пяти сценариев, включая данные/фильтры/решение, обе темы и 390/1440 px.

Первый полный локальный прогон второго этапа: 152 unit, 549 E2E passed и один сбой Firefox при закрытии контекста (`Browser.removeBrowserContext`), без упавшего CSP assertion. Исходная trace сохранена вне Git. Отдельный прогон пяти CSP-сценариев Firefox прошёл. Финальный `pnpm run check:all --workers=2`: **152 unit + 550 E2E, exit 0**, 7.9 минуты для E2E; `pnpm run build` также прошёл. Chromium — весь набор, Firefox/WebKit — выбранные compatibility/CSP, не 550 в каждом браузере. PR, CI для merge SHA и production smoke записываются в `reports/full-audit-2026-10-08/stage-2/release-verification.json` после их фактического завершения.

## Открыто

F03 существенно усилен, но staging rollback drill ещё не доказан. F06 остаётся частичным: нет сбора/redaction runtime errors, внешнего alert delivery и наблюдаемого freshness job. F01/F02/F05 и остальные пункты аудита сохраняют прежний статус. Схема, RLS, пользовательские записи, тариф поставщика и frontend-дизайн этим этапом не меняются.

Источники контрактов: [GitHub Actions REST](https://docs.github.com/en/rest/actions/workflow-runs), [Vercel system environment variables](https://vercel.com/docs/environment-variables/system-environment-variables), [Vercel redeploy](https://vercel.com/docs/deployments/managing-deployments).
