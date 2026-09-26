# Supabase Advisor triage

Last reviewed: 2026-09-24, read-only inspection of the hosted project. The local `enforce_direct_message_friendship` migration has NOT been applied there.

## Current result

- 68 security findings in five categories: 12 anonymous table exposures, 18 authenticated table exposures, 8 anonymous SECURITY DEFINER signatures, 29 authenticated SECURITY DEFINER signatures, and 1 unresolved Auth setting.
- 48 performance findings: all are `unused_index` observations. No performance ERROR/WARN categories were returned.
- No `RLS enabled without policy` notices remain.
- Catalog inspection confirms RLS and at least one policy on all 24 public tables, and no unvalidated public foreign keys. Policy presence alone is not proof of correct authorization.
- `anon` and `authenticated` cannot select/update `users.email`, `users.is_admin`, or `users.invite_code`; public rating counters remain read-only. Authenticated users cannot directly insert/update/delete ratings, player ratings, friendships, likes, comments, match chat, or direct messages.
- `admin_cleanup_development_data(text,text)` is executable by `service_role` only, not by `anon` or `authenticated`.
- The hosted `edit_direct_message` definition does not check active friendship. A compatible replacement and pgTAP regression test are prepared locally; this risk remains on the hosted database until the tested migration is deployed.
- `live_chat_messages`, `support_tickets`, and `referee_ratings` remain legacy tables with explicit policies. Their current data volume was not queried in this review.

## Security decisions

### Public and authenticated GraphQL exposure

Public catalog reads for clubs, aliases, competitions, club memberships, matches, players, and verified media are intentional. Public community reads remain available for visible users, ratings, player ratings, likes, and comments. Match chat is read through its bounded RPC; direct table SELECT has been revoked. Their RLS policies and RPC visibility checks remain the authorization boundary.

Authenticated-only exposure for friendships, notifications, predictions, favorites, direct conversations and direct messages is intentional. RLS restricts personal rows or active conversation participants. Direct writes for ratings, comments, likes, friendships and messaging have moved to validated RPC functions.

Do not suppress these notices globally. Revoke table grants individually only after the corresponding screen has moved to an RPC and its anon/owner/other-user/admin tests pass.

### SECURITY DEFINER RPC exposure

Anonymous read RPCs (`get_leaderboard`, `get_profile_page`, `get_rating_comments`, `get_social_feed_page`) are intentional public product APIs. Each returns a bounded shape and applies visibility rules inside the function.

Authenticated mutation RPCs for ratings, comments, likes, and friendships are intentional. They require `auth.uid()`, validate ownership and domain constraints, use an empty `search_path`, and expose only the required signature. Internal policy helpers remain executable only by the roles whose RLS policies call them.

The old `get_social_feed` RPC is retained only for a compatible frontend rollout. Revoke and remove it after production has deployed the cursor-based client and release telemetry confirms no calls to the old signature.

### Leaked password protection

Status: still disabled according to the 2026-09-24 Advisor. Earlier plan-dependent deferral remains documented; the current billing plan was not inspected. Enable **Authentication -> Providers -> Email -> Leaked password protection** before a wider public launch when available. This cannot be enabled through a database migration. Re-run Security Advisor after the change rather than assuming a fixed total finding count.

Reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

### Hosted development branch

Status: deferred on 2026-08-13 because Supabase Branching is a paid capability. Until a hosted staging environment is funded, local development, preview deployments, and CI must remain blocked from the production project ref. Database changes must pass clean local bootstrap, pgTAP, generated-type comparison, and lint checks before they are applied to production.

Re-evaluate this decision before team expansion, public beta, or any migration that cannot be validated safely against representative hosted data.

## Performance decisions

Do not remove indexes solely because Advisor reports them unused before public traffic exists. Several protect upcoming search, notification, friendship, and cursor-feed paths. Re-evaluate after at least 30 days of representative production traffic using `pg_stat_user_indexes`, query logs, and measured write overhead.

The new `ratings_public_created_id_idx` supports chronological cursor scans. Its immediate unused status is expected because Advisor statistics predate frontend deployment.

Reference: https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index

Exposure references: [anonymous tables](https://supabase.com/docs/guides/database/database-linter?lint=0026_pg_graphql_anon_table_exposed), [authenticated tables](https://supabase.com/docs/guides/database/database-linter?lint=0027_pg_graphql_authenticated_table_exposed), [anonymous functions](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [authenticated functions](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). Exposure findings are not suppressed and must be reviewed per contract; the message-edit defect demonstrates why existing exposure is not automatically safe.

## Review rule

Run both Security and Performance Advisor after every DDL migration. Record new categories here before release; never treat a warning as safe only because it existed previously.
