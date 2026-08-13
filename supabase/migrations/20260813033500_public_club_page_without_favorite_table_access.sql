create or replace function public.is_my_favorite_club(p_club_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.favorite_clubs fc
    where fc.user_id = (select auth.uid())
      and fc.club_id = p_club_id
  );
$function$;

create or replace function public.get_club_page(p_club_id bigint)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  select jsonb_build_object(
    'club', jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'short_name', c.short_name,
      'tla', c.tla,
      'area_name', c.area_name,
      'venue', c.venue,
      'founded', c.founded,
      'club_colors', c.club_colors,
      'primary_color', c.primary_color,
      'secondary_color', c.secondary_color,
      'media', case when ma.id is null then null else jsonb_build_object(
        'id', ma.id, 'asset_type', ma.asset_type, 'url', coalesce(ma.storage_url, ma.source_url),
        'source_provider', ma.source_provider, 'license_name', ma.license_name,
        'license_url', ma.license_url, 'attribution', ma.attribution, 'usage_status', ma.usage_status
      ) end
    ),
    'is_favorite', public.is_my_favorite_club(c.id),
    'competitions', coalesce((
      select jsonb_agg(jsonb_build_object('id', cp.id, 'name', cp.name, 'code', cp.code) order by cp.name)
      from public.club_competitions cc
      join public.competitions cp on cp.id = cc.competition_id
      where cc.club_id = c.id
    ), '[]'::jsonb),
    'stats', jsonb_build_object(
      'squad_count', (select count(*)::integer from public.players p where p.club_id = c.id),
      'match_count', (select count(*)::integer from public.matches m where m.home_club_id = c.id or m.away_club_id = c.id),
      'upcoming_count', (select count(*)::integer from public.matches m where (m.home_club_id = c.id or m.away_club_id = c.id) and m.status = 'scheduled'),
      'player_rating', (select round(avg(pr.rating)::numeric, 1) from public.player_ratings pr join public.players p on p.id = pr.player_id where p.club_id = c.id),
      'player_rating_count', (select count(*)::integer from public.player_ratings pr join public.players p on p.id = pr.player_id where p.club_id = c.id)
    ),
    'squad', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'position', p.position, 'shirt_number', p.shirt_number,
        'media', case when pma.id is null then null else jsonb_build_object(
          'id', pma.id, 'asset_type', pma.asset_type, 'url', coalesce(pma.storage_url, pma.source_url),
          'source_provider', pma.source_provider, 'license_name', pma.license_name,
          'license_url', pma.license_url, 'attribution', pma.attribution, 'usage_status', pma.usage_status
        ) end,
        'average', ps.average, 'rating_count', coalesce(ps.rating_count, 0), 'best_votes', coalesce(ps.best_votes, 0)
      ) order by p.name)
      from public.players p
      left join public.media_assets pma on pma.id = p.photo_asset_id and pma.usage_status = 'verified'
      left join lateral (
        select round(avg(pr.rating)::numeric, 1) as average, count(*)::integer as rating_count,
               count(*) filter (where pr.is_best_player)::integer as best_votes
        from public.player_ratings pr where pr.player_id = p.id
      ) ps on true
      where p.club_id = c.id
    ), '[]'::jsonb),
    'matches', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', x.id, 'competition_id', x.competition_id, 'league_name', x.league_name,
        'home_team_name', x.home_team_name, 'away_team_name', x.away_team_name,
        'home_club_id', x.home_club_id, 'away_club_id', x.away_club_id,
        'match_date', x.match_date, 'status', x.status, 'home_score', x.home_score, 'away_score', x.away_score
      ) order by x.match_date desc)
      from (
        select m.* from public.matches m
        where m.home_club_id = c.id or m.away_club_id = c.id
        order by case m.status when 'live' then 1 when 'scheduled' then 2 else 3 end,
                 case when m.status = 'finished' then null else m.match_date end asc, m.match_date desc
        limit 24
      ) x
    ), '[]'::jsonb)
  )
  from public.clubs c
  left join public.media_assets ma on ma.id = c.logo_asset_id and ma.usage_status = 'verified'
  where c.id = p_club_id;
$function$;

revoke all on function public.get_club_page(bigint) from public;
revoke all on function public.is_my_favorite_club(bigint) from public;
grant execute on function public.get_club_page(bigint) to anon, authenticated;
grant execute on function public.is_my_favorite_club(bigint) to anon, authenticated;

notify pgrst, 'reload schema';
