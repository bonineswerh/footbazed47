begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(10);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'one@example.test', crypt('password-1', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'two@example.test', crypt('password-2', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.users (id, username, display_name)
values
  ('10000000-0000-0000-0000-000000000001', 'sql_test_one', 'SQL Test One'),
  ('10000000-0000-0000-0000-000000000002', 'sql_test_two', 'SQL Test Two');

insert into public.clubs (id, name, short_name) overriding system value
values (910001, 'Test Home FC', 'Test Home'), (910002, 'Test Away FC', 'Test Away'), (910003, 'Spoof FC', 'Spoof');

insert into public.matches (id, league_name, home_team_name, away_team_name, match_date, status, home_club_id, away_club_id) overriding system value
values (920001, 'Test League', 'Test Home FC', 'Test Away FC', now() - interval '1 day', 'finished', 910001, 910002);

insert into public.players (id, name, team, club_id) overriding system value
values (930001, 'Valid Player', 'Test Home FC', 910001), (930002, 'Spoofed Player', 'Spoof FC', 910003);

insert into public.ratings (user_id, match_id, match_rating)
values ('10000000-0000-0000-0000-000000000001', 920001, 8);

insert into public.ratings (user_id, match_id, match_rating, created_at)
values ('10000000-0000-0000-0000-000000000002', 920001, 7, now() - interval '1 minute');

select lives_ok(
  $$insert into public.player_ratings (user_id, match_id, player_id, rating) values ('10000000-0000-0000-0000-000000000001', 920001, 930001, 8)$$,
  'a player from either match club can be rated'
);

select throws_ok(
  $$insert into public.player_ratings (user_id, match_id, player_id, rating) values ('10000000-0000-0000-0000-000000000001', 920001, 930002, 9)$$,
  '22023',
  'player_not_in_match',
  'a player outside the match roster is rejected'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is(
  public.request_friendship('10000000-0000-0000-0000-000000000002')->>'status',
  'pending',
  'friend request is created through RPC'
);

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select is(
  public.respond_friendship('10000000-0000-0000-0000-000000000001', 'accept')->>'status',
  'accepted',
  'recipient accepts through RPC'
);

reset role;
select is(
  (select count(*)::integer from public.friendships where status = 'accepted' and user_id in ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002')),
  2,
  'acceptance creates the symmetric relationship atomically'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is(
  public.remove_friendship('10000000-0000-0000-0000-000000000002')->>'status',
  'removed',
  'friendship is removed through RPC'
);

reset role;
select is(
  (select count(*)::integer from public.friendships where user_id in ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002')),
  0,
  'both relationship rows are removed atomically'
);

select ok(
  (public.get_social_feed_page('all', 1, null, null, null)->>'has_more')::boolean
  and public.get_social_feed_page('all', 1, null, null, null)->'next_cursor' is not null,
  'the first feed page returns an opaque continuation cursor'
);

with first_page as (
  select public.get_social_feed_page('all', 1, null, null, null) as value
), second_page as (
  select public.get_social_feed_page(
    'all',
    1,
    (value#>>'{next_cursor,created_at}')::timestamptz,
    (value#>>'{next_cursor,rating_id}')::integer,
    (value#>>'{next_cursor,score}')::integer
  ) as value
  from first_page
)
select isnt(
  first_page.value#>>'{items,0,rating_id}',
  second_page.value#>>'{items,0,rating_id}',
  'the cursor advances without repeating the previous rating'
)
from first_page cross join second_page;

insert into public.rating_comments (rating_id, user_id, comment, created_at)
select r.id, '10000000-0000-0000-0000-000000000001', 'rate limit fixture ' || sequence_number, now() - interval '10 seconds'
from public.ratings r
cross join generate_series(1, 5) sequence_number
where r.user_id = '10000000-0000-0000-0000-000000000001' and r.match_id = 920001;

select throws_ok(
  $$insert into public.rating_comments (rating_id, user_id, comment) select id, '10000000-0000-0000-0000-000000000001', 'too many' from public.ratings where user_id = '10000000-0000-0000-0000-000000000001' and match_id = 920001$$,
  'P0001',
  'comment_rate_limit',
  'the database rejects comment bursts even when the client is bypassed'
);

select * from finish();
rollback;
