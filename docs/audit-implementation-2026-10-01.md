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
