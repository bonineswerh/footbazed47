# Приватный FOOTBAZED: порядок перехода

Приватный репозиторий разумен для закрытой разработки. Он скроет историю, серверный код, SQL и внутренние документы от новых посетителей GitHub. Сайт останется публичным; браузер по-прежнему получает его клиентский HTML/CSS/JS. Уже скачанные копии и публичные форки не исчезнут. Идея и внешний вид остаются наблюдаемыми на сайте. Это ограничение доступа к исходникам, а не полная защита от копирования.

Локальная работа Codex, ваш доступ в GitHub и существующее подключение Vercel могут продолжать работать с личным приватным репозиторием. Нужно сохранить доступ уже установленных GitHub Apps к `footbazed47`; расширять их на все репозитории не требуется.

## Что проверено

10 октября 2026 в GitHub Licensing у владельца показан **GitHub Free**. Текущий репозиторий публичный. Защита `main` требует PR и трёх проверок без bypass. На Free rulesets/защита ветки в приватном личном репозитории не поддерживаются; для сохранения этой защиты нужен **GitHub Pro**. Подписку оформляет владелец самостоятельно. Не отключать существующие правила ради смены видимости.

Vercel Production проверяет точный main-push Quality Gate через GitHub API. Для публичного репозитория авторизация не нужна. После закрытия анонимный запрос не сможет подтвердить CI; сборка остановится, прежний сайт останется доступным. `scripts/check-release.mjs` теперь поддерживает необязательный **FOOTBAZED_GITHUB_READ_TOKEN** только во время production build. Проверки SHA, workflow и всех трёх jobs сохраняются. Токен не входит в клиентские файлы или release.json, не выводится в журнал; запросы идут только на фиксированный GitHub API с запретом перенаправлений.

## Действия владельца после публикации поддержки токена

1. GitHub → аватар → **Settings → Billing and licensing → Licensing**. Если план Free, оформить Pro для сохранения защиты приватной `main`. Не менять видимость до этого.
2. GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**. Имя: `FOOTBAZED Vercel CI read`. Resource owner: `bonineswerh`. Repository access: **Only select repositories → footbazed47**. Repository permissions: **Actions → Read-only**; Metadata Read-only добавляется GitHub автоматически. Другие права, особенно write и Administration, не нужны. Выберите ограниченный срок действия и запомните дату замены.
3. Создание и копирование токена выполняйте самостоятельно. Не отправляйте токен в чат, скриншоты, файлы проекта или GitHub. Храните резервную запись в своём менеджере секретов.
4. Vercel → проект **footbazed47 → Settings → Environment Variables → Add**. Key: **FOOTBAZED_GITHUB_READ_TOKEN**. Value: созданный токен. Environment: **Production**. Отметьте Sensitive, если интерфейс предлагает. Значение вводите сами; не используйте публичные префиксы и не добавляйте его в API/config.
5. Пока репозиторий публичный, выполнить **Redeploy** текущего проверенного Production-коммита. Убедиться, что Vercel Ready и `/release.json` содержит его SHA и успешный Quality Gate. Так проверяется доступ токена до смены видимости.
6. Только после этих проверок: GitHub → **footbazed47 → Settings → General → Danger Zone → Change visibility → Change to private**. Прочитать предупреждения и подтвердить название. Сохранить правила `main` активными; проверить доступ GitHub/Vercel интеграций.
7. Повторить безопасный PR/CI/main/release цикл. Проверить private badge, enforcement ruleset, успешный CI, новый Production SHA и обычный вход/матчи/поиск. Удаление правил, отключение gate или прямой push в main не используются.

Просроченный, отозванный или недостаточно привилегированный токен остановит новые релизы. Замените его в Production и повторите сборку проверенного коммита; защиту не обходите.

Контракты: [GitHub: видимость](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility), [GitHub: rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets), [GitHub: Actions REST](https://docs.github.com/en/rest/actions/workflow-runs), [Vercel: GitHub](https://vercel.com/docs/git/vercel-for-github).
