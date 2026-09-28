-- Additive read APIs. They retain table RLS and never include private ratings
-- in community statistics, even for their author.
create index if not exists ratings_user_created_id_idx
  on public.ratings(user_id, created_at desc, id desc);

create or replace function public.get_profile_diary(
  p_user_id uuid, p_filters jsonb default '{}'::jsonb,
  p_cursor jsonb default null, p_limit integer default 8
) returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  f jsonb := coalesce(p_filters, '{}'::jsonb);
  q text := left(btrim(coalesce(f->>'query','')),80);
  league text := left(coalesce(f->>'league',''),120);
  team text := left(coalesce(f->>'team',''),160);
  from_day date := nullif(f->>'from','')::date;
  to_day date := nullif(f->>'to','')::date;
  min_rating integer := coalesce(nullif(f->>'min_rating','')::integer,1);
  max_rating integer := coalesce(nullif(f->>'max_rating','')::integer,10);
  home_goals integer := nullif(f->>'home_score','')::integer;
  away_goals integer := nullif(f->>'away_score','')::integer;
  cursor_time timestamptz := (p_cursor->>'created_at')::timestamptz;
  cursor_id bigint := (p_cursor->>'id')::bigint;
  page_size integer := least(greatest(coalesce(p_limit,8),1),24);
  result jsonb;
begin
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
      m.home_team_name,m.away_team_name,m.league_name,m.match_date,m.home_score,m.away_score
    from public.ratings r join public.matches m on m.id=r.match_id
    where r.user_id=p_user_id and (r.is_public or r.user_id=(select auth.uid()))
  ), filtered as materialized (
    select * from visible v
    where (q='' or position(lower(q) in lower(v.home_team_name||' '||v.away_team_name))>0)
      and (league='' or v.league_name=league)
      and (team='' or team in (v.home_team_name,v.away_team_name))
      and v.match_rating between min_rating and max_rating
      and (from_day is null or v.match_date>=from_day::timestamp at time zone 'UTC')
      and (to_day is null or v.match_date<(to_day+1)::timestamp at time zone 'UTC')
      and (home_goals is null or v.home_score=home_goals)
      and (away_goals is null or v.away_score=away_goals)
  ), page_plus as materialized (
    select * from filtered v
    where cursor_time is null or (v.created_at,v.id)<(cursor_time,cursor_id)
    order by v.created_at desc,v.id desc limit page_size+1
  ), page as materialized (
    select * from page_plus order by created_at desc,id desc limit page_size
  )
  select jsonb_build_object(
    'items',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc,p.id desc) from page p),'[]'::jsonb),
    'total',(select count(*) from filtered),
    'has_more',(select count(*)>page_size from page_plus),
    'next_cursor',(select jsonb_build_object('created_at',created_at,'id',id) from page order by created_at,id limit 1),
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
  from_day date := nullif(f->>'from','')::date;
  to_day date := nullif(f->>'to','')::date;
  min_votes integer := coalesce(nullif(f->>'min_votes','')::integer,1);
  ordering text := coalesce(nullif(f->>'sort',''),'average');
  page_size integer := least(greatest(coalesce(p_limit,12),1),24);
  page_offset integer := greatest(coalesce(p_offset,0),0);
  result jsonb;
begin
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
      and (league='' or m.league_name=league)
      and (team='' or team in (m.home_team_name,m.away_team_name))
      and (from_day is null or m.match_date>=from_day::timestamp at time zone 'UTC')
      and (to_day is null or m.match_date<(to_day+1)::timestamp at time zone 'UTC')
  ), entries as (
    select b.match_id::text entity_key,b.match_id entity_id,
      b.home_team_name||' — '||b.away_team_name title,b.league_name subtitle,
      b.match_rating::numeric score,b.user_id,b.match_id,b.match_date,
      b.home_score,b.away_score
    from base b where p_kind='matches'
    union all
    select b.league_name,min(b.competition_id) over(partition by b.league_name),b.league_name,'Турнир',
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
  ), page as (select * from ranked order by rank limit page_size offset page_offset)
  select jsonb_build_object(
    'items',coalesce((select jsonb_agg(to_jsonb(p) order by p.rank) from page p),'[]'::jsonb),
    'total',(select count(*) from grouped),
    'has_more',(select count(*)>page_offset+page_size from grouped),
    'next_offset',page_offset+page_size,
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
