# FOOTBAZED: проверка финального аудита и переход на API-Football

Дата: 30 сентября 2026. Проверяемая версия: `6d688cb81017f2c5879b36c507c3b46660cae37a`, чистый `main`. Это решение перед реализацией, а не заявление о завершённой миграции.

## A. Что подтвердилось

Исследованы серверная авторизация и импорт `api/admin.js`, миграции каталога/оценок/медиа, фактические production constraints и indexes, `FBZMedia`, фильтры `explore/statistics`, профиль, границы lazy loading, правила сборки и тесты. Production проверялась только чтением метаданных и количества записей; личные тексты, email, токены и изображения не выгружались.

На начало этапа: 111 клубов, 6 турниров, 261 матч, 2656 игроков, 6 оценок матчей, 6 оценок игроков, 4 связи избранных клубов. `media_assets` пустая. У всех 2656 игроков есть legacy provider ID в `metadata`. Это исходная точка для будущего сравнения, а не тестовая база, которую можно заново очистить.

Дополнительный read-only preflight подтвердил: у всех игроков `metadata.provider='football-data.org'`, повторяющихся provider player IDs сейчас 0. RLS включён у проверенных clubs/players/matches/ratings/player_ratings/media_assets. Это хороший исходный каталог для additive mapping; возможные будущие трансферы всё равно требуют исторической модели.

- **Уже исправлено (пункты 3–4, 55, 58, 63, 68–70, 73–74, 89):** чаты закрыты; редактор оценок использует общий доступный range и отдельный lazy CSS; действия зарегистрированы явно; CSP запрещает inline JS; начальное SEO и динамический sitemap работают; проверки и isolated E2E существуют. Не делать повторный rewrite этих частей. Проверка CI и live smoke обязательна для каждого нового выпуска, старый зелёный CI не доказывает следующий.
- **Подтверждено (14–19, 23–25, 90):** существующий сервер знает только football-data.org. `external_id` клубов, турниров и матчей относится к этому источнику. API-Football ещё не подключён. При простой замене URL новые IDs создадут другие сущности и повредят связь с пользовательской историей.
- **Подтверждено (18, 49):** players имеет уникальный индекс `(name, team)` и текущий `club_id`. Это не стабильная identity человека. Trigger допуска игрока к матчу смотрит на его текущий клуб/название команды. Одного добавления roster-таблицы недостаточно: перед импортом трансферов нужно изменить чтение составов и проверку исторического участия.
- **Подтверждено (13, 26–32, 79–80):** media architecture существует, но production содержит 0 assets. Поэтому монограммы сейчас закономерны. Уже есть `logo_asset_id` клубов/турниров и `photo_asset_id` игроков; не создавать вторые image columns и не выводить legacy URLs.
- **Подтверждено (33–40, 86):** Обзор работает, но использует общий `league/team` string contract, native selects, одинаковые фильтры разных сущностей. IDs, зависимые списки, active chips и сохранение контекста нужны отдельным этапом, с совместимым RPC.
- **Частично актуально (5–8, 11, 42–51):** базовые оценки, распределение, стороны болельщиков, entity pages, дневник с серверной пагинацией/поиском/датами/счётом существуют. Добавлять историю сезонов, полноценное сравнение друзей и рецензии как отдельный акцент постепенно; не выдавать отсутствующие данные за реализованную аналитику.
- **Подтверждено (45–46):** MVP жалоб/блокировок/решений модератора отсутствует. Это обязательная работа перед широким публичным ростом. Лайки и комментарии уже защищены RPC/RLS; это не заменяет борьбу со спамом и жалобы.
- **Частично актуально (59–61, 65–67, 71–72):** startup budget проходит, но прежний замер 492028 bytes оставляет мало запаса. Cross-browser subset существует; physical-device QA и production RUM им не заменяются. Собственный домен и configurable canonical origin — отдельный выпуск. Новые provider modules остаются на сервере.
- **Не принимаю как изменение контракта (5, 7):** примеры личных оценок 6.8/8.7 не меняют действующие integer RPC/constraints/UI 1–10. Дробные значения оставляем средним оценкам; иначе это отдельная согласованная миграция продукта.
- **Не принимаю предложенную polymorphic-связь без FK (16):** пара `entity_type/internal_id` сама по себе не защищает от ссылки на отсутствующий матч или клуб. Нужны типизированные внешние ключи и ограничения уникальности.
- **Отложено осознанно (9–12, 52–54, 62, 77–78, 81–84, 87–88, 91–94):** Bookd и другие продукты используются как принципы композиции, не как шаблон или источник assets. Большой visual pass — после данных и media policy. News, Wrapped, расширенный live-score, messaging и framework migration не входят в текущий переход.
- **Не подтверждено до серверной проверки (15):** наличие `API_FOOTBALL_KEY` в Vercel Production сообщено владельцем. Нельзя проверить секрет по локальному `.env` или запрашивать его у владельца; новая защищённая диагностика должна показать только configured, тариф и остаток квоты.

Повторный security advisor теперь показывает предупреждения о намеренно доступных агрегирующих SECURITY DEFINER RPC и discoverability GraphQL, а также выключенную leaked-password protection. Эти флаги не равны доказанному обходу доступа. Не отзывать все публичные RPC механически; проверять конкретные grants/policies/ownership. Настройка проверки скомпрометированных паролей — отдельный Auth-пункт с проверкой доступности тарифа. Ошибок утечки секрета или разрушения данных в исследованных путях не обнаружено; это не универсальная гарантия безопасности всего продукта.

## B. Архитектура перехода

### Текущий импорт

`api/admin.js` проверяет access token через Supabase Auth, затем серверный `users.is_admin`. Только после этого использует service role. Football-data загружается с таймаутом и лимитом ответа. Матчи/клубы upsert по `external_id`, игроки — по `(name, team)`. Legacy `prepare_catalog` хранит пакет во staging; `admin_apply_prepared_catalog` предназначен для полной замены каталога с очисткой. **Этот destructive apply не используется для миграции провайдера.**

### Серверный provider layer

Новый CommonJS module вне `api/`, чтобы не создавать случайный отдельный HTTP endpoint: `server/football/api-football.js`. Fixed HTTPS origin, explicit endpoint/parameter contract, secret только `process.env.API_FOOTBALL_KEY`. Никакого provider SDK или нового browser dependency. Старый football-data path остаётся рабочим.

Общий результат: validated items, pagination и quota metadata. Статус аккаунта возвращает только название тарифа, active flag, лимит/использование; не account/email/key/raw payload. Диагностика GET overview не вызывает provider; реальные запросы выполняются только по отдельной admin-команде.

Client: абсолютный timeout вместе с чтением body, response byte limit, запрет redirects, проверка HTTP и `errors` даже при HTTP 200, проверка формы JSON/results/paging, ограниченное число страниц и items. Квота берётся из response headers; не считать отсутствие headers бесконечным лимитом. Любая ошибка содержит только наш error code и безопасные числа. По умолчанию retry выключен; один retry допускается только для временного read failure, внутри request budget и общего deadline, без retry 401/403/429 и без долгого ожидания в Vercel Function.

### Identity mapping

`provider_entity_links`: `provider`, `entity_kind`, `provider_id`, nullable `club_id/player_id/match_id/competition_id` с настоящими FK; CHECK требует ровно один target и соответствие `entity_kind`. UNIQUE по `(provider, entity_kind, provider_id)`; отдельные partial unique indexes по provider и каждому internal target. Только service role, RLS включён, никаких anon/auth grants. Это одна компактная таблица с FK вместо четырёх одинаковых таблиц или слабой generic-ссылки.

Legacy links backfill берёт clubs/competitions/matches `external_id`, players `metadata.external_id` **только при явно подтверждённом `metadata.provider='football-data.org'`**. Перед backfill искать коллизии: один человек мог уже встречаться у нескольких клубов. Коллизии не исправляются silent merge; идут в review. Existing IDs и `external_id` не меняются. Для новых API-Football entities legacy external_id остаётся NULL.

Matching: сначала существующая provider link. Затем однозначные cross-provider identity evidence — клуб + страна + alias/основание; игрок + date_of_birth и дополнительные признаки; матч + competition/clubs/season/provider identity. Имя само по себе не доказательство. Перенесённый kickoff не создаёт новый матч. Неоднозначный кандидат получает review и блокирует применение зависимого fixture/player. В первой пилотной лиге разумнее вручную подтвердить небольшой набор links, чем вводить глобальный fuzzy merge.

### Игроки и исторические составы

Сохраняем `players.id` как человека и все `player_ratings.player_id`. Additive fields: birth_date/nationality при реальной доступности, не выдуманные значения. `player_club_memberships` хранит игрока, клуб, сезон/период, номер и позицию; `match_players` — подтверждённое участие/заявку в конкретном матче, если есть источник. Текущий squad endpoint не доказывает участие в старом матче.

Нужно обновить `save_match_rating`/roster trigger, entity RPC и редактор вместе. Для старых матчей сохраняется явно обозначенный legacy roster fallback; новый источник не должен менять исторический состав по текущему трансферу. Уникальность `(name,team)` снимается только после совместимого чтения и отключения legacy squad writer: иначе старый `on_conflict=name,team` перестанет работать. В переходе old writer разрешён только для ещё не мигрированных scopes; нельзя позволять ему менять API-managed roster.

### Quota и пилот

Официальный Free plan сейчас: 100 запросов/день, доступные сезоны ограничены. Реальный тариф/остаток определяются `/status`, сезон — контролируемым `/leagues?id=…` и проверкой доступности. Не предполагать, что текущий сезон 2026 доступен. [Тарифы](https://www.api-football.com/pricing).

Первый кандидат — Premier League, поскольку она уже есть в каталоге. Выбрать доступный season после диагностики; не оплачивать тариф автоматически. Один status, один league lookup, один teams, один ограниченный fixtures query; squads — по клубам, player history через paginated season endpoint только в пределах заранее рассчитанного бюджета. Текущие squads не выдавать за исторические составы сезона. Нет cron/live polling в пилоте. Reserve минимум 10 запросов и hard budget на job; при нехватке остановить подготовку, не применять неполный пакет.

Headers различают дневной и минутный лимиты; paging требует отдельных запросов, coverage зависит от сезона. Null сохраняется null. [Официальное руководство](https://www.api-football.com/news/post/how-to-get-started-with-api-football-the-complete-beginners-guide).

### Staging, rollout, rollback

1. Новый client и read-only admin diagnosis; ни одного catalog write.
2. Additive provider links + protected import batches/review. Payload staging отделён от публичных таблиц; короткая retention, provider/competition/season/request counters, validation summary и immutable applied marker.
3. Preview candidate links и числа create/update/skip/ambiguous. Empty/partial/error package не применим.
4. Additive atomic apply RPC: lock scope/job, проверить ссылки и все invariants, записать football entities + links одной транзакцией. Никакой очистки ratings/favorites и глобального DELETE. Повтор job возвращает тот же результат; новое обновление использует те же provider links.
5. Проверить количества и конкретные FK/IDs, сравнить snapshot на затронутый scope. Включать primary provider по competition/season, не двумя одновременно пишущими sync loops.
6. Расширять после стабильного пилота. Old provider остаётся comparison/rollback до завершения перехода, затем его writer отключается явно.

Rollback до apply: отменить batch, public data не меняется. После apply: отключить новый writer, сохранить новые links/IDs и пользовательские данные; восстановить только прежние изменённые provider-owned поля из before-image. Не удалять новый матч/игрока, если он уже получил оценку/избранное. Откат кода не является автоматическим откатом БД. Production reset запрещён. Rehearsal выполняется на isolated local/staging, без доступа к production ref.

### Media

Используем существующие `media_assets`, `logo_asset_id` и `photo_asset_id`, уникальность `(source_provider,source_url)`. Источник, идентификатор объекта, тип, URL, attribution, дата проверки и основание policy фиксируются отдельно от entity matching. Импорт создаёт `unknown`; UI продолжает показывать монограмму, пока asset не verified. У API-Football нет универсальной передачи прав на изображения/логотипы; caching/rehosting нельзя считать разрешённым по наличию URL. [Условия API-Football](https://www.api-football.com/terms).

Первая интеграция не скачивает внешние изображения и не расширяет CSP. После решения media policy: отдельный Storage pipeline, host allowlist, лимиты размера/MIME, dimensions, fallback и точный CSP origin. Не ставить всем verified автоматически и не обходить `FBZMedia` ради эффектного screenshot.

## C. Последовательность реализации

1. **Основа API:** этот отчёт, bounded client, protected account/competition diagnosis, безопасные admin states и mock tests. Отдельный выпуск без DB change.
2. **Identity и staging:** FK mapping, legacy backfill с review коллизий, protected job ledger, preview одной лиги/доступного сезона. Чистая БД, SQL tests, generated types, advisors.
3. **Player identity:** совместимый historical roster contract; transfers и old writer transition. Только после этого широкий player import.
4. **Пилот apply:** atomic additive transaction, before-images, repeated/partial/rollback проверки. Production только после isolated rehearsal и точного scope.
5. **Media:** provenance ingestion, review policy, verified assets/fallbacks. Реальная доступность изображений не равна подтверждённому праву публикации.
6. **Provider rollout:** постепенно включить новый источник по scope, затем убрать legacy writer. Preserve identity.
7. **Обзор 2.0:** versioned RPC с competition_id/club_id, dependent search selectors, URL/back context, chips, mobile filters, media-rich dense results.
8. **Visual/reviews/moderation/diary:** отдельные небольшие выпуски; сначала match/calendar/entities и рецензии, затем жалобы/блокировки и история профиля.
9. **Performance/readiness:** startup headroom, critical-path Firefox/WebKit, non-destructive production smoke, реальные телефоны, configurable origin/RUM при необходимости.

## D. Какие миграции действительно нужны

- Provider links с FK, uniqueness, indexes, RLS/grants и collision-safe backfill.
- Новый service-only import ledger/review/apply; не подмена legacy destructive apply.
- Player identity + memberships/match roster и совместимые rating/entity RPC; отдельный enforcement для legacy unique index/writer.
- Overview ID filter RPC и reference selectors; старый RPC сохраняется на время client transition.
- Reports/blocks/moderation decisions с ownership, rate limits и admin audit, без новых messaging grants.

**Не нужны сейчас:** новые media URL columns, новый auth/roles framework, удаление старой history миграций, дробные личные ratings, reset каталога или framework rewrite. Миграции создаются CLI, applied history не редактируется; backup → additive DB → совместимый client → enforcement. `types/database.ts` только генерируется после проверенной чистой БД.

## E. Проверки

- **Client unit:** key missing (без key в error), fixed origin/parameters, timeout до headers и на body, большой/невалидный JSON, HTTP/200 errors, 204, empty response, inconsistent paging/results, rate limit и Retry-After, quota exhaustion, safe bounded retry, aborted request, missing coverage. Ни одного реального upstream вызова в tests.
- **Admin unit:** missing/invalid/non-admin token до provider; configured metadata без обращения upstream; status sanitization (account/email/extra fields не выходят); неподдерживаемый action/league/season; transient failure оставляет безопасный error; legacy paths работают.
- **E2E:** lazy admin assets, account check по нажатию, loading/error/retry, no key input, competition coverage, dark/light/mobile и overflow; mock API only. Не тратить Free quota suite.
- **SQL следующего этапа:** mapping FK/uniqueness/type checks; anon/auth denial/service success; backfill collisions, сохранённые IDs/FKs; apply idempotence, parallel jobs, duplicate rows, ambiguous candidates, moved fixture, result update, partial failure/rollback; player transfers/historical participation; unknown assets не публичны.
- **Release:** `pnpm run check:all`, build, diff check, migration history при schema change, CI + Vercel status, non-destructive public smoke и actual browser scenario. Реальная provider диагностика выполняется отдельно после публикации и показывает только безопасные summary.

В этом первом выпуске схемы БД и football-data writer не меняются. Это позволяет проверить новый секрет и доступность данных, прежде чем рисковать накопленной историей.
