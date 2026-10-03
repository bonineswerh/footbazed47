-- Public football aggregates must not depend on the viewer's private votes or
-- future personal block policies. Raw rows remain inaccessible to clients.
-- Existing individual history/readers retain their own RLS and owner scope.
create view private.community_public_match_votes with (security_barrier=true) as
  select r.id,r.user_id,r.match_id,r.match_rating,r.is_public,r.supporter_side
  from public.ratings r where r.is_public;
create view private.community_public_player_votes with (security_barrier=true) as
  select pr.user_id,pr.match_id,pr.player_id,pr.rating,pr.is_best_player
  from public.player_ratings pr
  join private.community_public_match_votes r on r.user_id=pr.user_id and r.match_id=pr.match_id;
revoke all on private.community_public_match_votes,private.community_public_player_votes from public,anon,authenticated,service_role;
comment on view private.community_public_match_votes is 'Internal public vote scope for aggregate-only RPC. No raw votes, authors or reviews are granted to clients.';
comment on view private.community_public_player_votes is 'Internal player vote scope: only votes with a public parent match rating. Owner-private/orphan votes never enter community aggregates.';

CREATE OR REPLACE FUNCTION public.get_club_page(p_club_id bigint)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
      'player_rating', (select round(avg(pr.rating)::numeric, 1) from private.community_public_player_votes pr join public.players p on p.id = pr.player_id where p.club_id = c.id),
      'player_rating_count', (select count(*)::integer from private.community_public_player_votes pr join public.players p on p.id = pr.player_id where p.club_id = c.id)
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
      left join public.media_assets pma on pma.id = p.photo_asset_id and public.is_displayable_media_asset(pma)
      left join lateral (
        select round(avg(pr.rating)::numeric, 1) as average, count(*)::integer as rating_count,
               count(*) filter (where pr.is_best_player)::integer as best_votes
        from private.community_public_player_votes pr where pr.player_id = p.id
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
  left join public.media_assets ma on ma.id = c.logo_asset_id and public.is_displayable_media_asset(ma)
  where c.id = p_club_id;
$function$;


CREATE OR REPLACE FUNCTION public.get_football_statistics(p_kind text DEFAULT 'matches'::text, p_filters jsonb DEFAULT '{}'::jsonb, p_offset integer DEFAULT 0, p_limit integer DEFAULT 12)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  f jsonb := coalesce(p_filters,'{}'::jsonb);
  q text := left(btrim(coalesce(f->>'query','')),80);
  league text := left(coalesce(f->>'league',''),120);
  team text := left(coalesce(f->>'team',''),160);
  competition_id_filter bigint;
  club_id_filter bigint;
  from_day date := nullif(f->>'from','')::date;
  to_day date := nullif(f->>'to','')::date;
  min_votes integer := coalesce(nullif(f->>'min_votes','')::integer,1);
  ordering text := coalesce(nullif(f->>'sort',''),'average');
  page_size integer := least(greatest(coalesce(p_limit,12),1),24);
  page_offset integer := greatest(coalesce(p_offset,0),0);
  result jsonb;
begin
  if (nullif(f->>'competition_id','') is not null and f->>'competition_id' !~ '^[1-9][0-9]{0,14}$')
     or (nullif(f->>'club_id','') is not null and f->>'club_id' !~ '^[1-9][0-9]{0,14}$') then
    raise exception using errcode='22023',message='invalid_statistics_filters';
  end if;
  competition_id_filter := nullif(f->>'competition_id','')::bigint;
  club_id_filter := nullif(f->>'club_id','')::bigint;
  if p_kind not in ('matches','clubs','players','leagues') or jsonb_typeof(f)<>'object'
     or min_votes not between 1 and 1000000 or from_day>to_day
     or ordering not in ('average','votes','recent') or page_offset>100000 then
    raise exception using errcode='22023',message='invalid_statistics_filters';
  end if;
  with base as materialized (
    select r.id,r.user_id,r.match_id,r.match_rating,m.home_team_name,m.away_team_name,
      m.home_club_id,m.away_club_id,m.competition_id,m.league_name,m.match_date,m.home_score,m.away_score
    from private.community_public_match_votes r join public.users u on u.id=r.user_id join public.matches m on m.id=r.match_id
    where r.is_public and u.is_public and m.status='finished'
      and (competition_id_filter is null or m.competition_id=competition_id_filter)
      and (club_id_filter is null or club_id_filter in (m.home_club_id,m.away_club_id))
      and (competition_id_filter is not null or league='' or m.league_name=league)
      and (club_id_filter is not null or team='' or team in (m.home_team_name,m.away_team_name))
      and (from_day is null or m.match_date>=from_day::timestamp at time zone 'UTC')
      and (to_day is null or m.match_date<(to_day+1)::timestamp at time zone 'UTC')
  ), entries as (
    select b.match_id::text entity_key,b.match_id entity_id,
      b.home_team_name||' — '||b.away_team_name title,b.league_name subtitle,
      b.match_rating::numeric score,b.user_id,b.match_id,b.match_date,
      b.home_score,b.away_score
    from base b where p_kind='matches'
    union all
    select coalesce(b.competition_id::text,'legacy:'||b.league_name),b.competition_id,b.league_name,'Турнир',
      b.match_rating,b.user_id,b.match_id,b.match_date,null::smallint,null::smallint
    from base b where p_kind='leagues'
    union all
    select coalesce(c.id::text,t.name),c.id,coalesce(c.short_name,c.name,t.name),'Матчи клуба',
      b.match_rating,b.user_id,b.match_id,b.match_date,null::smallint,null::smallint
    from base b cross join lateral (values (b.home_club_id,b.home_team_name),(b.away_club_id,b.away_team_name)) t(id,name)
    left join public.clubs c on c.id=t.id where p_kind='clubs'
    union all
    select p.id::text,p.id,p.name,p.team,pr.rating,b.user_id,b.match_id,b.match_date,null::smallint,null::smallint
    from base b join private.community_public_player_votes pr on pr.match_id=b.match_id and pr.user_id=b.user_id
    join public.players p on p.id=pr.player_id where p_kind='players'
  ), grouped as materialized (
    select e.entity_key,min(e.entity_id) entity_id,min(e.title) title,min(e.subtitle) subtitle,
      round(avg(e.score),1) average,count(*) votes,count(distinct e.user_id) voters,
      count(distinct e.match_id) matches,max(e.match_date) latest,
      max(e.home_score) home_score,max(e.away_score) away_score
    from entries e where q='' or position(lower(q) in lower(e.title||' '||coalesce(e.subtitle,'')))>0
    group by e.entity_key having count(*)>=min_votes
  ), selected_votes as materialized (
    select distinct e.match_id,e.user_id from entries e join grouped g using(entity_key)
  ), ranked as (
    select g.*,row_number() over(order by
      case when ordering='average' then g.average end desc,
      case when ordering='votes' then g.votes end desc,
      case when ordering='recent' then g.latest end desc,
      g.votes desc,g.average desc,g.entity_key) rank from grouped g
  ), page as (select * from ranked order by rank limit page_size offset page_offset),
  enriched as (
    select p.*,
      m.home_club_id,m.away_club_id,m.home_team_name,m.away_team_name,
      case when ma.id is null then null else jsonb_build_object(
        'id',ma.id,'asset_type',ma.asset_type,'url',coalesce(ma.storage_url,ma.source_url),
        'source_provider',ma.source_provider,'license_name',ma.license_name,'license_url',ma.license_url,
        'attribution',ma.attribution,'usage_status',ma.usage_status) end media
    from page p
    left join public.matches m on p_kind='matches' and m.id=p.entity_id
    left join public.clubs c on p_kind='clubs' and c.id=p.entity_id
    left join public.players pl on p_kind='players' and pl.id=p.entity_id
    left join public.competitions cp on p_kind='leagues' and cp.id=p.entity_id
    left join public.media_assets ma on ma.id=case p_kind when 'clubs' then c.logo_asset_id
      when 'players' then pl.photo_asset_id when 'leagues' then cp.logo_asset_id end
      and public.is_displayable_media_asset(ma)
  )
  select jsonb_build_object(
    'items',coalesce((select jsonb_agg(to_jsonb(p) order by p.rank) from enriched p),'[]'::jsonb),
    'total',(select count(*) from grouped),
    'has_more',(select count(*)>page_offset+page_size from grouped),
    'next_offset',page_offset+page_size,
    'competitions',coalesce((select jsonb_agg(to_jsonb(x) order by x.name,x.id) from (
      select distinct cp.id,coalesce(cp.short_name,cp.name) name from public.matches m
      join public.competitions cp on cp.id=m.competition_id order by name,cp.id limit 200) x),'[]'::jsonb),
    'clubs',coalesce((select jsonb_agg(to_jsonb(x) order by x.name,x.id) from (
      select c.id,coalesce(c.short_name,c.name) name,array_agg(distinct m.competition_id) filter(where m.competition_id is not null) competition_ids
      from public.matches m cross join lateral (values(m.home_club_id),(m.away_club_id)) t(id)
      join public.clubs c on c.id=t.id group by c.id order by name,c.id limit 1000) x),'[]'::jsonb),
    'summary',jsonb_build_object('matches',(select count(distinct match_id) from selected_votes),'votes',(select count(*) from selected_votes),'voters',(select count(distinct user_id) from selected_votes)),
    'leagues',coalesce((select jsonb_agg(x.league_name order by x.league_name) from (select distinct league_name from public.matches limit 200) x),'[]'::jsonb),
    'teams',coalesce((select jsonb_agg(x.name order by x.name) from (select home_team_name name from public.matches union select away_team_name from public.matches limit 1000) x),'[]'::jsonb)
  ) into result;
  return result;
end $function$;


CREATE OR REPLACE FUNCTION public.get_match_insights(p_match_id bigint)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
        'count', (select count(*)::integer from private.community_public_match_votes rd
          where rd.match_id = p_match_id and rd.is_public = true
            and rd.match_rating = scores.score
            and (s.segment_key = 'all' or rd.supporter_side = s.segment_key))
        ) order by scores.score desc) from score_values scores) as distribution,
      s.position
    from segment_names s
    left join private.community_public_match_votes r on r.match_id = p_match_id and r.is_public = true
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
    from private.community_public_player_votes pr
    join private.community_public_match_votes r on r.user_id = pr.user_id and r.match_id = pr.match_id and r.is_public = true
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


CREATE OR REPLACE FUNCTION public.get_player_page(p_player_id bigint)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'player', jsonb_build_object(
      'id', p.id, 'name', p.name, 'position', p.position, 'shirt_number', p.shirt_number, 'team', p.team,
      'media', case when pma.id is null then null else jsonb_build_object(
        'id', pma.id, 'asset_type', pma.asset_type, 'url', coalesce(pma.storage_url, pma.source_url),
        'source_provider', pma.source_provider, 'license_name', pma.license_name,
        'license_url', pma.license_url, 'attribution', pma.attribution, 'usage_status', pma.usage_status
      ) end,
      'club', case when c.id is null then null else jsonb_build_object(
        'id', c.id, 'name', c.name, 'short_name', c.short_name, 'tla', c.tla,
        'primary_color', c.primary_color, 'secondary_color', c.secondary_color,
        'media', case when cma.id is null then null else jsonb_build_object(
          'id', cma.id, 'asset_type', cma.asset_type, 'url', coalesce(cma.storage_url, cma.source_url),
          'source_provider', cma.source_provider, 'license_name', cma.license_name,
          'license_url', cma.license_url, 'attribution', cma.attribution, 'usage_status', cma.usage_status
        ) end
      ) end
    ),
    'stats', jsonb_build_object(
      'average', ps.average, 'rating_count', coalesce(ps.rating_count, 0),
      'best_votes', coalesce(ps.best_votes, 0), 'matches_rated', coalesce(ps.matches_rated, 0)
    ),
    'performances', coalesce((
      select jsonb_agg(jsonb_build_object(
        'match_id', x.match_id, 'average', x.average, 'rating_count', x.rating_count, 'best_votes', x.best_votes,
        'competition_id', x.competition_id, 'league_name', x.league_name, 'home_team_name', x.home_team_name,
        'away_team_name', x.away_team_name, 'match_date', x.match_date, 'home_score', x.home_score, 'away_score', x.away_score
      ) order by x.match_date desc)
      from (
        select pr.match_id, round(avg(pr.rating)::numeric, 1) as average, count(*)::integer as rating_count,
               count(*) filter (where pr.is_best_player)::integer as best_votes,
               m.competition_id, m.league_name, m.home_team_name, m.away_team_name, m.match_date, m.home_score, m.away_score
        from private.community_public_player_votes pr join public.matches m on m.id = pr.match_id
        where pr.player_id = p.id
        group by pr.match_id, m.competition_id, m.league_name, m.home_team_name, m.away_team_name, m.match_date, m.home_score, m.away_score
        order by m.match_date desc limit 20
      ) x
    ), '[]'::jsonb),
    'teammates', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'name', t.name, 'position', t.position, 'shirt_number', t.shirt_number,
        'media', case when tma.id is null then null else jsonb_build_object(
          'id', tma.id, 'asset_type', tma.asset_type, 'url', coalesce(tma.storage_url, tma.source_url),
          'source_provider', tma.source_provider, 'license_name', tma.license_name,
          'license_url', tma.license_url, 'attribution', tma.attribution, 'usage_status', tma.usage_status
        ) end
      ) order by t.name)
      from (
        select teammate.* from public.players teammate
        where teammate.club_id = p.club_id and teammate.id <> p.id
        order by teammate.name limit 16
      ) t
      left join public.media_assets tma on tma.id = t.photo_asset_id and public.is_displayable_media_asset(tma)
    ), '[]'::jsonb)
  )
  from public.players p
  left join public.clubs c on c.id = p.club_id
  left join public.media_assets pma on pma.id = p.photo_asset_id and public.is_displayable_media_asset(pma)
  left join public.media_assets cma on cma.id = c.logo_asset_id and public.is_displayable_media_asset(cma)
  left join lateral (
    select round(avg(pr.rating)::numeric, 1) as average, count(*)::integer as rating_count,
           count(*) filter (where pr.is_best_player)::integer as best_votes,
           count(distinct pr.match_id)::integer as matches_rated
    from private.community_public_player_votes pr where pr.player_id = p.id
  ) ps on true
  where p.id = p_player_id;
$function$;


-- Existing public signatures remain unchanged; each returns aggregates/catalogue
-- and an explicitly auth-scoped favorite flag, never raw private reviews/authors.
revoke all on function public.get_club_page(bigint),public.get_player_page(bigint),public.get_football_statistics(text,jsonb,integer,integer),public.get_match_insights(bigint) from public,anon,authenticated,service_role;
grant execute on function public.get_club_page(bigint),public.get_player_page(bigint),public.get_football_statistics(text,jsonb,integer,integer),public.get_match_insights(bigint) to anon,authenticated,service_role;
notify pgrst,'reload schema';
