-- Additive reader: date/favorite filters are applied before count and pagination.
-- Invoker rights preserve matches RLS and owner-only favorite_clubs visibility.
create index if not exists matches_calendar_date_idx on public.matches(match_date,id);

create or replace function public.get_match_calendar_page(
  p_filters jsonb default '{}'::jsonb, p_limit integer default 24, p_offset integer default 0
) returns jsonb language plpgsql stable security invoker set search_path='' as $function$
declare
  f jsonb := coalesce(p_filters,'{}'::jsonb);
  s text; l text; q text;
  from_time timestamptz; until_time timestamptz;
  favorites boolean := false;
  club_ids bigint[] := '{}'::bigint[];
  page_size integer := least(greatest(coalesce(p_limit,24),1),48);
  page_offset integer := least(greatest(coalesce(p_offset,0),0),10000);
  result jsonb;
begin
  if jsonb_typeof(f)<>'object' then
    raise exception using errcode='22023',message='invalid_calendar_filters';
  end if;
  if exists(select 1 from jsonb_object_keys(f) k where k not in ('status','league','query','from','until','favorites_only'))
    or exists(select 1 from jsonb_each(f) e where e.key<>'favorites_only' and jsonb_typeof(e.value) not in ('string','null'))
    or (f ? 'favorites_only' and jsonb_typeof(f->'favorites_only')<>'boolean') then
    raise exception using errcode='22023',message='invalid_calendar_filters';
  end if;
  s := lower(btrim(coalesce(f->>'status','all')));
  l := nullif(left(btrim(coalesce(f->>'league','')),120),'');
  q := left(lower(btrim(coalesce(f->>'query',''))),80);
  if s not in ('all','live','scheduled','finished','postponed','cancelled') then
    raise exception using errcode='22023',message='invalid_match_status';
  end if;
  if l='all' then l:=null; end if;
  favorites := coalesce((f->>'favorites_only')::boolean,false);
  if (nullif(f->>'from','') is null)<>(nullif(f->>'until','') is null) then
    raise exception using errcode='22023',message='invalid_calendar_range';
  end if;
  if nullif(f->>'from','') is not null then
    if f->>'from' !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$'
      or f->>'until' !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$' then
      raise exception using errcode='22023',message='invalid_calendar_range';
    end if;
    begin
      from_time := (f->>'from')::timestamptz;
      until_time := (f->>'until')::timestamptz;
    exception when others then
      raise exception using errcode='22023',message='invalid_calendar_range';
    end;
    if not isfinite(from_time) or not isfinite(until_time) or until_time<=from_time
      or until_time-from_time>interval '26 hours' then
      raise exception using errcode='22023',message='invalid_calendar_range';
    end if;
  end if;
  if favorites then
    if (select auth.uid()) is null then
      raise exception using errcode='42501',message='authentication_required';
    end if;
    -- Keep this statement conditional: anon has no SELECT on favorite_clubs.
    select coalesce(array_agg(fc.club_id),'{}'::bigint[]) into club_ids
    from public.favorite_clubs fc where fc.user_id=(select auth.uid());
  end if;
  with filtered as materialized (
    select m.id,m.competition_id,m.league_name,m.home_team_name,m.away_team_name,
      m.home_club_id,m.away_club_id,m.match_date,m.status,m.home_score,m.away_score,
      m.external_id,m.league_code,m.matchday,m.season,
      case m.status when 'live' then 0 when 'scheduled' then 1 when 'finished' then 2 else 3 end sort_status,
      case when m.status='scheduled' and m.match_date<current_timestamp then 1 else 0 end sort_stale,
      case when from_time is not null or (m.status in ('live','scheduled') and m.match_date>=current_timestamp) then m.match_date end sort_upcoming,
      case when from_time is null and (m.status='finished' or (m.status='scheduled' and m.match_date<current_timestamp)) then m.match_date end sort_recent
    from public.matches m
    where (s='all' or m.status=s) and (l is null or m.league_name=l)
      and (from_time is null or (m.match_date>=from_time and m.match_date<until_time))
      and (not favorites or m.home_club_id=any(club_ids) or m.away_club_id=any(club_ids))
      and (q='' or lower(m.home_team_name) like '%'||q||'%' or lower(m.away_team_name) like '%'||q||'%'
        or lower(m.league_name) like '%'||q||'%'
        or exists(select 1 from public.club_aliases ca where ca.club_id in (m.home_club_id,m.away_club_id)
          and position(replace(q,'ё','е') in replace(lower(ca.alias),'ё','е'))>0)
        or exists(select 1 from public.competitions cp where cp.id=m.competition_id
          and position(q in case cp.code when 'CL' then 'лига чемпионов' when 'PL' then 'апл английская премьер-лига'
            when 'PD' then 'ла лига' when 'BL1' then 'бундеслига' when 'SA' then 'серия а' when 'FL1' then 'лига 1'
            when 'EL' then 'лига европы' else '' end)>0))
  ), page as materialized (
    select * from filtered order by sort_status,sort_stale,sort_upcoming asc nulls last,sort_recent desc nulls last,id desc
    limit page_size offset page_offset
  ), totals as (select count(*)::integer total from filtered),
  leagues as (select distinct m.league_name from public.matches m where nullif(btrim(m.league_name),'') is not null)
  select jsonb_build_object(
    'items',coalesce((select jsonb_agg(jsonb_build_object(
      'id',p.id,'competition_id',p.competition_id,'league_name',p.league_name,
      'home_team_name',p.home_team_name,'away_team_name',p.away_team_name,
      'home_club_id',p.home_club_id,'away_club_id',p.away_club_id,
      'match_date',p.match_date,'status',p.status,'home_score',p.home_score,'away_score',p.away_score,
      'external_id',p.external_id,'league_code',p.league_code,'matchday',p.matchday,'season',p.season
    ) order by p.sort_status,p.sort_stale,p.sort_upcoming asc nulls last,p.sort_recent desc nulls last,p.id desc) from page p),'[]'::jsonb),
    'total',totals.total,'has_more',page_offset+(select count(*) from page)<totals.total,
    'next_offset',page_offset+(select count(*) from page),
    'leagues',coalesce((select jsonb_agg(l.league_name order by l.league_name) from leagues l),'[]'::jsonb),
    'favorite_club_count',case when favorites then cardinality(club_ids) else null end
  ) into result from totals;
  return result;
end $function$;
revoke all on function public.get_match_calendar_page(jsonb,integer,integer) from public;
grant execute on function public.get_match_calendar_page(jsonb,integer,integer) to anon,authenticated,service_role;
comment on function public.get_match_calendar_page(jsonb,integer,integer) is
  'Day bounds use an exclusive upper bound and the viewer timezone; favorites are resolved from auth.uid(), never from client owner IDs.';
