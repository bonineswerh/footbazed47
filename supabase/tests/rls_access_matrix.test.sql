begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(45);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('11000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-public@example.test', crypt('password-1', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('11000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-private@example.test', crypt('password-2', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('11000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-other@example.test', crypt('password-3', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.users (id, username, display_name, is_public)
values
  ('11000000-0000-0000-0000-000000000001', 'rls_public', 'RLS Public', true),
  ('11000000-0000-0000-0000-000000000002', 'rls_private', 'RLS Private', false),
  ('11000000-0000-0000-0000-000000000003', 'rls_other', 'RLS Other', true);

insert into public.clubs (id, name, short_name) overriding system value
values (940001, 'RLS Home FC', 'RLS Home'), (940002, 'RLS Away FC', 'RLS Away');

insert into public.matches (
  id, league_name, home_team_name, away_team_name, match_date, status,
  home_club_id, away_club_id
) overriding system value
values
  (950001, 'RLS League', 'RLS Home FC', 'RLS Away FC', now() - interval '1 day', 'finished', 940001, 940002),
  (950002, 'RLS League', 'RLS Away FC', 'RLS Home FC', now() + interval '1 day', 'scheduled', 940002, 940001);

insert into public.players (id, name, team, club_id) overriding system value
values (960001, 'RLS Player', 'RLS Home FC', 940001);

insert into public.ratings (id, user_id, match_id, match_rating, comment, is_public)
values
  (970001, '11000000-0000-0000-0000-000000000001', 950001, 8, 'Public rating', true),
  (970002, '11000000-0000-0000-0000-000000000002', 950001, 7, 'Private rating', false);

insert into public.player_ratings (id, user_id, match_id, player_id, rating)
values
  (971001, '11000000-0000-0000-0000-000000000001', 950001, 960001, 8),
  (971002, '11000000-0000-0000-0000-000000000002', 950001, 960001, 7);

insert into public.predictions (id, user_id, match_id, home_pred, away_pred)
values (972001, '11000000-0000-0000-0000-000000000002', 950001, 2, 1);

insert into public.friendships (id, user_id, friend_id, status)
values
  (973001, '11000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000002', 'accepted'),
  (973002, '11000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000001', 'accepted');

insert into public.rating_likes (id, user_id, rating_id)
values
  (974001, '11000000-0000-0000-0000-000000000003', 970001),
  (974002, '11000000-0000-0000-0000-000000000003', 970002);

insert into public.rating_comments (id, rating_id, user_id, comment, created_at)
values
  (975001, 970001, '11000000-0000-0000-0000-000000000003', 'Public comment', now() - interval '20 seconds'),
  (975002, 970002, '11000000-0000-0000-0000-000000000003', 'Private comment', now() - interval '10 seconds');

insert into public.notifications (id, user_id, from_user_id, type, message)
values (976001, '11000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000001', 'like', 'Private notification');

insert into public.chat_messages (id, match_id, user_id, message, created_at)
values (977001, 950001, '11000000-0000-0000-0000-000000000001', 'Existing chat message', now() - interval '10 seconds');

insert into public.admin_audit_logs (id, actor_id, action, target_type)
values (978001, '11000000-0000-0000-0000-000000000003', 'rls_test', 'test');

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

-- 01-11: anonymous users see public football/social data only.
select is((select count(*)::integer from public.users where id = '11000000-0000-0000-0000-000000000001'), 1, 'anon reads a public profile');
select is((select count(*)::integer from public.users where id = '11000000-0000-0000-0000-000000000002'), 0, 'anon cannot read a private profile');
select is((select count(*)::integer from public.ratings where id = 970001), 1, 'anon reads a public rating');
select is((select count(*)::integer from public.ratings where id = 970002), 0, 'anon cannot read a private rating');
select is((select count(*)::integer from public.player_ratings where id = 971001), 1, 'anon reads player ratings attached to a public rating');
select is((select count(*)::integer from public.player_ratings where id = 971002), 0, 'anon cannot read player ratings attached to a private rating');
select is((select count(*)::integer from public.rating_comments where id = 975001), 1, 'anon reads comments on a public rating');
select is((select count(*)::integer from public.rating_comments where id = 975002), 0, 'anon cannot read comments on a private rating');
select is((select count(*)::integer from public.rating_likes where id = 974001), 1, 'anon reads likes on a public rating');
select is((select count(*)::integer from public.rating_likes where id = 974002), 0, 'anon cannot read likes on a private rating');
select is((select count(*)::integer from public.chat_messages where id = 977001), 1, 'anon reads public match chat');

-- 12-14: anonymous roles cannot reach privileged data or write RPCs.
select ok(not has_table_privilege('anon', 'public.admin_audit_logs', 'SELECT'), 'anon has no audit log privilege');
select ok(not has_function_privilege('anon', 'public.request_friendship(uuid)', 'EXECUTE'), 'anon cannot request friendships');
select ok(not has_function_privilege('anon', 'public.save_match_rating(bigint,smallint,text,boolean,jsonb)', 'EXECUTE'), 'anon cannot save ratings');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

-- 15-21: the owner can read and update only owner-scoped state.
select is((select count(*)::integer from public.users where id = '11000000-0000-0000-0000-000000000002'), 1, 'owner reads the private profile');
select is((select count(*)::integer from public.ratings where id = 970002), 1, 'owner reads the private rating');
select is((select count(*)::integer from public.player_ratings where id = 971002), 1, 'owner reads the private player rating');
select is((select count(*)::integer from public.predictions where id = 972001), 1, 'owner reads the prediction');
select is((select count(*)::integer from public.notifications where id = 976001), 1, 'owner reads the notification');
select lives_ok($$update public.notifications set read = true where id = 976001$$, 'owner marks a notification as read');
select is((select count(*)::integer from public.friendships where id in (973001, 973002)), 2, 'either friendship party reads both symmetric rows');

-- 22-23: authenticated RPC grants exist for the transaction-safe write path.
select ok(has_function_privilege('authenticated', 'public.request_friendship(uuid)', 'EXECUTE'), 'authenticated can request friendships through RPC');
select ok(has_function_privilege('authenticated', 'public.respond_friendship(uuid,text)', 'EXECUTE'), 'authenticated can respond to friendships through RPC');

select set_config('request.jwt.claims', '{"sub":"11000000-0000-0000-0000-000000000003","role":"authenticated"}', true);

-- 24-28: an unrelated user cannot observe another user's private state.
select is((select count(*)::integer from public.users where id = '11000000-0000-0000-0000-000000000002'), 0, 'unrelated user cannot read a private profile');
select is((select count(*)::integer from public.ratings where id = 970002), 0, 'unrelated user cannot read a private rating');
select is((select count(*)::integer from public.predictions where id = 972001), 0, 'unrelated user cannot read another prediction');
select is((select count(*)::integer from public.notifications where id = 976001), 0, 'unrelated user cannot read another notification');
select is((select count(*)::integer from public.friendships where id in (973001, 973002)), 0, 'unrelated user cannot read another friendship');

-- 29-37: direct writes cannot bypass domain RPCs or append-only contracts.
select ok(not has_table_privilege('authenticated', 'public.friendships', 'INSERT'), 'friendships cannot be inserted directly');
select ok(not has_table_privilege('authenticated', 'public.friendships', 'UPDATE'), 'friendships cannot be updated directly');
select ok(not has_table_privilege('authenticated', 'public.friendships', 'DELETE'), 'friendships cannot be deleted directly');
select ok(not has_table_privilege('authenticated', 'public.ratings', 'INSERT'), 'match ratings cannot be inserted directly');
select ok(not has_table_privilege('authenticated', 'public.player_ratings', 'INSERT'), 'player ratings cannot be inserted directly');
select ok(not has_table_privilege('authenticated', 'public.chat_messages', 'UPDATE'), 'chat messages are not client-editable');
select ok(not has_table_privilege('authenticated', 'public.chat_messages', 'DELETE'), 'chat messages are not client-deletable');
select lives_ok(
  $$insert into public.chat_messages (match_id, user_id, message) values (950001, '11000000-0000-0000-0000-000000000003', 'Own chat message')$$,
  'authenticated user appends an own chat message'
);
select throws_like(
  $$insert into public.chat_messages (match_id, user_id, message) values (950001, '11000000-0000-0000-0000-000000000001', 'Spoofed chat message')$$,
  '%row-level security%',
  'authenticated user cannot spoof a chat author'
);

-- 38-39: prediction RLS permits owner writes and rejects identity spoofing.
select lives_ok(
  $$insert into public.predictions (user_id, match_id, home_pred, away_pred) values ('11000000-0000-0000-0000-000000000003', 950002, 1, 1)$$,
  'authenticated user creates an own prediction'
);
select throws_like(
  $$insert into public.predictions (user_id, match_id, home_pred, away_pred) values ('11000000-0000-0000-0000-000000000001', 950002, 3, 0)$$,
  '%row-level security%',
  'authenticated user cannot spoof a prediction owner'
);

-- 40-43: administrative and retired tables stay outside the client API.
select ok(not has_table_privilege('authenticated', 'public.admin_audit_logs', 'SELECT'), 'authenticated cannot read audit logs directly');
select ok(not has_table_privilege('authenticated', 'public.support_tickets', 'SELECT'), 'authenticated cannot access retired support tickets');
select ok(not has_table_privilege('authenticated', 'public.live_chat_messages', 'SELECT'), 'authenticated cannot access retired live chat');
select ok(
  has_table_privilege('service_role', 'public.admin_audit_logs', 'SELECT')
    and has_table_privilege('service_role', 'public.admin_audit_logs', 'INSERT')
    and not has_table_privilege('service_role', 'public.admin_audit_logs', 'UPDATE')
    and not has_table_privilege('service_role', 'public.admin_audit_logs', 'DELETE'),
  'service role audit access is append-only'
);

-- 44-45: avatar storage remains bounded and owner-scoped.
reset role;
select ok(
  (select file_size_limit = 2097152 and allowed_mime_types <@ array['image/jpeg','image/png','image/webp']::text[] from storage.buckets where id = 'avatars'),
  'avatar bucket enforces the two-megabyte image contract'
);
select is(
  (select count(*)::integer from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like '%own avatar%'),
  3,
  'avatar storage has owner-scoped insert, update and delete policies'
);

select * from finish();
rollback;
