# Модель данных FOOTBAZED

## Доменные сущности

`clubs`, `players`, `competitions` и `matches` являются самостоятельными сущностями. Их существование, поиск, статистика, рейтинги и связи не зависят от наличия изображения.

- `clubs.logo_asset_id` допускает `NULL`; цвета и `metadata` используются для нейтрального fallback.
- `players.photo_asset_id` допускает `NULL`.
- `competitions.logo_asset_id` допускает `NULL`.
- `matches.competition_id` связывает матч с нормализованным турниром и допускает `NULL` для совместимости с ещё не сопоставленными данными.
- `club_competitions` хранит связь многие-ко-многим клуба и турнира.

Старые `clubs.crest_url`, `players.photo_url` и `users.favorite_teams` временно сохранены для обратной совместимости, но публичный интерфейс не использует их как доверенные источники.

## Избранные клубы

`favorite_clubs(user_id, club_id, created_at)` заменяет свободный текст в профиле на отношение пользователя к существующему клубу.

- Составной primary key запрещает дубли.
- Удаление пользователя или клуба каскадно удаляет связь.
- Индекс `(club_id, user_id)` поддерживает счётчики и будущую персонализацию.
- `set_favorite_club` атомарно добавляет или удаляет запись и идемпотентен.
- `get_my_favorite_clubs` возвращает только список текущего пользователя.
- Прямые записи клиентским ролям запрещены; чтение ограничено owner-only RLS.

Legacy-значения `users.favorite_teams` переносятся только при точном совпадении нормализованного названия клуба. Неоднозначный текст не угадывается и не создаёт ложную связь.

## Media assets

`media_assets` является реестром provenance, а не обязательной частью футбольной сущности. Основные поля:

- `asset_type`: `club_logo`, `player_photo`, `competition_logo`, `team_photo`, `other`;
- `source_provider`, `source_url`, `storage_key`, `storage_url`;
- `license_name`, `license_url`, `attribution`;
- `usage_status`: `verified`, `unknown`, `restricted`, `disabled`;
- `verified_at`, `verified_by`, `metadata`, timestamps.

Публичный RLS допускает чтение только `verified`. `unknown`, `restricted` и `disabled` не входят в публичные RPC и не должны отображаться в production.

## Контракт изменений

Изменения БД выполняются в порядке: additive migration, совместимый frontend, проверка production, затем отдельный cleanup. Нельзя делать media-поле обязательным или удалять legacy-поля в той же миграции, которая вводит новые связи.
