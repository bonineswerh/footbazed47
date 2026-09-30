# API-Football: границы первого подключения

Проверено 30.09.2026 по официальным материалам. Подключение выполняется только защищённым сервером, в текущем выпуске — status и metadata покрытия выбранного турнира/сезона. Catalog import и public media ещё не включены.

- API origin: `https://v3.football.api-sports.io`, header `x-apisports-key`; secret только `process.env.API_FOOTBALL_KEY`.
- Free plan опубликован как 100 запросов/день с ограниченными сезонами; текущий сезон не считаем доступным автоматически. Настоящий plan/остаток проверяется отдельной admin-командой. [Тарифы](https://www.api-football.com/pricing).
- Успешный HTTP 200 может содержать API errors; пагинация и дневной/минутный quota headers проверяются отдельно. Coverage относится к конкретному season и не гарантирует заполненность каждого матча. [Официальное руководство](https://www.api-football.com/news/post/how-to-get-started-with-api-football-the-complete-beginners-guide), [спецификация v3](https://www.api-football.com/documentation-v3).
- `status.response.requests.limit_day` — дневной лимит; account name/email и произвольные поля не передаются в admin response. Единственный real status smoke после публикации сверяет фактический контракт; suite использует только mocks.
- Логотипы, фото и trademarks поставляются для идентификации/описания, а subscription не передаёт универсальных прав публикации или коммерческого использования. Это ограничение официальных условий, не заключение о применимости конкретного asset к нашему проекту. [Условия, Data/Logos/images и Service & data](https://www.api-football.com/terms).
- `media_assets` остаётся единственным источником public football images; любые будущие API candidates создаются `unknown`. Нет automated verified, внешних image requests, Storage caching/rehosting или новых CSP origins в этом выпуске. Concrete rights/policy review требуется до public media activation.

Полный план identity, player rosters, staging и rollback: [план перехода](../api-football-transition-2026-09-30.md).
