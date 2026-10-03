# FOOTBAZED: повторный аудит и карта реализации

Проверенная исходная версия: `513cf46e83fb84da5bc3a73c2a62d4a46c0cd186`, актуальный чистый `main` на GitHub, 1 октября 2026 (Москва). Этот документ — рабочая карта разработки. Открытые пункты не считаются реализованными.

## Фактическая исходная точка

Изучены границы shell/маршрутизации, lazy modules, rating flow, профиль/дневник, обзор/фильтры, страницы сущностей, лента/комментарии, друзья/уведомления, Auth/session cache, серверная авторизация и оба источника каталога, media policy, текущие RPC/grants/RLS, миграции, тесты, CI, CSP/SEO и бюджеты. Main проверен независимо через GitHub. Production проверялась чтением: личные тексты, токены, ключи и содержимое архивных переписок не выгружались.

В production: 111 клубов, 98 эмблем, 261 матч, 2656 игроков, 9 оценок матчей, 9 оценок игроков. Фотографий игроков и API-Football fixture links пока нет. Все матчи относятся к сезону `2026`. У игроков сохранены только legacy provider/external_id; DOB/nationality не сохранены. Эти значения — снимок, а не фиксированные будущие счётчики.

`pnpm run check`: 83 unit tests, static checks, typecheck и 33 миграции проходят. Последний опубликованный Quality Gate также прошёл 201 E2E, SQL/type/clean-database checks и secret scan. Новый выпуск требует своих проверок, а не ссылки на прошлый зелёный CI.

Репрезентативный browser audit: signed-in Home, Overview, Match, Settings и Admin; 390px/1440px, обе темы. Светлая тема уже имеет собственные токены и контрастные rating colors. Полная матрица новых сценариев и проверка физических телефонов ещё впереди; desktop WebKit не является реальным iOS Safari.

## Сохранить

- Существующее SPA и модульную архитектуру; новую функцию не переносить в `app.js`.
- Lazy search/rating/entity/admin assets, escaped templates, explicit action registry, CSP без inline JS, session/request-version guards.
- Атомарное сохранение оценок, supporter side, integer 1–10, одинаковый голубой смысл 9/10, размер выборки и честное отсутствие данных.
- Эмблемы через FBZMedia с provenance, точными origin/path и fallback; `identification` не означает подтверждённую лицензию.
- ID FOOTBAZED и все пользовательские связи. Ни одного reset или destructive replacement.
- Профиль уже существует в mobile primary navigation и desktop account menu. Settings не является единственным входом.
- Чаты уже выведены из продукта. Архив не удаляется; review comments остаются.
- Все security/performance gates и воспроизводимую историю миграций.

## Приоритеты, подтверждённые текущим кодом

### Critical

Подтверждённой текущей аварии, разрешённой клиентской записи в ratings/player_ratings или открытого messaging доступа не найдено. Advisor warnings о discoverable публичных таблицах/definer RPC требуют проверки фактических grants и visibility, а не механического revoke нужных продукту функций. Leaked-password protection выключена; это отдельная настройка Auth, не причина переписывать вход.

### High — правильность футбольных данных

1. `ratings.loadRatePlayers` читает текущие club squads по строке `team`, а `save_match_rating` и trigger проверяют текущий клуб игрока. Это не доказательство участия в матче и ломает исторический смысл при трансферах. Нужны immutable match appearances, реальные стартовые/вышедшие игроки и eligibility на доверенной границе.
2. Нет provider links матчей/игроков. Existing `external_id` принадлежит football-data.org. Их замена на API-Football IDs недопустима.
3. Нет DOB/nationality для надёжного cross-provider matching. Нельзя массово присваивать фотографии и личности по имени. Сначала достоверная identity; неоднозначность пропускается.
4. Live account diagnosis: ключ работает, тариф Free. Запрос coverage сезона 2026 отклонён с plan access error. Нельзя выдавать состав сезона 2024 за состав игры 2026 или покупать тариф автоматически. Сначала исправить ошибочную подсказку про ключ, затем работать с доступным coverage.
5. Оставшиеся 13 эмблем требуют поиска вне уже просмотренных шести league-season каталогов. Публикация — через существующее review/apply, без guessed numeric IDs.

### High — продукт

- Overview и Diary фильтруют по названиям league/team; club selector показывает весь каталог независимо от выбранной лиги. Нужны internal IDs, dependent searchable selectors, chips, URL/back state и mobile sheet в общей filter системе.
- Сравнение профилей уже есть, но только для друзей, автоматически встроено в страницу, с тремя ближайшими матчами. Формула процента — нормированная средняя дистанция, а подпись может восприниматься как доля совпадений. Нужны отдельная явная surface, объяснимая методика, disagreements, разрешённые public data и отсутствие псевдонаучного compatibility.
- Reports/blocks/moderation queue пока отсутствуют. Есть community rate limits; их сохранение не заменяет жалобы/блокировки.
- Profile distribution/insights строятся по максимум 50 загруженным ratings. Пометка ограниченной выборки присутствует, но полноценные summaries должны вычисляться сервером по всей разрешённой истории.

### Medium — завершённость интерфейса

- Overview dense rows пока без media; native selectors и высокая фильтровая панель оттесняют результаты на телефоне.
- Lineup pitch группирует весь squad по позиции, не formation. MOTM badge нужно проверить после перехода на actual appearances.
- Diary без месячных групп и summaries; entity pages без season/competition performance filters.
- Поиск не показывает emblems/photos, несмотря на сохранённую быструю архитектуру.
- Light surfaces местами слишком близки друг к другу; polish делать после feature boundaries, без новой тысячи override строк в `styles.css`.
- Motion durations разбросаны по файлам; нужен небольшой общий набор токенов, сохраняя reduced motion.
- Notifications bounded и с корректными действиями; проверить группировку/read consistency, не создавать новый polling.
- Home already имеет spotlight, pending ratings и favorite clubs; улучшать приоритеты и compact density, не добавлять десятки блоков.

## Последовательность безопасной реализации

1. **Provider readiness:** честное различие plan restriction/auth failure, bounded fixture endpoints, tests, сохранённая квота. Без public API ключа и автоматических фоновых вызовов.
2. **Историческое участие:** additive provider mappings и appearance/lineup snapshots; никаких current squads под видом starting XI. Отдельный aggregate RPC, compatible client, SQL eligibility/transfer/legacy-preservation tests, затем enforcement. Старые пользовательские оценки сохраняются и явно отделяются от подтверждённого участия.
3. **Actual sync:** preview одного точного fixture, validate competition/home/away/date, lineups/events/played substitutes; unknown players не угадываются. Apply атомарный и idempotent, historical club сохранён. Coverage failure оставляет честный fallback.
4. **Media completeness:** безопасное identity enrichment с DOB/nationality, затем provider links/photos и missing emblems. Только identification/descriptive scope, provenance/disable control; без fake licenses и rehosting.
5. **Overview/Diary:** versioned ID filters, selectors по реальным participants, chips, mobile sheet, URL state, bounded pagination, dense media rows и месячные summaries.
6. **Profile comparison:** отдельный lazy feature, публичные разрешённые пары, exact/within-one/distance отдельно, favorite overlaps и объяснение выборки.
7. **Visual system:** intentional dark/light matrix основных экранов; type/number alignment, surfaces, states, event icons/MOTM, mobile lists/pitch. Измерить startup headroom, не повышать budgets.
8. **Moderation/social:** минимальные reports/blocks, owner access, rate limits, admin decision/audit; не возвращать messaging.
9. **Final QA:** relevant unit/pgTAP/E2E, полная check:all, build, migration history/advisors, review changed files, GitHub CI/Vercel/live smoke и реальные browser сценарии.

После каждого meaningful этапа документ дополняется фактическими результатами и оставшимися ограничениями. Покупка сервиса, удаление данных или destructive production migration требует отдельного решения владельца; обычная безопасная разработка выполняется без дополнительного подтверждения.

Источники: [API-Football endpoints](https://www.api-football.com/documentation-v3), [media terms](https://www.api-football.com/terms), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [изменение default grants](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically), [Bookd](https://www.bookdfootball.com/). Reference principles используются для собственного продукта, без копирования интерфейса.

## Этап 1 — историческое участие

Реализованы provider mappings игроков, исторические lineup/appearance snapshots, bounded public reader и service-only preview/apply с привязкой к администратору и неизменной игре. Import делает максимум четыре вызова API; обычное открытие формы не обращается к поставщику. Клуб на дату игры хранится независимо от текущего клуба игрока. Неподтверждённые bench players и несопоставленные provider identities не допускаются к новым оценкам.

Форма больше не запрашивает текущий клубный squad. Подтверждённые стартовые 11 отображаются по grid; вышедшие на замену отдельно, на телефоне — списком. Ранее сохранённые оценки без подтверждённого участия можно сохранить без изменений или явно удалить при сохранении рецензии. Неудачная загрузка составов не блокирует оценку матча. Семантика 9/10 остаётся голубой. MOTM стал читаемой плашкой; неизвестные минуты и события не превращаются в нули.

Исправлена классификация `errors.plan`: ограничение тарифа не представляется ошибкой ключа. Текущий Free не даёт сезон 2026; его составы не подменяются сезонами 2022–2024. Реальное покрытие 2026 и надёжное сопоставление API-Football player IDs пока не получены. Локальные демонстрационные starting XI — только изолированные fixtures, они никогда не импортируются в production.

CI первого feature-коммита: clean migration reset, lint и весь SQL suite, включая 24 новые проверки participation/transfer/legacy/RLS/import, прошли. Сгенерированный из этой базы schema contract получен как проверенный по SHA-256 артефакт; схема типов не написана вручную. Финальная проверка нового head и публикация выполняются отдельно. Остальные этапы карты остаются открытыми.

### Публикация этапа

`0e5d688`: main и production опубликованы, Quality Gate main успешен: 93 unit, 204 E2E, 191 SQL assertions, clean reset, lint, generated types, secret scan. Production HTML/loader/ratings assets проверены по реальным ответам, signed-in форма на матче #242 сохраняет прежнюю оценку Timmy Chandler в read-only разделе, кнопка сохранения доступна. Проверка не отправляла пользовательскую оценку.

Обе миграции применены через Supabase. История сервера: `20260930223916_historical_match_appearances` и `20260930224646_enforce_historical_player_ratings`. Репозиторий использует эти реальные версии; содержимое SQL не изменено. При применении текстового guard понадобилось нормализовать Windows CRLF к каноническому Git LF: обе проверяемые части существующей функции совпали полностью. Неудачная первая попытка транзакционно откатилась; guard не обходился.

Данные до/после совпадают: 261 матч, 2656 игроков, 98 подключённых эмблем, 9 оценок матчей и 9 оценок игроков. Хэши строк обеих таблиц оценок остались идентичными. 2656 legacy provider IDs перенесены в отдельный приватный mapping без изменения игроков. Новых historical lineups в production пока 0: сезон 2026 заблокирован текущим тарифом, вымышленные составы не публиковались.

Production grants подтверждены: клиентам недоступны INSERT appearances, SELECT provider mappings и EXECUTE import/apply; публичный lineup reader работает. Advisors не добавили публично исполняемых SECURITY DEFINER функций. Два новых каталога намеренно доступны через RLS SELECT (GraphQL reports exposure), два служебных mapping/batch table имеют RLS и нулевые клиентские grants. Существующая рекомендация включить leaked-password protection остаётся открытой. Исходная тёмная тема пользователя восстановлена.

## Этап 2 — дневник и обзор

Общая lazy-loaded система фильтров использует internal competition/club IDs. Поиск вариантов работает локально по bounded catalogue; список клубов зависит от реального участия в турнире, включая клубы в нескольких турнирах. При несовместимом выборе клуб сбрасывается. Незнакомый ID из URL остаётся отдельным недоступным вариантом и даёт пустую выборку, вместо неявного расширения до всех клубов. Chips, reset, календарный период, диапазон оценок/счёт и minimum sample в Overview сохраняются в URL и восстанавливаются при reload/back.

Фильтры открываются в доступном диалоге, на телефоне — нижней панели. Поля имеют labels, validation messages, focus trap и Esc; панель портирована в body с сохранением native form ownership. Ручная проверка выявила перекрытие её нижних кнопок navigation stacking context; оно исправлено и покрыто проверкой unoccluded hit target. Light fallback marks получили явный контрастный цвет; accessibility gates не ослаблены.

Diary v2 отсортирован по дате матча и rating ID с keyset pagination по 8 записей. Месячные count/average/review summaries вычисляются по всей разрешённой фильтрованной истории, а не по загруженным восьми строкам. Старые клиенты сохраняют creation-date cursor и name filters. Production data не переписываются. В Diary и Overview матчей эмблемы загружаются одним bounded batched media запросом; остальные Overview сущности получают displayable provenance payload сразу в RPC. Игрок без разрешённой фотографии сохраняет consistent fallback.

Локально прошли 97 unit tests, все 218 E2E в Chromium/Firefox/WebKit, static/type/environment/secret checks и production build. Новые intentional visual references: Overview, filter dialog, Diary в dark/light на 390/1440; прежние reference images не обновлялись. Initial asset budget сохранён: 495532 bytes при лимите 512000. Добавлены 22 pgTAP assertions для IDs, rename stability, old/new cursors, complete summaries, private access и permitted media. Изолированная SQL/CI проверка и production deployment выполняются отдельно перед отметкой этапа опубликованным.

### Применение этапа

Quality Gate `9f1641d` (run 36794760701) полностью успешен: clean reset, generated contract, lint, 213 SQL assertions, application и secret scan. CI обнаружил синтаксический month alias и отсутствие обязательного verified_at в искусственной тестовой media fixture; оба исправлены в feature branch до production DDL, правила provenance не ослаблялись. Реальная версия применённой миграции: `20261001001517_explore_identity_and_months`; SQL в репозитории переименован без изменения содержимого.

Данные до/после совпадают: 261 матч, 2656 игроков, 98 эмблем, 9 оценок матчей и 9 оценок игроков. Хэши обеих таблиц оценок идентичны в проверке до/после (`row_to_json` / ordered MD5). Advisors не добавили новых функций/таблиц exposure и не сообщили performance WARN; прежние public RPC/RLS каталоги и Auth recommendation остаются прежними. Дальнейший live smoke проверяет опубликованные assets, реальные эмблемы и месячные summaries без записи оценок.

`b60a00a` опубликован: main Quality Gate 36795376054 и Vercel deployment успешны. Рабочий браузер подтвердил новые lazy assets и реальные загруженные API-Sports эмблемы в Overview. Bundesliga оставляет 18 клубов из actual fixture relations. Собственный Diary показывает `1–8 из 9`, затем `9–9 из 9`; обе страницы сохраняют полную сводку `9 матчей · средняя оценка 7.4`. Пользовательские записи не отправлялись/не удалялись, production theme остаётся dark.

## Этап 3 — недостающие эмблемы

Для клубов без logo_asset_id добавлен прямой поиск API-Football `/teams?search=...`: один bounded request, query из серверного каталога, country/name/available founding-year checks, отказ при нескольких подходящих provider IDs. Клиент не задаёт provider ID, URL, query или actor. Сборные и неизвестные типы не импортируются. Disabled/unknown existing asset не заменяется автоматически.

Предпросмотр и publish/rollback используют прежний service-only batch mechanism и его identity guards, expiry, atomic lock и admin audit. Новый CATALOG context хранит NULL season; provenance отмечает team-search без выдуманного tournament/season coverage или лицензии. Старые league-season batches остаются совместимыми. Админ видит только bounded список отсутствующих эмблем; смена клуба отменяет прежнюю подготовку. Ordinary unit/E2E используют fixtures, реальная квота не расходуется.

Добавлены unit tests server trust boundary/ambiguity/country/query encoding, mobile E2E prepare/reset/apply без второго provider request и девять SQL assertions compatibility/provenance/rollback/grants. Изолированная CI/schema-contract проверка предшествует production DDL и настоящему поиску 13 оставшихся клубов. Этот этап пока не отмечен опубликованным.

Проверки этапа: 101 unit и 220 E2E локально; feature CI `7173b9c` / `36797400082` полностью успешен, включая 222 pgTAP assertions, clean reset, lint, generated contract и secret scan. Nullable season взят из настоящего CI artifact `11133569815`, ZIP SHA256 `b56a70f1601bd7dfbab4c4822dc718b16524149fa1013ba9f037292566c4cb43`, а не написан вручную. Миграция успешно применена как `20261001004739_missing_club_emblem_lookup`; файл переименован к серверной версии без изменения SQL. Публикация клиента и фактическое наполнение оставшихся эмблем проверяются следующим шагом.

Источник дизайна запроса: [официальный API-Football Teams guide](https://www.api-football.com/news/post/how-to-get-started-with-api-football-the-complete-beginners-guide), direct search доступен независимо от league-season selector; фактический доступ проверяется отдельно.

`b1ee99c` выпущен в main и Vercel, main CI `36798037068` успешен. Actual production admin использует app v70/admin v52; подготовка и публикация через native UI подключили девять клубов: Coventry, Hull, LASK, Le Mans, Levante, Paris FC, Racing Santander, Sunderland, Viking. Все девять remote PNG загрузились в предпросмотре. Эмблем стало 107 из 111; хэши ratings и player_ratings полностью совпадают с предыдущим снимком, SQL/advisors не расширили grants или exposure.

Уточнение 2 октября: четыре оставшихся клуба требуют точных provider naming/history rules. Deportivo ищется по полному названию вместо общего слова. Sabah FA сопоставляется с Sabah FK только при стране Azerbaijan/Azerbaidjan; одноимённый малайзийский клуб исключается. Различные даты predecessor/merger для Málaga (1933/1948/1994) и Paderborn (1907/1908/1985) разрешены только для точной пары name/country, согласно официальным [истории Málaga](https://www.malagacf.com/1941-1992-club-deportivo-malaga) и [хронике Paderborn](https://www.scp07.de/SCP07/Der-Verein/Chronik/). Legacy founded/IDs не переписываются. Batch сохраняет ссылку на основание такого сопоставления; произвольный другой год, клуб, страна или неоднозначность остаются запрещены. Preview показывает конкретные годы и страну отказа. Проверка/выпуск уточнения и повторный live lookup остаются следующими шагами.

Уточнение прошло полный `check:all`: 104 unit, 221 E2E (Chromium/Firefox/WebKit), static/type/migration/environment checks; production build также успешен. Ограниченное Windows окружение не создавало страницы Firefox (`browserContext.newPage` до выполнения теста); разрешённый полный повтор прошёл без исключений и ослабления проверок. Startup budget/старые visual references сохранены. Новая DDL для этого уточнения не нужна.

`aead051` опубликован: main Quality Gate `36977277637` и Vercel успешны. Четыре настоящих запроса и native admin preview/apply подключили Málaga (#217 → 535), Deportivo (#229 → 544), Sabah (#192 → 13976), Paderborn (#154 → 185). Каждый PNG загрузился до публикации. Итог: 111/111 клубов имеют displayable API-Football emblem, у всех 111 сохранены identification scope, terms URL и rights_status=not_verified; подтверждённые лицензии не заявляются. Production cards проверены на 1440×1000 и 390×844 без горизонтального overflow; скриншоты сохранены вне Git в release-backups.

Свежая проверка 2 октября до/после четырёх публикаций: 261 матч, 2656 игроков, 9 match ratings, 9 player ratings; MD5 ordered row_to_json ratings `d38f8dd4d0ef15039868b87103826a42`, player_ratings `575f89f5779761c5865618345ad2293c` неизменны. MD5 списков club IDs `e35f196d50fde71640884cec693a5ad3` и match IDs `9e26cf85e2c4822425f3a6c7ae6f628d` также неизменны. Это сравнение со свежим снимком, а не обещание отсутствия пользовательских изменений между днями. Этап эмблем опубликован; исторические составы 2026 по-прежнему требуют доступа тарифного плана, следующие продуктовые этапы остаются открытыми.

## Этап 4 — явное сравнение профилей

Новая кнопка «Сравнить» открывает отдельный lazy dialog / mobile sheet. Сравнение больше не запрашивается при загрузке друга. Новая SECURITY INVOKER read-only RPC сохраняет старую friend RPC для совместимости, проверяет users RLS и считает только публичные оценки завершённых матчей. Видимый публичный профиль можно сравнить без обязательной дружбы; закрытый — только по существующему accepted-friend доступу. Payload не содержит email, invite_code, is_admin, тексты оценок или private ratings.

Показатели разделены: общие матчи, точные совпадения, доля разницы ≤1 и средняя абсолютная разница. Summary относится ко всей отфильтрованной истории, а не к странице из 12. Нулевая выборка даёт NULL percentage/distance, малая выборка получает пояснение. Internal competition ID и recent/closest/different sorting; bounded pagination, кликабельные матчи/клубы/игроки, batched displayable emblems. Любимые клубы используют existing authorized readers; турниры — counts публичных оценок, общие игроки требуют ≥2 публичных parent ratings у каждого. Это интересы, не выдуманный показатель совместимости.

Route/profile/session guards и clearing-on-close исключают поздние данные в закрытом диалоге. Native labels, focus trap, Esc, restore focus, mobile scroll, обе темы; проверка выявила и исправила потерю фокуса кнопки во время загрузки модуля. 27 новых pgTAP assertions уже прошли в clean CI `36981072220` вместе со всем SQL suite (249 assertions). Первый type diff ожидаемо потребовал реальный generated contract: artifact `11215129682`, SHA256 `40a5881eb3e097d0f8c34dcf3447d5d38b6f839c93ae70d999b1775509a9137e`. Контракт скопирован из артефакта и нормализован; вручную не написан. Финальные CI, production migration и публикация ещё не отмечены завершёнными.

Итоговый локальный `check:all`: 105 unit, 235 E2E в трёх браузерах; build успешен. Новые intentional dark/light visual references на 390/1440 проверены визуально, старые references не изменялись. AA accessibility на 320/390/1440, full-history pagination/filter, empty/private/error/retry, stale-response, route/session clearing и focus restore проходят; общий compatibility сценарий включает сравнение в Firefox/WebKit. Startup assets 496008 bytes при прежнем лимите 512000. Production DDL и deployment выполняются только после финального clean CI.

Feature Quality Gate `87514b2` / `36982789845` полностью успешен: application, clean database reset, generated contract, lint, 249 SQL assertions и secret scan. Read-only миграция применена как `20261002081954_profile_comparison_page`; provisional filename приведён к фактической серверной версии без изменения SQL. Production SECURITY INVOKER / authenticated-only EXECUTE подтверждены. Counts и оба row hashes совпадают со свежим снимком до миграции. Security/performance advisors до/после идентичны за исключением времени наблюдения.

`df3536a` опубликован в main и Vercel; app v72/data v50/profile v7 подтверждены в actual DOM. Native UI: видимый профиль друга → «Сравнить», корректная нулевая общая выборка, реальные любимые клубы и tournament counts; все три API-Football PNG загрузились. Desktop 1440×1000 без overflow; screenshots сохранены вне Git. В main run `36983789871` application и clean database jobs успешны, но secret scan остановился до сканирования: unauthenticated GitHub IP rate limit привёл к ложному запросу лицензии. Интеграция не имеет права rerun (403), gh CLI отсутствует. Workflow обновлён по [официальному примеру Gitleaks](https://github.com/gitleaks/gitleaks-action): v3 для Node 24, автоматический read-only GITHUB_TOKEN, comments выключены. Повторный push должен подтвердить восстановленную проверку; сканер не отключён и правила не ослаблены.

Main `75eb678` Quality Gate `36985189198` полностью успешен, включая secret scan. Actual comparison проверен также на 390×844: нет overflow, close возвращает фокус «Сравнить», screenshots desktop/mobile сохранены. Этап 4 выпущен.

## Этап 5 — полные summaries профиля и точность деталей

Совместимое расширение existing `get_profile_page` добавляет `rating_summary`: полные counts/average/reviews/range, 10 histogram bins, количество турниров по internal IDs и top 6 турниров с count/average. Владелец получает own history, остальные — только public (даже accepted friends). Старые authorization/media/поля/grants функции сохранены guarded definition patch. Нет новых записей, N+1 или API-Football вызовов; materialized visible history, grouped bins и totals используют существующие user indexes. Ratings page по-прежнему ограничена и не определяет summary.

Header, share, activity milestone, details и distribution используют полную разрешённую историю; public count подписан явно, empty average остаётся dash, old-server response сохраняет честный sample fallback. Турниры кликабельны, длинные названия переносятся. Числа распределения теперь Onest/tabular, neutral counts отделены от семантических цветов оценок, ширина колонки учитывает большие counts. Light tournament rows имеют нейтральную поверхность. Account trigger получил явное имя, сохраняемое при hidden mobile username.

Добавлены 24 pgTAP assertions (>50 ratings, private owner/friend/stranger/anon, zero sample, equal tournament labels, full histogram, bounded top/page, unchanged grants) и 14 E2E с новыми intentional 390/1440 dark/light references. Existing profile JSON count/average тоже получают разрешённый scope для старых клиентов; stored user counters не переписываются. Старые references не обновлялись; legacy visual fixture явно использует old-server response, new fixtures проверяют новый aggregate. Compatibility сценарий дополнен полной публичной историей и mobile account label в Chromium/Firefox/WebKit. Финальный локальный check:all успешен: 105 unit, 249 E2E, build. Startup assets 496059 bytes при лимите 512000. После него изменены лишь SQL/pgTAP/doc для совместимых scoped counters; static/type/unit/migration checks повторяются, SQL проходит отдельный clean database CI до production apply.

Feature `e9500f9`, Quality Gate `36987622834`: все jobs успешны; actual clean DB log `Files=11, Tests=273, Result: PASS`, generated contract не изменился, lint/secret scan успешны. Read-only миграция применена как `20261002091050_profile_complete_rating_summary`; provisional filename переименован без изменения SQL. Counts и ordered-by-id hashes совпадают со свежим backup: 261 matches, 2656 players, 111 clubs, 9 ratings и 9 player ratings; `d38f8dd4d0ef15039868b87103826a42` / `575f89f5779761c5865618345ad2293c`. Existing profile definer и anon/authenticated grants сохранены, оба advisors до/после идентичны (observed_at исключён). Client release и live smoke следуют отдельно.

`a4b9623` опубликован в main/Vercel, main Quality Gate `36988497554` успешен. Native production profile показывает 9 ratings / 7.6 average, все четыре турнира с полными counts/averages и полное распределение; app v73/profile v8 подтверждены по DOM. Actual Onest family и имя mobile account trigger проверены; overflow отсутствует на 390/1440. Screenshots сохранены вне Git. Снимок делают после свежего DOM/layout после изменения viewport: немедленный compositor screenshot до settling может показать предыдущую геометрию. Этап 5 выпущен.

## Этап 6 — поиск с displayable media

Совместимая `search_footbazed_v2` сохраняет original ranked reader и его private-user predicate, один bounded invoker RPC обогащает только выдачу club/player/competition. Media проходит RLS, is_displayable_media_asset и exact asset kind; identification только club_logo, unknown/restricted/disabled/wrong-kind отсутствуют. Нет guessed URLs/provider IDs, rehosting, лицензий без подтверждения, N+1 или дополнительных provider API запросов. Старый RPC остаётся для клиентов; новый fallback использует его лишь при PGRST202, остальные ошибки требуют явного retry.

`css/search.css` вместе с JS загружается только при открытии, включает media frames и close 44px. Route/session guard отменяет позднее открытие feature, request sequence/debounce/клавиатура/known UTF service label repair сохранены. FBZMedia обрабатывает ошибки изображений и fallback; декоративное media скрыто от screen reader, текст результата доступен. Добавлены 15 pgTAP и 12 E2E (lazy single RPC, keyboard route, image failure, unknown/wrong-kind, rolling deploy/error/retry, CSS retry, stale module, 320/390/1440 dark/light Axe и четыре новые visual references). 17 targeted E2E вместе с social resilience прошли; финальный check:all — 105 unit и 261 E2E в Chromium/Firefox/WebKit, production build и diff check успешны. Новые visual references просмотрены, старые не обновлялись. Clean database CI и настоящий generated contract проверяются до production; новая DDL ещё не применена.

Первый clean database CI `36990579584` подтвердил reset, lint и весь SQL suite: `Files=12, Tests=288, Result: PASS`; единственная ошибка job — ожидаемый новый RPC в generated type diff. Actual artifact `11219218948`, SHA256 `dde9a481996989dcd10e14cc60b2eacc18ee676262f6aa9049349c5ebc34e05c`, скачан, проверен и нормализован штатным скриптом; контракт не написан вручную. Static/type/unit/migration checks повторно успешны. Финальный feature CI и read-only production apply следуют до публикации клиента.

Feature `ebe0f4a`, Quality Gate `36991182890`: все jobs успешны, включая generated types, 288 SQL assertions и secret scan. Read-only DDL применена как `20261002094642_search_displayable_media`, локальный filename приведён к фактической серверной версии без изменения SQL. Под реальным anon reader Real Madrid (#167) возвращает зарегистрированную API-Football эмблему 541 с identification scope; match labels сохраняют старую известную encoding compatibility обработку. Counts и хэши row_to_json concat ordered by id совпали с непосредственным backup до DDL: ratings `d176892a8319ccdb453b230af9318545`, player ratings `57128d3ee5de6cb14058514b3cdd51c2`; это другой способ сериализации, чем прежние snapshots. Grants anon/authenticated и invoker mode проверены, advisors до/после совпадают (без observed_at). Публикация main и live smoke следуют отдельно.

`cf53c57` опубликован в main/Vercel, Quality Gate `36991918224` успешен. Native production search (app v74/search v58/CSS v1): реальные Real Madrid 541, Rayo 728 и Atlético 530 загрузились; old service labels отображаются корректно. Проверены 1440/390, отсутствие overflow, close 44px и keyboard переход к Real Madrid #167. Screenshots сохранены вне Git, фотографии игроков не выдумывались. Этап 6 выпущен.

## Этап 7 — оформление, motion и настройки

Native light profile показал случайные серые прямоугольники в статистике из-за более специфичных старых light rules. Они удаляются в источнике, профиль сохраняет нейтральные числовые блоки, границы и semantic rating colors. Читаемые Onest/tabular добавлены для оставшихся home review и admin numeric values и заголовка подтверждения. Typography и доменные CSS не возвращаются в eager loading.

Общие duration tokens 120/180/260ms и easing заменяют случайные transition values в shell/calendar/rating/feed/entities/community/admin; transition:all заменяется явно разрешёнными surface properties. Modal/sheet и notifications получают вход с 6px translation, reduced-motion отключает вход, delays и декоративные lifts. Тяжёлые картинки и новые dependencies не добавляются. Appearance-only Settings доступны гостю на телефоне и desktop; UUID/email/role и дублирующая profile navigation убраны. Cancel не применяет выбор, Save сохраняет тему/акцент только локально. Guest test fixture теперь честно возвращает session:null вместо недействительной session с user:null.

Добавлены native guest persistence/cancel/system preference, все восемь theme/accent combinations с AA, 320/390/1440/focus return и reduced-motion rating/filter/notification scenarios. Финальные visual references, full QA и release ещё проверяются; DB не изменяется.

Cross-browser проверка нового Settings сценария выявила прежний focus bug: закрытие account menu без returnFocus заставляло диалог запомнить скрытый menuitem. Обёртка Settings теперь сначала возвращает фокус видимой account button. Порог accessibility/visual проверок не ослабляется; целевые references отражают только изменённые настройки, подпись menuitem и light profile surfaces.

Финальный `check:all` успешен: 105 unit tests и 275 E2E в Chromium/Firefox/WebKit, включая startup budget и AA accessibility; production build и `git diff --check` успешны. Десять намеренно изменённых reference images просмотрены: settings/account menu в обеих темах на desktop/mobile и две light profile surfaces. Остальные visual references не обновлялись. Этап не меняет Supabase schema или production data; feature/main CI и настоящий live smoke подтверждаются отдельно после публикации.

Linux CI первого push выявил deferred account-menu focus и преждевременную проверку загрузки optional images. Отложенный callback теперь проверяет, что меню по-прежнему открыто; assertion эмблем ждёт завершения загрузки обеих картинок с неизменным требованием naturalWidth>0. Повторный полный локальный suite: 105 unit, 275 E2E PASS, build PASS. Повторный feature CI требуется до main release.

`97f7133` опубликован в main/Vercel: feature Quality Gate `36997141367` и main `37097166538` успешны. Actual native production app v75 показывает appearance-only Settings, Onest/tabular и neutral light profile surfaces; overflow отсутствует на 390/1440, реальные эмблемы загружены. Скриншоты вне Git, тема возвращена к исходной. На 3 октября владелец самостоятельно добавил ещё одну оценку: 10 / 7.2; это новое состояние, а не изменение истории миграцией. Этап 7 выпущен. Для устойчивого начального фокуса Linux WebKit следующий клиент направляет focus на видимую кнопку закрытия Settings, сохраняет checked theme и полный focus return.

## Этап 8 — приватные жалобы и проверка администратором

Первая часть minimum moderation: auth-derived report intake, собственная история, фильтры/страницы очереди и атомарное решение с append-only audit. Типы rating/comment/profile; причины harassment/hate/spam/impersonation/other. Текущий этап не скрывает контент и не вводит блокировки/приостановки аккаунтов — эти операции требуют отдельного enforcement во всех readers/mutations. Исторические футбол/рейтинги и identities сохраняются.

Новая additive таблица ограничивает клиентский SELECT собственными строками и явными колонками; snapshot, actor/subject/staff и прямые writes закрыты. SECURITY DEFINER intake строго проверяет доступность цели, canonical IDs, длины, запрет self-report, повтор открытого обращения и лимиты 5/10 минут + 20/сутки под advisory lock. Snapshot содержит только уже доступный текст и label. Admin functions service-only, повторно проверяют защищённого actor; один FOR UPDATE и одна транзакция для решения + audit; повтор не переписывает закрытое решение.

Clean DB Quality Gate `37097856968` успешен: 333 pgTAP, включая 45 новых assertions, lint, generated contract и secret scan. Fixtures старых comments разведены по времени для сохранения существующего антиспама; проверки отказа прямого UPDATE используют WHERE для совместимости с production safeupdate. Actual generated artifact `11264089807` из того же schema state (run `37097366880`), SHA256 `206befb7a8e147ac494b76d1cdaf4e76a1b390451718d43f2639f29e87818532`, проверен и нормализован штатным скриптом, типы не написаны вручную.

Клиент и CSS ленивые, жалобы доступны из чужой записи/комментария/профиля. Own history использует bounded 10-row SELECT с exact count и без staff/snapshot; admin queue — fixed 20-row API с проверенным JWT actor, full filtered count/status counts и стабильной сортировкой. Тексты экранированы, ошибки не раскрывают server diagnostics. Общий dialog/sheet сохраняет Escape/focus return, reset session/route, retry и reduced motion. Mobile admin navigation — контролируемый горизонтальный список с целыми подписями. Добавлены 22 E2E и 6 cross-browser report/history checks; полный клиентский gate, production apply и публикация ещё выполняются.

Итоговый локальный gate: 107 unit и 304 E2E PASS, build PASS; LCP 220ms/CLS 0.0377 и 500610 startup bytes в первом полном контрольном запуске (локальные лабораторные значения, не production RUM). Новые поверхности/14 обновлённых старых references просмотрены. WebKit trigger явно получает фокус перед lazy report open; visibility переключается немедленно с отдельным opacity transition. Старый initial-route timer 100ms удалён: он мог закрывать уведомления после первого взаимодействия; регрессия проверяет начальный маршрут при остановленных browser timers. Comparison ждёт фактического initial focus перед Shift+Tab, search измеряет 44px после окончания transform, assertions не ослаблены.

Первый Linux client CI `37099697386` и диагностический `37100192353` подтвердили SQL/types/security, но выявили exact-image различия между OS для восьми новых кадров. Archive `11265896307`, SHA256 `923e2575502e95933dd42081b36051768b2f1602475f386f0ac5958ea60aaab2`, проверен; все восемь actual images просмотрены: та же компоновка, различия растеризации букв/локального времени. Windows/Linux references разделены с прежним нулевым maxDiffPixelRatio; timezone UTC фиксирует время в этом suite. Для будущих ошибок CI сохраняет mock-only browser diagnostics семь дней. Старые проверки не выключены; publication ждёт зелёного feature CI.


Feature `6596e34`, Quality Gate `37101162393`: все jobs успешны, включая 107 unit, 304 E2E, 333 pgTAP, generated contract и secret scan. Новая additive migration применена как `20261003055925_community_reports`; локальный filename приведён к фактической версии без изменения SQL. Непосредственный снимок до/после подтверждает неизменные ordered row_to_json hashes пользователей, клубов, игроков, матчей, обеих таблиц оценок и media_assets. 10 match ratings / 8 player ratings сохранены; reports=0. Клиентские column grants, own-only RLS, запрет прямых writes, fixed search_path и service-only административные RPC проверены в production.

Новые security advisor notices соответствуют намеренным границам: authenticated видит имя community_reports в GraphQL schema, однако SELECT разрешён только для собственных строк и девяти колонок; snapshot/staff/subject остаются закрыты. submit_community_report доступна authenticated с auth-derived actor и валидацией; admin RPC недоступны anon/authenticated. Новых anon exposure нет, прежняя рекомендация Auth leaked-password protection остаётся. Пять новых unused indexes INFO ожидаемы для пустой таблицы и сохраняются для queue/FK/rate-limit paths. Публикация main и live проверка пустых очереди/истории выполняются отдельно.


`4bd3173` выпущен в main/Vercel; main Quality Gate `37101744425` успешен. Native production подтверждает app v77/styles v63/admin v54 и lazy community-reports v1. Собственная история и admin queue возвращают корректное пустое состояние через реальные RLS/API; форма доступна на чужом видимом профиле. Проверены 390/1440, отсутствие overflow, 44px close, labels/initial focus и focus return; настоящие обращения и решения не создавались. API-Football эмблемы Real Madrid 541 и Liverpool 40 загружены. Этап 8 выпущен; блокировки, ограничения новых публикаций и мягкое скрытие нарушающего контента остаются отдельными следующими этапами.


## Этап 9 — единые публичные футбольные показатели

Проверка влияния будущих блокировок выявила две связанные ошибки: invoker entity summaries включали owner-private player ratings, а ограничение видимости raw votes/profiles могло персонализировать общие показатели. Добавлены две закрытые private views, содержащие только public match votes и player votes с public parent. Ни anon, ни authenticated, ни service_role не получают SELECT на исходные views. Четыре существующие aggregate-only RPC получают fixed-path SECURITY DEFINER и используют исключительно этот scope; сигнатуры и DTO сохраняются. История/сравнение/поиск остаются с собственными RLS. Overview сохраняет public-profile filter, match insights — прежний scope публичных votes независимо от публичности профиля; favorite остается строго auth.uid().

42 новые pgTAP проверки сравнивают guest/owner/second account, private votes обоих владельцев, null/zero cases, private history preservation, favorite isolation и отсутствие review/voter identity в DTO. Существующий parent-rating FK уже запрещает orphan votes; это проверяется отдельным ожидаемым отказом, constraint не отключается ради искусственной fixture. Дополнительные restrictive policies в изолированном тесте действительно скрывают raw votes и profile второго участника, затем доказывают неизменность общих футбольных цифр. Production данные не переписываются. Это подготовка инварианта для полноценного enforcement блокировок, сами блокировки этим этапом ещё не включаются. Clean database CI и publication выполняются перед production DDL.


Локальный полный gate: 107 unit / 304 E2E PASS, build PASS, startup 500596 bytes / LCP 316ms / CLS 0.001. Clean DB run `37103551102` подтвердил 375 SQL assertions и unchanged generated public contract. Первый CI исправил отсутствующие outer semicolons скопированных pg_get_functiondef; следующая fixture попытка orphan vote была закономерно остановлена действующим parent FK, который сохранён и отдельно проверяется. Новые private scores fixture соответствуют фактическому контракту.

Проверка raw CI logs также обнаружила прежний lint false positive в dynamic FOREACH snapshot loop admin_cleanup_development_data. Ошибка выводилась и в успешном опубликованном run `37101744425`, потому что CLI по умолчанию не завершает process ошибкой. Snapshot теперь явно строит тот же объект из тех же 16 таблиц; role/confirmation/backup locks/mutation scopes/ACL не меняются, cleanup не вызывается. CI использует штатный `--fail-on error`, согласно [официальной документации CLI](https://supabase.com/docs/reference/cli/supabase-db-lint), и остановится при error. Дополнительный parser/зависимости не нужны; действующие catalog reset/recovery SQL tests подтверждают формат и восстановление. Новый strict gate проверяется в следующем изолированном CI до применения DDL.
