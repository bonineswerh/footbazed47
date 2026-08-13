# Архитектура FOOTBAZED

## Runtime

FOOTBAZED остаётся статическим History API SPA на HTML, CSS и обычном JavaScript. Supabase предоставляет Auth, Postgres, RLS и RPC. Vercel обслуживает статику, runtime-конфигурацию, sitemap и защищённую admin function.

Публичные маршруты `/club/:id`, `/player/:id`, `/competition/:id`, `/match/:id` и `/profile/:id` переписываются на `index.html`. Локальный E2E-сервер обязан повторять эти rewrite-правила.

## Границы модулей

- `app.js`: shell и маршрутизация.
- `js/auth.js`: сессия и профиль.
- `js/entities.js`: клубы, игроки, турниры.
- `js/media.js`: единственная клиентская точка разрешения domain media и fallback UI.
- `js/home.js`: авторизованный dashboard и избранные клубы.
- `js/search.js`: глобальный поиск и переходы.
- `js/data.js`: общие пагинированные RPC.

`entities`, `feed`, `ratings` и `admin` загружаются лениво. `js/rating-loader.js` сохраняет публичный вызов `openRate()`, но не загружает полный модуль до явного действия пользователя. MediaResolver загружается до доменных экранов, но не выполняет сеть и не блокирует core.

## MediaProvider

`FBZMedia.registerProvider()` и `resolveFromProvider()` образуют выключенную по умолчанию границу будущих интеграций. Provider не считается разрешённым источником из-за наличия API. Он может вернуть только кандидат с provenance и исходным статусом `unknown`; публикация требует отдельной проверки и записи `verified` на сервере.

Frontend отображает URL только когда RPC вернул asset с совпадающим `asset_type`, `usage_status=verified` и HTTPS URL. Во всех остальных состояниях используется deterministic fallback.

## Надёжность

Загрузка избранных клубов является дополнительной: shell авторизованного пользователя рендерится после обязательного `get_my_profile`, затем favorites догружаются без повторного построения навигации. Это исключает гонки панелей и не блокирует вход при временной ошибке дополнительного RPC.
