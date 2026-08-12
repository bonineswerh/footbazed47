create or replace function public.get_matches_page(
  p_status text default 'all',
  p_league text default null,
  p_query text default null,
  p_limit integer default 24,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare
  normalized_status text := lower(btrim(coalesce(p_status, 'all')));
  normalized_league text := nullif(btrim(coalesce(p_league, '')), '');
  normalized_query text := left(lower(btrim(coalesce(p_query, ''))), 80);
  normalized_limit integer := least(greatest(coalesce(p_limit, 24), 1), 48);
  normalized_offset integer := least(greatest(coalesce(p_offset, 0), 0), 10000);
  result jsonb;
begin
  if normalized_status not in ('all', 'live', 'scheduled', 'finished', 'postponed', 'cancelled') then
    raise exception using errcode = '22023', message = 'invalid_match_status';
  end if;

  if normalized_league = 'all' then
    normalized_league := null;
  end if;

  with filtered as materialized (
    select
      m.id,
      m.league_name,
      m.home_team_name,
      m.away_team_name,
      m.home_club_id,
      m.away_club_id,
      m.match_date,
      m.status,
      m.home_score,
      m.away_score,
      m.external_id,
      m.league_code,
      m.matchday,
      m.season,
      case m.status when 'live' then 0 when 'scheduled' then 1 when 'finished' then 2 else 3 end as sort_status,
      case when m.status = 'scheduled' and m.match_date < current_timestamp then 1 else 0 end as sort_stale,
      case when m.status in ('live', 'scheduled') and m.match_date >= current_timestamp then m.match_date end as sort_upcoming,
      case when m.status = 'finished' or (m.status = 'scheduled' and m.match_date < current_timestamp) then m.match_date end as sort_recent
    from public.matches m
    where (normalized_status = 'all' or m.status = normalized_status)
      and (normalized_league is null or m.league_name = normalized_league)
      and (
        normalized_query = ''
        or lower(m.home_team_name) like '%' || normalized_query || '%'
        or lower(m.away_team_name) like '%' || normalized_query || '%'
        or lower(m.league_name) like '%' || normalized_query || '%'
      )
  ),
  page as materialized (
    select *
    from filtered
    order by sort_status, sort_stale, sort_upcoming asc nulls last, sort_recent desc nulls last, id desc
    limit normalized_limit
    offset normalized_offset
  ),
  totals as (
    select count(*)::integer as total from filtered
  ),
  league_values as (
    select distinct m.league_name
    from public.matches m
    where m.league_name is not null and btrim(m.league_name) <> ''
  )
  select jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'league_name', p.league_name,
          'home_team_name', p.home_team_name,
          'away_team_name', p.away_team_name,
          'home_club_id', p.home_club_id,
          'away_club_id', p.away_club_id,
          'match_date', p.match_date,
          'status', p.status,
          'home_score', p.home_score,
          'away_score', p.away_score,
          'external_id', p.external_id,
          'league_code', p.league_code,
          'matchday', p.matchday,
          'season', p.season
        ) order by p.sort_status, p.sort_stale, p.sort_upcoming asc nulls last, p.sort_recent desc nulls last, p.id desc
      )
      from page p
    ), '[]'::jsonb),
    'total', totals.total,
    'has_more', normalized_offset + (select count(*) from page) < totals.total,
    'next_offset', normalized_offset + (select count(*) from page),
    'leagues', coalesce((select jsonb_agg(l.league_name order by l.league_name) from league_values l), '[]'::jsonb)
  )
  into result
  from totals;

  return result;
end
$function$;

revoke all on function public.get_matches_page(text, text, text, integer, integer) from public;
grant execute on function public.get_matches_page(text, text, text, integer, integer) to anon, authenticated;
