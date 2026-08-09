update public.ratings
set is_public = true
where is_public is null;

update public.player_ratings
set is_best_player = false
where is_best_player is null;

alter table public.ratings
  alter column is_public set not null,
  add column if not exists updated_at timestamptz not null default now();

alter table public.player_ratings
  alter column rating set not null,
  alter column is_best_player set not null;

do $migration$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.ratings'::regclass
      and conname = 'ratings_comment_length_check'
  ) then
    alter table public.ratings
      add constraint ratings_comment_length_check
      check (comment is null or char_length(comment) <= 1000);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.player_ratings'::regclass
      and conname = 'player_ratings_parent_rating_fkey'
  ) then
    alter table public.player_ratings
      add constraint player_ratings_parent_rating_fkey
      foreign key (user_id, match_id)
      references public.ratings (user_id, match_id)
      on delete cascade;
  end if;
end
$migration$;

create unique index if not exists player_ratings_one_best_per_match_idx
  on public.player_ratings (user_id, match_id)
  where is_best_player = true;

create extension if not exists pg_trgm with schema extensions;

create index if not exists matches_home_team_trgm_idx
  on public.matches using gin (lower(home_team_name) extensions.gin_trgm_ops);
create index if not exists matches_away_team_trgm_idx
  on public.matches using gin (lower(away_team_name) extensions.gin_trgm_ops);
create index if not exists matches_league_trgm_idx
  on public.matches using gin (lower(league_name) extensions.gin_trgm_ops);
create index if not exists users_username_trgm_idx
  on public.users using gin (lower(username) extensions.gin_trgm_ops);
create index if not exists users_display_name_trgm_idx
  on public.users using gin (lower(display_name) extensions.gin_trgm_ops);

create or replace function public.save_match_rating(
  p_match_id bigint,
  p_match_rating smallint,
  p_comment text default null,
  p_is_public boolean default true,
  p_player_ratings jsonb default '[]'::jsonb
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
  if normalized_comment is not null and char_length(normalized_comment) > 1000 then
    raise exception using errcode = '22023', message = 'comment_too_long';
  end if;
  if jsonb_typeof(submitted) <> 'array' then
    raise exception using errcode = '22023', message = 'player_ratings_invalid';
  end if;
  if jsonb_array_length(submitted) > 60 then
    raise exception using errcode = '22023', message = 'too_many_player_ratings';
  end if;

  select m.status
  into match_status
  from public.matches m
  where m.id = p_match_id;

  if not found then
    raise exception using errcode = '22023', message = 'match_not_found';
  end if;
  if match_status is distinct from 'finished' then
    raise exception using errcode = '22023', message = 'match_not_finished';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(submitted) as items(entry)
    where jsonb_typeof(entry) <> 'object'
      or not (entry ? 'player_id')
      or jsonb_typeof(entry -> 'player_id') <> 'number'
      or not coalesce((entry ->> 'player_id') ~ '^[1-9][0-9]*$', false)
      or not (entry ? 'rating')
      or jsonb_typeof(entry -> 'rating') <> 'number'
      or not coalesce((entry ->> 'rating') ~ '^[0-9]+$', false)
      or (entry ->> 'rating')::integer not between 1 and 10
      or (
        entry ? 'is_best_player'
        and jsonb_typeof(entry -> 'is_best_player') <> 'boolean'
      )
  ) then
    raise exception using errcode = '22023', message = 'player_ratings_invalid';
  end if;

  if (
    select count(*) <> count(distinct (entry ->> 'player_id')::bigint)
    from jsonb_array_elements(submitted) as items(entry)
  ) then
    raise exception using errcode = '22023', message = 'duplicate_player_rating';
  end if;

  if (
    select count(*) filter (
      where coalesce((entry ->> 'is_best_player')::boolean, false)
    ) > 1
    from jsonb_array_elements(submitted) as items(entry)
  ) then
    raise exception using errcode = '22023', message = 'multiple_best_players';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(submitted) as items(entry)
    where not exists (
      select 1
      from public.players p
      where p.id = (entry ->> 'player_id')::bigint
    )
  ) then
    raise exception using errcode = '22023', message = 'player_not_found';
  end if;

  insert into public.ratings (
    user_id,
    match_id,
    match_rating,
    comment,
    is_public,
    updated_at
  )
  values (
    current_user_id,
    p_match_id,
    p_match_rating,
    normalized_comment,
    coalesce(p_is_public, true),
    now()
  )
  on conflict (user_id, match_id) do update
  set match_rating = excluded.match_rating,
      comment = excluded.comment,
      is_public = excluded.is_public,
      updated_at = now()
  returning id into saved_rating_id;

  delete from public.player_ratings pr
  where pr.user_id = current_user_id
    and pr.match_id = p_match_id;

  insert into public.player_ratings (
    user_id,
    match_id,
    player_id,
    rating,
    is_best_player
  )
  select
    current_user_id,
    p_match_id,
    (entry ->> 'player_id')::bigint,
    (entry ->> 'rating')::smallint,
    coalesce((entry ->> 'is_best_player')::boolean, false)
  from jsonb_array_elements(submitted) as items(entry);

  perform public.record_rating_streak();

  return query
  select
    saved_rating_id,
    coalesce(u.ratings_count, 0),
    coalesce(u.avg_rating, 0),
    coalesce(u.streak, 0),
    u.streak_date
  from public.users u
  where u.id = current_user_id;
end
$function$;

create or replace function public.delete_match_rating(p_match_id bigint)
returns table (
  deleted boolean,
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
  deleted_rows integer := 0;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'auth_required';
  end if;
  if p_match_id is null then
    raise exception using errcode = '22023', message = 'match_required';
  end if;

  delete from public.ratings r
  where r.user_id = current_user_id
    and r.match_id = p_match_id;
  get diagnostics deleted_rows = row_count;

  return query
  select
    deleted_rows > 0,
    coalesce(u.ratings_count, 0),
    coalesce(u.avg_rating, 0),
    coalesce(u.streak, 0),
    u.streak_date
  from public.users u
  where u.id = current_user_id;
end
$function$;

create or replace function public.search_footbazed(
  p_query text,
  p_limit integer default 12
)
returns table (
  entity_type text,
  entity_id text,
  title text,
  subtitle text,
  meta text,
  relevance real
)
language sql
stable
security invoker
set search_path = ''
as $function$
  with input as (
    select lower(btrim(coalesce(p_query, ''))) as query,
           least(greatest(coalesce(p_limit, 12), 1), 20) as result_limit
  ),
  team_names as (
    select m.home_team_name as team_name from public.matches m
    union
    select m.away_team_name as team_name from public.matches m
  ),
  match_results as (
    select
      'match'::text as entity_type,
      m.id::text as entity_id,
      m.home_team_name || ' — ' || m.away_team_name as title,
      m.league_name as subtitle,
      m.status as meta,
      greatest(
        case
          when lower(m.home_team_name || ' ' || m.away_team_name) = i.query then 1.0
          when left(lower(m.home_team_name || ' ' || m.away_team_name), char_length(i.query)) = i.query then 0.92
          when position(i.query in lower(m.home_team_name || ' ' || m.away_team_name || ' ' || m.league_name)) > 0 then 0.82
          else 0.0
        end,
        extensions.similarity(lower(m.home_team_name || ' ' || m.away_team_name || ' ' || m.league_name), i.query)
      )::real as relevance
    from public.matches m
    cross join input i
    where char_length(i.query) >= 2
      and (
        position(i.query in lower(m.home_team_name || ' ' || m.away_team_name || ' ' || m.league_name)) > 0
        or extensions.similarity(lower(m.home_team_name || ' ' || m.away_team_name || ' ' || m.league_name), i.query) >= 0.2
      )
  ),
  team_results as (
    select
      'team'::text as entity_type,
      t.team_name as entity_id,
      t.team_name as title,
      'Команда'::text as subtitle,
      null::text as meta,
      greatest(
        case
          when lower(t.team_name) = i.query then 1.0
          when left(lower(t.team_name), char_length(i.query)) = i.query then 0.94
          when position(i.query in lower(t.team_name)) > 0 then 0.86
          else 0.0
        end,
        extensions.similarity(lower(t.team_name), i.query)
      )::real as relevance
    from team_names t
    cross join input i
    where char_length(i.query) >= 2
      and (
        position(i.query in lower(t.team_name)) > 0
        or extensions.similarity(lower(t.team_name), i.query) >= 0.25
      )
  ),
  user_results as (
    select
      'user'::text as entity_type,
      u.id::text as entity_id,
      coalesce(nullif(u.display_name, ''), u.username, 'Пользователь') as title,
      case when u.username is null then 'Профиль' else '@' || u.username end as subtitle,
      'Профиль'::text as meta,
      greatest(
        case
          when lower(coalesce(u.username, '')) = i.query then 1.0
          when left(lower(coalesce(u.username, '')), char_length(i.query)) = i.query then 0.95
          when position(i.query in lower(coalesce(u.display_name, '') || ' ' || coalesce(u.username, ''))) > 0 then 0.84
          else 0.0
        end,
        extensions.similarity(lower(coalesce(u.display_name, '') || ' ' || coalesce(u.username, '')), i.query)
      )::real as relevance
    from public.users u
    cross join input i
    where char_length(i.query) >= 2
      and (u.is_public = true or u.id = auth.uid())
      and (
        position(i.query in lower(coalesce(u.display_name, '') || ' ' || coalesce(u.username, ''))) > 0
        or extensions.similarity(lower(coalesce(u.display_name, '') || ' ' || coalesce(u.username, '')), i.query) >= 0.25
      )
  ),
  combined as (
    select * from team_results
    union all
    select * from user_results
    union all
    select * from match_results
  )
  select c.entity_type, c.entity_id, c.title, c.subtitle, c.meta, c.relevance
  from combined c
  cross join input i
  order by c.relevance desc, c.title asc
  limit (select result_limit from input);
$function$;

revoke all on function public.save_match_rating(bigint, smallint, text, boolean, jsonb) from public, anon;
revoke all on function public.delete_match_rating(bigint) from public, anon;
revoke all on function public.search_footbazed(text, integer) from public;

grant execute on function public.save_match_rating(bigint, smallint, text, boolean, jsonb) to authenticated;
grant execute on function public.delete_match_rating(bigint) to authenticated;
grant execute on function public.search_footbazed(text, integer) to anon, authenticated;

notify pgrst, 'reload schema';
