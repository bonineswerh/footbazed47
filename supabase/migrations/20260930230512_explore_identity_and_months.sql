-- Compatible read-only upgrade: v2 uses stable internal IDs and match-date diary cursors.
-- Old clients retain name filters and creation-date cursors; no user data is rewritten.
create or replace function public.get_profile_diary(
  p_user_id uuid, p_filters jsonb default '{}'::jsonb,
  p_cursor jsonb default null, p_limit integer default 8
) returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  f jsonb := coalesce(p_filters, '{}'::jsonb);
  q text := left(btrim(coalesce(f->>'query','')),80);
  league text := left(coalesce(f->>'league',''),120);
  team text := left(coalesce(f->>'team',''),160);
  competition_id_filter bigint;
  club_id_filter bigint;
  from_day date := nullif(f->>'from','')::date;
  to_day date := nullif(f->>'to','')::date;
  min_rating integer := coalesce(nullif(f->>'min_rating','')::integer,1);
  max_rating integer := coalesce(nullif(f->>'max_rating','')::integer,10);
  home_goals integer := nullif(f->>'home_score','')::integer;
  away_goals integer := nullif(f->>'away_score','')::integer;
  version_two boolean := coalesce(f->>'v','')='2';
  cursor_time timestamptz := (case when version_two then p_cursor->>'match_date' else p_cursor->>'created_at' end)::timestamptz;
  cursor_id bigint := (p_cursor->>'id')::bigint;
  page_size integer := least(greatest(coalesce(p_limit,8),1),24);
  result jsonb;
begin
  if (nullif(f->>'competition_id','') is not null and f->>'competition_id' !~ '^[1-9][0-9]{0,14}$')
     or (nullif(f->>'club_id','') is not null and f->>'club_id' !~ '^[1-9][0-9]{0,14}$') then
    raise exception using errcode='22023',message='invalid_diary_filters';
  end if;
  competition_id_filter := nullif(f->>'competition_id','')::bigint;
  club_id_filter := nullif(f->>'club_id','')::bigint;
  if p_user_id is null or jsonb_typeof(f)<>'object'
     or min_rating not between 1 and 10 or max_rating not between min_rating and 10
     or from_day>to_day or home_goals not between 0 and 99 or away_goals not between 0 and 99
     or (cursor_time is null)<>(cursor_id is null) then
    raise exception using errcode='22023',message='invalid_diary_filters';
  end if;
  if not exists(select 1 from public.users u where u.id=p_user_id) then
    return null;
  end if;
  with visible as materialized (
    select r.id,r.user_id,r.match_id,r.match_rating,r.is_public,r.created_at,
      m.home_team_name,m.away_team_name,m.league_name,m.match_date,m.home_score,m.away_score,
      m.competition_id,m.home_club_id,m.away_club_id,btrim(coalesce(r.comment,''))<>'' has_review
    from public.ratings r join public.matches m on m.id=r.match_id
    where r.user_id=p_user_id and (r.is_public or r.user_id=(select auth.uid()))
  ), filtered as materialized (
    select * from visible v
    where (q='' or position(lower(q) in lower(v.home_team_name||' '||v.away_team_name))>0)
      and (competition_id_filter is null or v.competition_id=competition_id_filter)
      and (club_id_filter is null or club_id_filter in (v.home_club_id,v.away_club_id))
      and (competition_id_filter is not null or league='' or v.league_name=league)
      and (club_id_filter is not null or team='' or team in (v.home_team_name,v.away_team_name))
      and v.match_rating between min_rating and max_rating
      and (from_day is null or v.match_date>=from_day::timestamp at time zone 'UTC')
      and (to_day is null or v.match_date<(to_day+1)::timestamp at time zone 'UTC')
      and (home_goals is null or v.home_score=home_goals)
      and (away_goals is null or v.away_score=away_goals)
  ), page_plus as materialized (
    select * from filtered v
    where cursor_time is null or ((case when version_two then v.match_date else v.created_at end),v.id)<(cursor_time,cursor_id)
    order by (case when version_two then v.match_date else v.created_at end) desc,v.id desc limit page_size+1
  ), page as materialized (
    select * from page_plus order by (case when version_two then match_date else created_at end) desc,id desc limit page_size
  )
  select jsonb_build_object(
    'items',coalesce((select jsonb_agg(to_jsonb(p) order by (case when version_two then p.match_date else p.created_at end) desc,p.id desc) from page p),'[]'::jsonb),
    'total',(select count(*) from filtered),
    'has_more',(select count(*)>page_size from page_plus),
    'next_cursor',(select jsonb_build_object(case when version_two then 'match_date' else 'created_at' end,
      case when version_two then match_date else created_at end,'id',id) from page
      order by (case when version_two then match_date else created_at end),id limit 1),
    'months',coalesce((select jsonb_agg(to_jsonb(x) order by x.month desc) from (
      select to_char(v.match_date at time zone 'UTC','YYYY-MM') month,count(*) matches,
        round(avg(v.match_rating),1) average,count(*) filter(where v.has_review) reviews
      from filtered v where to_char(v.match_date at time zone 'UTC','YYYY-MM') in
        (select to_char(p.match_date at time zone 'UTC','YYYY-MM') from page p)
      group by 1) x),'[]'::jsonb),
    'competitions',coalesce((select jsonb_agg(to_jsonb(x) order by x.name,x.id) from (
      select distinct cp.id,coalesce(cp.short_name,cp.name) name from visible v
      join public.competitions cp on cp.id=v.competition_id order by name,cp.id limit 200) x),'[]'::jsonb),
    'clubs',coalesce((select jsonb_agg(to_jsonb(x) order by x.name,x.id) from (
      select c.id,coalesce(c.short_name,c.name) name,array_agg(distinct v.competition_id) filter(where v.competition_id is not null) competition_ids
      from visible v cross join lateral (values(v.home_club_id),(v.away_club_id)) t(id)
      join public.clubs c on c.id=t.id group by c.id order by name,c.id limit 1000) x),'[]'::jsonb),
    'leagues',coalesce((select jsonb_agg(x.league_name order by x.league_name) from (select distinct league_name from visible limit 200) x),'[]'::jsonb),
    'teams',coalesce((select jsonb_agg(x.name order by x.name) from (select home_team_name name from visible union select away_team_name from visible limit 1000) x),'[]'::jsonb)
  ) into result;
  return result;
end $$;

create or replace function public.get_football_statistics(
  p_kind text default 'matches', p_filters jsonb default '{}'::jsonb,
  p_offset integer default 0,p_limit integer default 12
) returns jsonb language plpgsql stable security invoker set search_path = '' as $$
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
    from public.ratings r join public.users u on u.id=r.user_id join public.matches m on m.id=r.match_id
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
    from base b join public.player_ratings pr on pr.match_id=b.match_id and pr.user_id=b.user_id
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
end $$;

revoke all on function public.get_profile_diary(uuid,jsonb,jsonb,integer) from public;
revoke all on function public.get_football_statistics(text,jsonb,integer,integer) from public;
grant execute on function public.get_profile_diary(uuid,jsonb,jsonb,integer) to anon,authenticated;
grant execute on function public.get_football_statistics(text,jsonb,integer,integer) to anon,authenticated;
notify pgrst,'reload schema';
