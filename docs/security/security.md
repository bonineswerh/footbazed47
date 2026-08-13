# Security и RLS

## Доверительные границы

Весь frontend и Supabase publishable/anon key публичны. Авторизация выполняется RLS, ограниченными grants, RPC и повторной server-side проверкой admin JWT. `service_role` допустим только в Vercel functions.

## Избранные клубы

- `favorite_clubs` имеет RLS.
- Authenticated пользователь читает только строки, где `auth.uid() = user_id`.
- Прямые `INSERT`, `UPDATE`, `DELETE` отозваны.
- `set_favorite_club` проверяет Auth и существование клуба, сериализует одинаковую операцию advisory lock и не принимает `user_id` от клиента.
- Anon не имеет `EXECUTE` на mutation/list RPC.

## Media

- Клиентские роли имеют только `SELECT` и видят только `usage_status=verified`.
- Клиент не может создавать, подтверждать или менять assets.
- Ссылка на asset в Club/Player/Competition nullable и не влияет на доступность сущности.
- `unknown`, `restricted`, `disabled`, HTTP URL и несовпадающий тип блокируются и в SQL RPC, и в `FBZMedia`.
- `verified` требует `verified_at` и доступного URL. Заполнять его можно только после проверки прав на конкретный asset.

## Проверка изменений

Каждое расширение таблиц/RPC сопровождается тестом для anon, владельца, чужого пользователя и service boundary. После DDL запускаются Supabase security/performance advisors. Любой новый `SECURITY DEFINER` обязан иметь пустой `search_path`, явную Auth/authorization проверку и отозванный `PUBLIC EXECUTE`.
