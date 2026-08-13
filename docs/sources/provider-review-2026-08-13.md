# Обзор потенциальных media providers

Дата проверки: 2026-08-13. Проверены официальные условия поставщиков. Это технический обзор, не юридическое заключение.

## Итог

Ни один из рассмотренных providers не подтверждён как универсальный production-источник эмблем клубов, логотипов турниров и фотографий игроков для FOOTBAZED. Все интеграции остаются `UNVERIFIED` и отключены.

| Provider | Media в API | Что говорят официальные условия | Решение |
| --- | --- | --- | --- |
| TheSportsDB | Artwork, badges, player media | Платный API допускает использование сервиса и custom artwork с упоминанием источника, но trademarked logos и third-party content требуют учёта прав; для player media нужно проверять Creative Commons marker | UNVERIFIED; возможен только после проверки плана и каждого типа asset |
| football-data.org | Crest URLs и футбольные данные | Attribution обязателен; условия отдельно предупреждают, что права на graphics, logos и profile photos должен получить владелец приложения | UNVERIFIED; данные можно оценивать отдельно от media |
| API-Sports | Logos/images в API | Условия не передают лицензионные или коммерческие права; пользователь отвечает за third-party IP | UNVERIFIED |
| Sportmonks | Logos/photos | FAQ указывает, что изображения защищены авторским правом и proof/permission должен организовать владелец приложения | UNVERIFIED |

## Официальные источники

- TheSportsDB Terms of Use: https://www.thesportsdb.com/docs_terms_of_use.php
- football-data.org Terms: https://www.football-data.org/about
- API-Sports Terms: https://api-sports.io/terms
- Sportmonks FAQ: https://www.sportmonks.com/faq/

## Обязательная проверка перед подключением

Нужны письменные ответы по коммерческому использованию, sublicensing/CDN caching, attribution, правам на trademarks и player likeness, сроку хранения, удалению после прекращения договора и территории. До этого любой импорт создаётся только как `usage_status=unknown` и не показывается пользователям.
