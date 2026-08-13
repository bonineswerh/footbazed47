-- Supporter-aware ratings, editable community messages, private direct messages,
-- robust rating streaks, friend taste comparison and service-only dev cleanup.

alter table public.ratings
  add column if not exists supporter_side text not null default 'neutral';

alter table public.ratings
  drop constraint if exists ratings_supporter_side_check;
alter table public.ratings
  add constraint ratings_supporter_side_check
  check (supporter_side in ('home', 'away', 'neutral'));

create index if not exists ratings_match_public_supporter_idx
  on public.ratings (match_id, supporter_side, match_rating)
  where is_public = true;

alter table public.chat_messages
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists edited_at timestamptz;

alter table public.rating_comments
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists edited_at timestamptz;

create table if not exists public.rating_activity_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_date date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, activity_date)
);

alter table public.rating_activity_days enable row level security;
revoke all on table public.rating_activity_days from public, anon, authenticated;
grant select, insert, update, delete on table public.rating_activity_days to service_role;

insert into public.rating_activity_days (user_id, activity_date)
select distinct r.user_id, (r.created_at at time zone 'UTC')::date
from public.ratings r
on conflict (user_id, activity_date) do nothing;

create or replace function public.refresh_rating_streak(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  latest_day date;
  calculated_streak integer := 0;
begin
  if p_user_id is null then return; end if;

  select max(a.activity_date)
  into latest_day
  from public.rating_activity_days a
  where a.user_id = p_user_id;

  if latest_day is not null and latest_day >= (current_timestamp at time zone 'UTC')::date - 1 then
    with ordered_days as (
      select a.activity_date,
             row_number() over (order by a.activity_date desc) - 1 as offset_days
      from public.rating_activity_days a
      where a.user_id = p_user_id
        and a.activity_date <= latest_day
    )
    select count(*)::integer
    into calculated_streak
    from ordered_days d
    where d.activity_date = latest_day - d.offset_days::integer;
  end if;

  perform set_config('app.allow_managed_profile_update', 'true', true);
  update public.users
  set streak = calculated_streak,
      streak_date = latest_day
  where id = p_user_id;
end
$function$;

do $backfill_streaks$
declare
  activity_user record;
begin
  for activity_user in select distinct a.user_id from public.rating_activity_days a loop
    perform public.refresh_rating_streak(activity_user.user_id);
  end loop;
end
$backfill_streaks$;

create or replace function public.capture_rating_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.rating_activity_days (user_id, activity_date)
  values (new.user_id, (current_timestamp at time zone 'UTC')::date)
  on conflict (user_id, activity_date) do nothing;
  perform public.refresh_rating_streak(new.user_id);
  return new;
end
$function$;

drop trigger if exists capture_rating_activity_trigger on public.ratings;
create trigger capture_rating_activity_trigger
after insert on public.ratings
for each row execute function public.capture_rating_activity();

create or replace function public.record_rating_streak()
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'auth_required';
  end if;
  perform public.refresh_rating_streak(current_user_id);
end
$function$;

revoke all on function public.refresh_rating_streak(uuid) from public, anon, authenticated;
revoke all on function public.capture_rating_activity() from public, anon, authenticated;
revoke all on function public.record_rating_streak() from public, anon, authenticated;

create or replace function public.save_match_rating(
  p_match_id bigint,
  p_match_rating smallint,
  p_comment text,
  p_is_public boolean,
  p_player_ratings jsonb,
  p_supporter_side text
)
returns table (
  rating_id integer,
  ratings_count integer,
  avg_rating numeric,
  streak integer,
  streak_date date
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  submitted jsonb := coalesce(p_player_ratings, '[]'::jsonb);
  normalized_comment text := nullif(btrim(p_comment), '');
  normalized_side text := lower(btrim(coalesce(p_supporter_side, '')));
  match_status text;
  saved_rating_id integer;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'auth_required';
  end if;
  if p_match_id is null then
    raise exception using errcode = '22023', message = 'match_required';
  end if;
  if p_match_rating is null or p_match_rating < 1 or p_match_rating > 10 then
    raise exception using errcode = '22023', message = 'rating_out_of_range';
  end if;
  if normalized_side not in ('home', 'away', 'neutral') then
    raise exception using errcode = '22023', message = 'supporter_side_required';
  end if;
  if normalized_comment is not null and char_length(normalized_comment) > 1000 then
    raise exception using errcode = '22023', message = 'comment_too_long';
  end if;
  if jsonb_typeof(submitted) <> 'array' or jsonb_array_length(submitted) > 60 then
    raise exception using errcode = '22023', message = 'player_ratings_invalid';
  end if;

  select m.status into match_status
  from public.matches m where m.id = p_match_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'match_not_found';
  end if;
  if match_status is distinct from 'finished' then
    raise exception using errcode = '22023', message = 'match_not_finished';
  end if;

  if exists (
    select 1 from jsonb_array_elements(submitted) items(entry)
    where jsonb_typeof(entry) <> 'object'
      or not (entry ? 'player_id')
      or jsonb_typeof(entry -> 'player_id') <> 'number'
      or not coalesce((entry ->> 'player_id') ~ '^[1-9][0-9]*$', false)
      or not (entry ? 'rating')
      or jsonb_typeof(entry -> 'rating') <> 'number'
      or not coalesce((entry ->> 'rating') ~ '^[0-9]+$', false)
      or (entry ->> 'rating')::integer not between 1 and 10
      or (entry ? 'is_best_player' and jsonb_typeof(entry -> 'is_best_player') <> 'boolean')
  ) then
    raise exception using errcode = '22023', message = 'player_ratings_invalid';
  end if;

  if (select count(*) <> count(distinct (entry ->> 'player_id')::bigint)
      from jsonb_array_elements(submitted) items(entry)) then
    raise exception using errcode = '22023', message = 'duplicate_player_rating';
  end if;

  if (select count(*) filter (where coalesce((entry ->> 'is_best_player')::boolean, false)) > 1
      from jsonb_array_elements(submitted) items(entry)) then
    raise exception using errcode = '22023', message = 'multiple_best_players';
  end if;

  if exists (
    select 1 from jsonb_array_elements(submitted) items(entry)
    where not exists (
      select 1
      from public.matches m
      join public.players p on p.id = (entry ->> 'player_id')::bigint
      where m.id = p_match_id
        and ((p.club_id is not null and p.club_id = any(array[m.home_club_id, m.away_club_id]))
          or lower(btrim(p.team)) = any(array[lower(btrim(m.home_team_name)), lower(btrim(m.away_team_name))]))
    )
  ) then
    raise exception using errcode = '22023', message = 'player_not_in_match';
  end if;

  insert into public.ratings (user_id, match_id, match_rating, comment, is_public, supporter_side, updated_at)
  values (current_user_id, p_match_id, p_match_rating, normalized_comment, coalesce(p_is_public, true), normalized_side, now())
  on conflict (user_id, match_id) do update
  set match_rating = excluded.match_rating,
      comment = excluded.comment,
      is_public = excluded.is_public,
      supporter_side = excluded.supporter_side,
      updated_at = now()
  returning id into saved_rating_id;

  delete from public.player_ratings pr
  where pr.user_id = current_user_id and pr.match_id = p_match_id;

  insert into public.player_ratings (user_id, match_id, player_id, rating, is_best_player)
  select current_user_id, p_match_id, (entry ->> 'player_id')::bigint,
         (entry ->> 'rating')::smallint,
         coalesce((entry ->> 'is_best_player')::boolean, false)
  from jsonb_array_elements(submitted) items(entry);

  perform public.refresh_rating_streak(current_user_id);

  return query
  select saved_rating_id, coalesce(u.ratings_count, 0), coalesce(u.avg_rating, 0),
         coalesce(u.streak, 0), u.streak_date
  from public.users u where u.id = current_user_id;
end
$function$;

revoke all on function public.save_match_rating(bigint, smallint, text, boolean, jsonb, text) from public, anon;
grant execute on function public.save_match_rating(bigint, smallint, text, boolean, jsonb, text) to authenticated;

create or replace function public.get_match_insights(p_match_id bigint)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  with segment_names(segment_key, position) as (
    values ('all'::text, 1), ('home'::text, 2), ('away'::text, 3), ('neutral'::text, 4)
  ),
  score_values(score) as (select generate_series(10, 1, -1)),
  segments as (
    select s.segment_key,
      count(r.id)::integer as rating_count,
      round(avg(r.match_rating)::numeric, 1) as average,
      (select jsonb_agg(jsonb_build_object(
        'score', scores.score,
        'count', (select count(*)::integer from public.ratings rd
          where rd.match_id = p_match_id and rd.is_public = true
            and rd.match_rating = scores.score
            and (s.segment_key = 'all' or rd.supporter_side = s.segment_key))
        ) order by scores.score desc) from score_values scores) as distribution,
      s.position
    from segment_names s
    left join public.ratings r on r.match_id = p_match_id and r.is_public = true
      and (s.segment_key = 'all' or r.supporter_side = s.segment_key)
    group by s.segment_key, s.position
  ),
  segment_json as (
    select jsonb_object_agg(segment_key, jsonb_build_object(
      'rating_count', rating_count,
      'average', average,
      'distribution', distribution
    ) order by position) as value
    from segments
  ),
  player_summary as (
    select p.id player_id, p.name, p.team,
      round(avg(pr.rating)::numeric, 1) average,
      count(*)::integer rating_count,
      count(*) filter (where pr.is_best_player)::integer best_votes
    from public.player_ratings pr
    join public.ratings r on r.user_id = pr.user_id and r.match_id = pr.match_id and r.is_public = true
    join public.players p on p.id = pr.player_id
    where pr.match_id = p_match_id
    group by p.id, p.name, p.team
    order by best_votes desc, average desc, rating_count desc, p.name
    limit 10
  ),
  top_players as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'player_id', p.player_id, 'name', p.name, 'team', p.team,
      'average', p.average, 'rating_count', p.rating_count, 'best_votes', p.best_votes
    ) order by p.best_votes desc, p.average desc, p.rating_count desc, p.name), '[]'::jsonb) value
    from player_summary p
  )
  select jsonb_build_object(
    'rating_count', coalesce((sj.value -> 'all' ->> 'rating_count')::integer, 0),
    'average', (sj.value -> 'all' ->> 'average')::numeric,
    'distribution', coalesce(sj.value -> 'all' -> 'distribution', '[]'::jsonb),
    'segments', sj.value,
    'top_players', tp.value
  )
  from segment_json sj cross join top_players tp;
$function$;

create or replace function public.get_match_chat_messages(p_match_id bigint, p_limit integer default 80)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', x.id, 'user_id', x.user_id, 'message', x.message,
    'created_at', x.created_at, 'updated_at', x.updated_at, 'edited_at', x.edited_at,
    'can_edit', coalesce(x.user_id = auth.uid(), false),
    'user', jsonb_build_object('username', x.username, 'display_name', x.display_name, 'avatar_url', x.avatar_url)
  ) order by x.created_at, x.id), '[]'::jsonb)
  from (
    select cm.id, cm.user_id, cm.message, cm.created_at, cm.updated_at, cm.edited_at,
      u.username, u.display_name,
      case when u.avatar_url ~ '^https?://' and char_length(u.avatar_url) <= 2048 then u.avatar_url end avatar_url
    from public.chat_messages cm
    join public.users u on u.id = cm.user_id
    where cm.match_id = p_match_id
    order by cm.created_at desc, cm.id desc
    limit least(greatest(coalesce(p_limit, 80), 1), 120)
  ) x;
$function$;

create or replace function public.send_match_chat_message(p_match_id bigint, p_message text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  clean_message text := btrim(coalesce(p_message, ''));
  saved public.chat_messages;
  author public.users;
begin
  if current_user_id is null then raise exception using errcode = '42501', message = 'auth_required'; end if;
  if char_length(clean_message) < 1 or char_length(clean_message) > 1000 then
    raise exception using errcode = '22023', message = 'invalid_message';
  end if;
  if not exists (select 1 from public.matches m where m.id = p_match_id) then
    raise exception using errcode = 'P0002', message = 'match_not_found';
  end if;
  insert into public.chat_messages (match_id, user_id, message, updated_at)
  values (p_match_id, current_user_id, clean_message, now()) returning * into saved;
  select * into author from public.users u where u.id = current_user_id;
  return jsonb_build_object(
    'id', saved.id, 'user_id', saved.user_id, 'message', saved.message,
    'created_at', saved.created_at, 'updated_at', saved.updated_at, 'edited_at', saved.edited_at,
    'can_edit', true,
    'user', jsonb_build_object('username', author.username, 'display_name', author.display_name, 'avatar_url', author.avatar_url)
  );
end
$function$;

create or replace function public.edit_match_chat_message(p_message_id integer, p_message text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  clean_message text := btrim(coalesce(p_message, ''));
  saved public.chat_messages;
begin
  if current_user_id is null then raise exception using errcode = '42501', message = 'auth_required'; end if;
  if char_length(clean_message) < 1 or char_length(clean_message) > 1000 then
    raise exception using errcode = '22023', message = 'invalid_message';
  end if;
  update public.chat_messages set message = clean_message, updated_at = now(), edited_at = now()
  where id = p_message_id and user_id = current_user_id returning * into saved;
  if saved.id is null then raise exception using errcode = 'P0002', message = 'message_not_found'; end if;
  return jsonb_build_object('id', saved.id, 'message', saved.message, 'updated_at', saved.updated_at, 'edited_at', saved.edited_at);
end
$function$;

revoke all on function public.get_match_chat_messages(bigint, integer) from public;
revoke all on function public.send_match_chat_message(bigint, text) from public, anon;
revoke all on function public.edit_match_chat_message(integer, text) from public, anon;
grant execute on function public.get_match_chat_messages(bigint, integer) to anon, authenticated;
grant execute on function public.send_match_chat_message(bigint, text) to authenticated;
grant execute on function public.edit_match_chat_message(integer, text) to authenticated;
create or replace function public.get_rating_comments(p_rating_id integer, p_limit integer default 60)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', x.id, 'user_id', x.user_id, 'comment', x.comment,
    'created_at', x.created_at, 'updated_at', x.updated_at, 'edited_at', x.edited_at,
    'can_edit', coalesce(x.user_id = auth.uid(), false),
    'can_delete', coalesce(x.user_id = auth.uid(), false),
    'user', jsonb_build_object('username', x.username, 'display_name', x.display_name, 'avatar_url', x.avatar_url)
  ) order by x.created_at), '[]'::jsonb)
  from (
    select rc.id, rc.user_id, rc.comment, rc.created_at, rc.updated_at, rc.edited_at,
      u.username, u.display_name,
      case when u.avatar_url ~ '^https?://' and char_length(u.avatar_url) <= 2048 then u.avatar_url end avatar_url
    from public.rating_comments rc
    join public.ratings r on r.id = rc.rating_id
    join public.users u on u.id = rc.user_id
    where rc.rating_id = p_rating_id and (r.is_public = true or r.user_id = auth.uid())
    order by rc.created_at
    limit least(greatest(coalesce(p_limit, 60), 1), 100)
  ) x;
$function$;

create or replace function public.edit_rating_comment(p_comment_id integer, p_comment text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  clean_comment text := btrim(coalesce(p_comment, ''));
  saved public.rating_comments;
begin
  if current_user_id is null then raise exception using errcode = '42501', message = 'auth_required'; end if;
  if char_length(clean_comment) < 1 or char_length(clean_comment) > 1000 then
    raise exception using errcode = '22023', message = 'invalid_comment';
  end if;
  update public.rating_comments set comment = clean_comment, updated_at = now(), edited_at = now()
  where id = p_comment_id and user_id = current_user_id returning * into saved;
  if saved.id is null then raise exception using errcode = 'P0002', message = 'comment_not_found'; end if;
  return jsonb_build_object(
    'id', saved.id, 'user_id', saved.user_id, 'comment', saved.comment,
    'created_at', saved.created_at, 'updated_at', saved.updated_at, 'edited_at', saved.edited_at,
    'can_edit', true, 'can_delete', true
  );
end
$function$;

revoke all on function public.edit_rating_comment(integer, text) from public, anon;
grant execute on function public.edit_rating_comment(integer, text) to authenticated;

create table if not exists public.direct_conversations (
  id bigint generated by default as identity primary key,
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz,
  check (user_a <> user_b),
  check (user_a::text < user_b::text),
  unique (user_a, user_b)
);

create table if not exists public.direct_messages (
  id bigint generated by default as identity primary key,
  conversation_id bigint not null references public.direct_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text,
  media_kind text check (media_kind in ('image', 'video', 'audio', 'rating')),
  media_path text,
  rating_id integer references public.ratings(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  edited_at timestamptz,
  check (nullif(btrim(body), '') is not null or media_kind is not null)
);

create index if not exists direct_conversations_user_a_idx on public.direct_conversations (user_a, last_message_at desc);
create index if not exists direct_conversations_user_b_idx on public.direct_conversations (user_b, last_message_at desc);
create index if not exists direct_messages_conversation_idx on public.direct_messages (conversation_id, id desc);
create index if not exists direct_messages_sender_created_idx on public.direct_messages (sender_id, created_at desc);

create or replace function public.enforce_direct_message_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if (select count(*) from public.direct_messages dm
      where dm.sender_id = new.sender_id and dm.created_at > now() - interval '10 seconds') >= 8
     or (select count(*) from public.direct_messages dm
      where dm.sender_id = new.sender_id and dm.created_at > now() - interval '1 minute') >= 30 then
    raise exception using errcode = 'P0001', message = 'message_rate_limited';
  end if;
  return new;
end
$function$;

drop trigger if exists direct_messages_rate_limit on public.direct_messages;
create trigger direct_messages_rate_limit
before insert on public.direct_messages
for each row execute function public.enforce_direct_message_rate_limit();

alter table public.direct_conversations enable row level security;
alter table public.direct_messages enable row level security;

drop policy if exists "Conversation members read conversations" on public.direct_conversations;
create policy "Conversation members read conversations" on public.direct_conversations
for select to authenticated using (
  (select auth.uid()) in (user_a, user_b)
  and exists (select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.user_id = user_a and f.friend_id = user_b)
        or (f.user_id = user_b and f.friend_id = user_a)))
);

drop policy if exists "Conversation members read messages" on public.direct_messages;
create policy "Conversation members read messages" on public.direct_messages
for select to authenticated using (exists (
  select 1 from public.direct_conversations c
  where c.id = conversation_id and (select auth.uid()) in (c.user_a, c.user_b)
    and exists (select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.user_id = c.user_a and f.friend_id = c.user_b)
          or (f.user_id = c.user_b and f.friend_id = c.user_a)))
));

revoke all on table public.direct_conversations, public.direct_messages from public, anon;
revoke insert, update, delete on table public.direct_conversations, public.direct_messages from authenticated;
grant select on table public.direct_conversations, public.direct_messages to authenticated;
grant all on table public.direct_conversations, public.direct_messages to service_role;
grant usage, select on sequence public.direct_conversations_id_seq, public.direct_messages_id_seq to service_role;

create or replace function public.are_friends(p_user_a uuid, p_user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.user_id = p_user_a and f.friend_id = p_user_b)
        or (f.user_id = p_user_b and f.friend_id = p_user_a))
  );
$function$;

create or replace function public.get_or_create_direct_conversation(p_friend_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  first_user uuid;
  second_user uuid;
  conversation public.direct_conversations;
begin
  if current_user_id is null then raise exception using errcode = '42501', message = 'auth_required'; end if;
  if p_friend_id is null or p_friend_id = current_user_id then
    raise exception using errcode = '22023', message = 'invalid_friend';
  end if;
  if not public.are_friends(current_user_id, p_friend_id) then
    raise exception using errcode = '42501', message = 'friendship_required';
  end if;

  if current_user_id::text < p_friend_id::text then
    first_user := current_user_id; second_user := p_friend_id;
  else
    first_user := p_friend_id; second_user := current_user_id;
  end if;

  insert into public.direct_conversations (user_a, user_b)
  values (first_user, second_user)
  on conflict (user_a, user_b) do update set user_a = excluded.user_a
  returning * into conversation;

  return jsonb_build_object('id', conversation.id, 'friend_id', p_friend_id,
    'created_at', conversation.created_at, 'last_message_at', conversation.last_message_at);
end
$function$;

create or replace function public.get_direct_messages(
  p_conversation_id bigint,
  p_limit integer default 50,
  p_before_id bigint default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  result jsonb;
begin
  if current_user_id is null then raise exception using errcode = '42501', message = 'auth_required'; end if;
  if not exists (select 1 from public.direct_conversations c where c.id = p_conversation_id
      and current_user_id in (c.user_a, c.user_b) and public.are_friends(c.user_a, c.user_b)) then
    raise exception using errcode = '42501', message = 'conversation_forbidden';
  end if;

  with page as (
    select dm.*, u.username, u.display_name,
      case when u.avatar_url ~ '^https?://' and char_length(u.avatar_url) <= 2048 then u.avatar_url end avatar_url,
      r.match_id, r.match_rating, r.supporter_side,
      m.home_team_name, m.away_team_name, m.home_score, m.away_score
    from public.direct_messages dm
    join public.users u on u.id = dm.sender_id
    left join public.ratings r on r.id = dm.rating_id
      and (r.is_public = true or r.user_id = dm.sender_id)
    left join public.matches m on m.id = r.match_id
    where dm.conversation_id = p_conversation_id and (p_before_id is null or dm.id < p_before_id)
    order by dm.id desc
    limit least(greatest(coalesce(p_limit, 50), 1), 80)
  )
  select jsonb_build_object(
    'items', coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'conversation_id', p.conversation_id, 'sender_id', p.sender_id,
      'body', p.body, 'media_kind', p.media_kind, 'media_path', p.media_path, 'rating_id', p.rating_id,
      'created_at', p.created_at, 'updated_at', p.updated_at, 'edited_at', p.edited_at,
      'can_edit', p.sender_id = current_user_id,
      'sender', jsonb_build_object('username', p.username, 'display_name', p.display_name, 'avatar_url', p.avatar_url),
      'rating', case when p.rating_id is null then null else jsonb_build_object(
        'match_id', p.match_id, 'score', p.match_rating, 'supporter_side', p.supporter_side,
        'home_team_name', p.home_team_name, 'away_team_name', p.away_team_name,
        'home_score', p.home_score, 'away_score', p.away_score) end
    ) order by p.id), '[]'::jsonb),
    'has_more', count(*) >= least(greatest(coalesce(p_limit, 50), 1), 80),
    'next_before_id', min(p.id)
  ) into result from page p;
  return coalesce(result, jsonb_build_object('items', '[]'::jsonb, 'has_more', false));
end
$function$;

create or replace function public.send_direct_message(
  p_conversation_id bigint,
  p_body text default null,
  p_media_kind text default null,
  p_media_path text default null,
  p_rating_id integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  clean_body text := nullif(btrim(coalesce(p_body, '')), '');
  clean_kind text := nullif(lower(btrim(coalesce(p_media_kind, ''))), '');
  clean_path text := nullif(btrim(coalesce(p_media_path, '')), '');
  conversation public.direct_conversations;
  saved public.direct_messages;
begin
  if current_user_id is null then raise exception using errcode = '42501', message = 'auth_required'; end if;
  select * into conversation from public.direct_conversations c
  where c.id = p_conversation_id and current_user_id in (c.user_a, c.user_b);
  if conversation.id is null then raise exception using errcode = '42501', message = 'conversation_forbidden'; end if;
  if not public.are_friends(conversation.user_a, conversation.user_b) then
    raise exception using errcode = '42501', message = 'friendship_required';
  end if;
  if clean_body is not null and char_length(clean_body) > 2000 then
    raise exception using errcode = '22023', message = 'message_too_long';
  end if;
  if clean_kind is not null and clean_kind not in ('image', 'video', 'audio', 'rating') then
    raise exception using errcode = '22023', message = 'invalid_media_kind';
  end if;
  if clean_kind in ('image', 'video', 'audio') and
     (clean_path is null or clean_path !~ ('^' || p_conversation_id::text || '/' || current_user_id::text || '/[a-zA-Z0-9._-]+$')) then
    raise exception using errcode = '22023', message = 'invalid_media_path';
  end if;
  if clean_kind = 'rating' and (p_rating_id is null or not exists (
    select 1 from public.ratings r where r.id = p_rating_id and (r.is_public or r.user_id = current_user_id)
  )) then raise exception using errcode = '22023', message = 'rating_not_shareable'; end if;
  if clean_body is null and clean_kind is null then
    raise exception using errcode = '22023', message = 'empty_message';
  end if;

  insert into public.direct_messages (conversation_id, sender_id, body, media_kind, media_path, rating_id)
  values (p_conversation_id, current_user_id, clean_body, clean_kind, clean_path,
          case when clean_kind = 'rating' then p_rating_id else null end)
  returning * into saved;
  update public.direct_conversations set last_message_at = saved.created_at where id = p_conversation_id;
  return jsonb_build_object('id', saved.id, 'created_at', saved.created_at);
end
$function$;

create or replace function public.edit_direct_message(p_message_id bigint, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  clean_body text := nullif(btrim(coalesce(p_body, '')), '');
  saved public.direct_messages;
begin
  if current_user_id is null then raise exception using errcode = '42501', message = 'auth_required'; end if;
  if clean_body is null or char_length(clean_body) > 2000 then
    raise exception using errcode = '22023', message = 'invalid_message';
  end if;
  update public.direct_messages set body = clean_body, updated_at = now(), edited_at = now()
  where id = p_message_id and sender_id = current_user_id returning * into saved;
  if saved.id is null then raise exception using errcode = 'P0002', message = 'message_not_found'; end if;
  return jsonb_build_object('id', saved.id, 'body', saved.body, 'updated_at', saved.updated_at, 'edited_at', saved.edited_at);
end
$function$;

revoke all on function public.are_friends(uuid, uuid) from public, anon, authenticated;
revoke all on function public.enforce_direct_message_rate_limit() from public, anon, authenticated;
revoke all on function public.get_or_create_direct_conversation(uuid) from public, anon;
revoke all on function public.get_direct_messages(bigint, integer, bigint) from public, anon;
revoke all on function public.send_direct_message(bigint, text, text, text, integer) from public, anon;
revoke all on function public.edit_direct_message(bigint, text) from public, anon;
grant execute on function public.get_or_create_direct_conversation(uuid) to authenticated;
grant execute on function public.get_direct_messages(bigint, integer, bigint) to authenticated;
grant execute on function public.send_direct_message(bigint, text, text, text, integer) to authenticated;
grant execute on function public.edit_direct_message(bigint, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-media', 'chat-media', false, 31457280,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','audio/webm','audio/ogg','audio/mpeg','audio/mp4'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Conversation members read chat media" on storage.objects;
create policy "Conversation members read chat media" on storage.objects
for select to authenticated using (
  bucket_id = 'chat-media'
  and (storage.foldername(name))[1] ~ '^[0-9]+$'
  and exists (select 1 from public.direct_conversations c
    where c.id = case when (storage.foldername(name))[1] ~ '^[0-9]+$'
      then ((storage.foldername(name))[1])::bigint else null end
      and (select auth.uid()) in (c.user_a, c.user_b)
      and exists (select 1 from public.friendships f
        where f.status = 'accepted'
          and ((f.user_id = c.user_a and f.friend_id = c.user_b)
            or (f.user_id = c.user_b and f.friend_id = c.user_a))))
);

drop policy if exists "Conversation members upload chat media" on storage.objects;
create policy "Conversation members upload chat media" on storage.objects
for insert to authenticated with check (
  bucket_id = 'chat-media'
  and (storage.foldername(name))[1] ~ '^[0-9]+$'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and exists (select 1 from public.direct_conversations c
    where c.id = case when (storage.foldername(name))[1] ~ '^[0-9]+$'
      then ((storage.foldername(name))[1])::bigint else null end
      and (select auth.uid()) in (c.user_a, c.user_b)
      and exists (select 1 from public.friendships f
        where f.status = 'accepted'
          and ((f.user_id = c.user_a and f.friend_id = c.user_b)
            or (f.user_id = c.user_b and f.friend_id = c.user_a))))
);

drop policy if exists "Authors delete own chat media" on storage.objects;
create policy "Authors delete own chat media" on storage.objects
for delete to authenticated using (
  bucket_id = 'chat-media' and (storage.foldername(name))[2] = (select auth.uid())::text
);

do $publication$
begin
  alter publication supabase_realtime add table public.direct_messages;
exception when duplicate_object then null;
end
$publication$;

create or replace function public.get_profile_comparison(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  result jsonb;
begin
  if current_user_id is null then raise exception using errcode = '42501', message = 'auth_required'; end if;
  if p_user_id is null or p_user_id = current_user_id then
    raise exception using errcode = '22023', message = 'comparison_user_invalid';
  end if;
  if not public.are_friends(current_user_id, p_user_id) then
    raise exception using errcode = '42501', message = 'friendship_required';
  end if;

  with common as (
    select mine.match_id, mine.match_rating my_score, theirs.match_rating friend_score,
      abs(mine.match_rating - theirs.match_rating) gap,
      m.home_team_name, m.away_team_name, m.league_name, m.match_date
    from public.ratings mine
    join public.ratings theirs on theirs.match_id = mine.match_id and theirs.user_id = p_user_id and theirs.is_public = true
    join public.matches m on m.id = mine.match_id
    where mine.user_id = current_user_id and mine.is_public = true
  ),
  summary as (
    select count(*)::integer common_matches,
      round(coalesce(avg(gap), 0)::numeric, 1) average_gap,
      round(coalesce(100 - avg(gap) * (100.0 / 9.0), 0)::numeric, 0)::integer agreement_score,
      count(*) filter (where gap = 0)::integer exact_matches
    from common
  ),
  closest as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'match_id', c.match_id, 'home_team_name', c.home_team_name, 'away_team_name', c.away_team_name,
      'league_name', c.league_name, 'my_score', c.my_score, 'friend_score', c.friend_score, 'gap', c.gap
    ) order by c.gap, c.match_date desc), '[]'::jsonb) value
    from (select * from common order by gap, match_date desc limit 3) c
  ),
  contrasts as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'match_id', c.match_id, 'home_team_name', c.home_team_name, 'away_team_name', c.away_team_name,
      'league_name', c.league_name, 'my_score', c.my_score, 'friend_score', c.friend_score, 'gap', c.gap
    ) order by c.gap desc, c.match_date desc), '[]'::jsonb) value
    from (select * from common order by gap desc, match_date desc limit 3) c
  )
  select jsonb_build_object(
    'common_matches', s.common_matches, 'agreement_score', s.agreement_score,
    'average_gap', s.average_gap, 'exact_matches', s.exact_matches,
    'closest', cl.value, 'contrasts', ct.value
  ) into result from summary s cross join closest cl cross join contrasts ct;
  return result;
end
$function$;

revoke all on function public.get_profile_comparison(uuid) from public, anon;
grant execute on function public.get_profile_comparison(uuid) to authenticated;

create or replace function public.admin_cleanup_development_data(p_scope text, p_confirmation text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  clean_scope text := lower(btrim(coalesce(p_scope, '')));
  matches_before integer := 0;
  players_before integer := 0;
  ratings_before integer := 0;
begin
  if current_user <> 'service_role' then raise exception using errcode = '42501', message = 'service_role_required'; end if;
  if p_confirmation is distinct from 'DELETE FOOTBAZED DATA' then
    raise exception using errcode = '22023', message = 'confirmation_required';
  end if;
  if clean_scope not in ('matches', 'players', 'ratings', 'all') then
    raise exception using errcode = '22023', message = 'invalid_cleanup_scope';
  end if;

  select count(*)::integer into matches_before from public.matches;
  select count(*)::integer into players_before from public.players;
  select count(*)::integer into ratings_before from public.ratings;

  if clean_scope = 'ratings' then
    delete from public.player_ratings;
    delete from public.ratings;
  end if;
  if clean_scope in ('matches', 'all') then delete from public.matches; end if;
  if clean_scope in ('players', 'all') then delete from public.players; end if;
  if clean_scope in ('ratings', 'matches', 'all') then
    delete from public.rating_activity_days;
    perform set_config('app.allow_managed_profile_update', 'true', true);
    update public.users set ratings_count = 0, avg_rating = 0, streak = 0, streak_date = null;
  end if;

  return jsonb_build_object(
    'scope', clean_scope,
    'deleted', jsonb_build_object(
      'matches', matches_before - (select count(*)::integer from public.matches),
      'players', players_before - (select count(*)::integer from public.players),
      'ratings', ratings_before - (select count(*)::integer from public.ratings)
    )
  );
end
$function$;

revoke all on function public.admin_cleanup_development_data(text, text) from public, anon, authenticated;
grant execute on function public.admin_cleanup_development_data(text, text) to service_role;

notify pgrst, 'reload schema';
