# Supabase Advisor triage

Last reviewed: 2026-08-10 after migration `enforce_atomic_friendship_writes`.

## Current result

- 48 security notices: 47 documented API-exposure notices and 1 unresolved Auth setting.
- 27 performance notices: all are `unused_index` observations on a small, low-traffic database.
- No `RLS enabled without policy` notices remain.
- `live_chat_messages`, `support_tickets`, and `referee_ratings` contain zero rows and have no client grants. They remain in place for reversible cleanup; the first two also have explicit deny-all policies.

## Security decisions

### Public and authenticated GraphQL exposure

Public catalog reads for `clubs`, `club_aliases`, `matches`, and `players` are intentional. Public community reads currently remain available for visible `users`, `ratings`, `player_ratings`, `rating_likes`, `rating_comments`, and match chat. Their RLS policies remain the authorization boundary.

Authenticated-only exposure for `friendships`, `notifications`, and `predictions` is intentional while the legacy screens still read those tables. RLS limits rows to the current user. Direct writes for ratings, comments, likes, and friendships have moved to validated RPC functions; `friendships` has no client write grants or write policies.

Do not suppress these notices globally. Revoke table grants individually only after the corresponding screen has moved to an RPC and its anon/owner/other-user/admin tests pass.

### SECURITY DEFINER RPC exposure

Anonymous read RPCs (`get_leaderboard`, `get_profile_page`, `get_rating_comments`, `get_social_feed_page`) are intentional public product APIs. Each returns a bounded shape and applies visibility rules inside the function.

Authenticated mutation RPCs for ratings, comments, likes, and friendships are intentional. They require `auth.uid()`, validate ownership and domain constraints, use an empty `search_path`, and expose only the required signature. Internal policy helpers remain executable only by the roles whose RLS policies call them.

The old `get_social_feed` RPC is retained only for a compatible frontend rollout. Revoke and remove it after production has deployed the cursor-based client and release telemetry confirms no calls to the old signature.

### Leaked password protection

Status: accepted temporary risk, deferred on 2026-08-13 because the control requires Supabase Pro. Enable **Authentication -> Providers -> Email -> Leaked password protection** before a wider public launch or immediately after upgrading the plan. This cannot be enabled through a database migration. Re-run Security Advisor after the change; the expected security notice count becomes 47.

Reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

### Hosted development branch

Status: deferred on 2026-08-13 because Supabase Branching is a paid capability. Until a hosted staging environment is funded, local development, preview deployments, and CI must remain blocked from the production project ref. Database changes must pass clean local bootstrap, pgTAP, generated-type comparison, and lint checks before they are applied to production.

Re-evaluate this decision before team expansion, public beta, or any migration that cannot be validated safely against representative hosted data.

## Performance decisions

Do not remove indexes solely because Advisor reports them unused before public traffic exists. Several protect upcoming search, notification, friendship, and cursor-feed paths. Re-evaluate after at least 30 days of representative production traffic using `pg_stat_user_indexes`, query logs, and measured write overhead.

The new `ratings_public_created_id_idx` supports chronological cursor scans. Its immediate unused status is expected because Advisor statistics predate frontend deployment.

Reference: https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index

## Review rule

Run both Security and Performance Advisor after every DDL migration. Record new categories here before release; never treat a warning as safe only because it existed previously.
