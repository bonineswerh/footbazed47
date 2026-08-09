create or replace function public.get_match_insights(p_match_id bigint)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  with public_ratings as (
    select r.match_rating
    from public.ratings r
    where r.match_id = p_match_id
      and r.is_public = true
  ),
  summary as (
    select count(*)::integer as rating_count,
           round(avg(match_rating)::numeric, 1) as average
    from public_ratings
  ),
  score_values as (
    select generate_series(10, 1, -1) as score
  ),
  distribution as (
    select jsonb_agg(
      jsonb_build_object(
        'score', scores.score,
        'count', (
          select count(*)::integer
          from public_ratings r
          where r.match_rating = scores.score
        )
      )
      order by scores.score desc
    ) as values
    from score_values scores
  ),
  player_summary as (
    select
      p.id as player_id,
      p.name,
      p.team,
      round(avg(pr.rating)::numeric, 1) as average,
      count(*)::integer as rating_count,
      count(*) filter (where pr.is_best_player = true)::integer as best_votes
    from public.player_ratings pr
    join public.ratings r
      on r.user_id = pr.user_id
     and r.match_id = pr.match_id
     and r.is_public = true
    join public.players p on p.id = pr.player_id
    where pr.match_id = p_match_id
    group by p.id, p.name, p.team
    order by
      count(*) filter (where pr.is_best_player = true) desc,
      avg(pr.rating) desc,
      count(*) desc,
      p.name asc
    limit 10
  ),
  top_players as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'player_id', ps.player_id,
          'name', ps.name,
          'team', ps.team,
          'average', ps.average,
          'rating_count', ps.rating_count,
          'best_votes', ps.best_votes
        )
        order by ps.best_votes desc, ps.average desc, ps.rating_count desc, ps.name asc
      ),
      '[]'::jsonb
    ) as values
    from player_summary ps
  )
  select jsonb_build_object(
    'rating_count', coalesce(s.rating_count, 0),
    'average', s.average,
    'distribution', coalesce(d.values, '[]'::jsonb),
    'top_players', tp.values
  )
  from summary s
  cross join distribution d
  cross join top_players tp;
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
  ),
  ranked as (
    select c.*,
           row_number() over (
             partition by c.entity_type
             order by c.relevance desc, c.title asc
           ) as type_position
    from combined c
  )
  select r.entity_type, r.entity_id, r.title, r.subtitle, r.meta, r.relevance
  from ranked r
  where r.type_position <= case r.entity_type
    when 'match' then 6
    when 'team' then 5
    when 'user' then 4
    else 3
  end
  order by
    r.relevance desc,
    case r.entity_type when 'team' then 1 when 'match' then 2 else 3 end,
    r.title asc
  limit (select result_limit from input);
$function$;

revoke all on function public.get_match_insights(bigint) from public;
grant execute on function public.get_match_insights(bigint) to anon, authenticated;

notify pgrst, 'reload schema';
