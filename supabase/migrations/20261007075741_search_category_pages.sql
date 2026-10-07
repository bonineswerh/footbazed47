-- Additive category search: old preview readers remain unchanged.
-- Caller RLS, category before limit, deterministic keyset and bounded enrichment.
create function public.search_footbazed_page(
  p_query text, p_kind text, p_cursor jsonb default null, p_limit integer default 14
) returns jsonb language plpgsql stable security invoker set search_path='' as $function$
declare
  v_query text:=replace(lower(regexp_replace(btrim(coalesce(p_query,'')),'\s+',' ','g')),'ё','е');
begin
  if p_kind is null or p_kind not in ('club','player','competition','match','user') then
    raise exception 'Unsupported search category' using errcode='22023';
  end if;
  if char_length(v_query)<2 or char_length(v_query)>80 then
    return jsonb_build_object('items','[]'::jsonb,'next_cursor',null);
  end if;
  if p_cursor is not null and (
    jsonb_typeof(p_cursor) is distinct from 'object' or
    (p_cursor->>'query') is distinct from v_query or
    (p_cursor->>'kind') is distinct from p_kind or
    jsonb_typeof(p_cursor->'relevance') is distinct from 'number' or
    jsonb_typeof(p_cursor->'title') is distinct from 'string' or
    jsonb_typeof(p_cursor->'id') is distinct from 'string' or
    char_length(p_cursor->>'title')>1000 or char_length(p_cursor->>'id')>64
  ) then raise exception 'Invalid search cursor' using errcode='22023'; end if;
  return (
  with input as (
    select v_query as query, p_kind as kind, least(greatest(coalesce(p_limit,14),1),24) as result_limit
  ), club_results as (
    select distinct on (c.id) 'club'::text entity_type, c.id::text entity_id, c.name title,
      coalesce(nullif(c.area_name, ''), 'Клуб') subtitle, c.tla meta,
      greatest(case when replace(lower(c.name),'ё','е')=i.query or replace(lower(ca.alias),'ё','е')=i.query then 1.0 when left(replace(lower(c.name),'ё','е'),char_length(i.query))=i.query then 0.96 when position(i.query in replace(lower(c.name||' '||ca.alias),'ё','е'))>0 then 0.88 else 0.0 end,
        extensions.similarity(replace(lower(c.name||' '||ca.alias),'ё','е'),i.query))::real relevance
    from public.clubs c left join public.club_aliases ca on ca.club_id=c.id cross join input i
    where i.kind='club' and char_length(i.query)>=2 and (position(i.query in replace(lower(c.name||' '||replace(coalesce(ca.alias,''),'ё','е')),'ё','е'))>0 or extensions.similarity(replace(lower(c.name||' '||replace(coalesce(ca.alias,''),'ё','е')),'ё','е'),i.query)>=0.2)
    order by c.id,relevance desc
  ), competition_results as (
    select 'competition'::text entity_type, cp.id::text entity_id, cp.name title,
      coalesce(nullif(cp.area_name,''),'Турнир') subtitle, cp.code meta,
      greatest(case when replace(lower(cp.name),'ё','е')=i.query or lower(coalesce(cp.code,''))=i.query then 0.99 when left(replace(lower(cp.name),'ё','е'),char_length(i.query))=i.query then 0.94 when position(i.query in replace(lower(cp.name||' '||coalesce(cp.code,'')||' '||case cp.code when 'CL' then 'лига чемпионов' when 'PL' then 'апл английская премьер-лига' when 'PD' then 'ла лига' when 'BL1' then 'бундеслига' when 'SA' then 'серия а' when 'FL1' then 'лига 1' when 'EL' then 'лига европы' else '' end),'ё','е'))>0 then 0.86 else 0.0 end,
        extensions.similarity(replace(lower(cp.name||' '||coalesce(cp.code,'')||' '||case cp.code when 'CL' then 'лига чемпионов' when 'PL' then 'апл английская премьер-лига' when 'PD' then 'ла лига' when 'BL1' then 'бундеслига' when 'SA' then 'серия а' when 'FL1' then 'лига 1' when 'EL' then 'лига европы' else '' end),'ё','е'),i.query))::real relevance
    from public.competitions cp cross join input i
    where i.kind='competition' and char_length(i.query)>=2 and (position(i.query in replace(lower(cp.name||' '||coalesce(cp.code,'')||' '||case cp.code when 'CL' then 'лига чемпионов' when 'PL' then 'апл английская премьер-лига' when 'PD' then 'ла лига' when 'BL1' then 'бундеслига' when 'SA' then 'серия а' when 'FL1' then 'лига 1' when 'EL' then 'лига европы' else '' end),'ё','е'))>0 or extensions.similarity(replace(lower(cp.name||' '||coalesce(cp.code,'')||' '||case cp.code when 'CL' then 'лига чемпионов' when 'PL' then 'апл английская премьер-лига' when 'PD' then 'ла лига' when 'BL1' then 'бундеслига' when 'SA' then 'серия а' when 'FL1' then 'лига 1' when 'EL' then 'лига европы' else '' end),'ё','е'),i.query)>=0.2)
  ), player_results as (
    select 'player'::text entity_type,p.id::text entity_id,p.name title,coalesce(c.short_name,c.name,p.team) subtitle,p.position meta,
      greatest(case when replace(lower(p.name),'ё','е')=i.query then 1.0 when left(replace(lower(p.name),'ё','е'),char_length(i.query))=i.query then 0.95 when position(i.query in replace(lower(p.name),'ё','е'))>0 then 0.87 else 0.0 end,extensions.similarity(replace(lower(p.name),'ё','е'),i.query))::real relevance
    from public.players p left join public.clubs c on c.id=p.club_id cross join input i
    where i.kind='player' and char_length(i.query)>=2 and (position(i.query in replace(lower(p.name),'ё','е'))>0 or extensions.similarity(replace(lower(p.name),'ё','е'),i.query)>=0.28)
  ), match_results as (
    select 'match'::text entity_type,m.id::text entity_id,m.home_team_name||' — '||m.away_team_name title,m.league_name subtitle,m.status meta,
      greatest(case when (position(i.query in replace(lower(m.home_team_name||' '||m.away_team_name||' '||m.league_name),'ё','е'))>0 or exists(select 1 from public.club_aliases ca where ca.club_id in (m.home_club_id,m.away_club_id) and position(replace(lower(i.query),'ё','е') in replace(replace(lower(ca.alias),'ё','е'),'ё','е'))>0) or exists(select 1 from public.competitions cp where cp.id=m.competition_id and position(lower(i.query) in case cp.code when 'CL' then 'лига чемпионов' when 'PL' then 'апл английская премьер-лига' when 'PD' then 'ла лига' when 'BL1' then 'бундеслига' when 'SA' then 'серия а' when 'FL1' then 'лига 1' when 'EL' then 'лига европы' else '' end)>0)) then 0.82 else 0.0 end,extensions.similarity(replace(lower(m.home_team_name||' '||m.away_team_name||' '||m.league_name),'ё','е'),i.query))::real relevance
    from public.matches m cross join input i where i.kind='match' and char_length(i.query)>=2 and ((position(i.query in replace(lower(m.home_team_name||' '||m.away_team_name||' '||m.league_name),'ё','е'))>0 or exists(select 1 from public.club_aliases ca where ca.club_id in (m.home_club_id,m.away_club_id) and position(replace(lower(i.query),'ё','е') in replace(replace(lower(ca.alias),'ё','е'),'ё','е'))>0) or exists(select 1 from public.competitions cp where cp.id=m.competition_id and position(lower(i.query) in case cp.code when 'CL' then 'лига чемпионов' when 'PL' then 'апл английская премьер-лига' when 'PD' then 'ла лига' when 'BL1' then 'бундеслига' when 'SA' then 'серия а' when 'FL1' then 'лига 1' when 'EL' then 'лига европы' else '' end)>0)) or extensions.similarity(replace(lower(m.home_team_name||' '||m.away_team_name||' '||m.league_name),'ё','е'),i.query)>=0.2)
  ), user_results as (
    select 'user'::text entity_type,u.id::text entity_id,coalesce(nullif(u.display_name,''),u.username,'Пользователь') title,
      case when u.username is null then 'Профиль' else '@'||u.username end subtitle,'Профиль'::text meta,
      greatest(case when replace(lower(coalesce(u.username,'')),'ё','е')=i.query then 1.0 when left(replace(lower(coalesce(u.username,'')),'ё','е'),char_length(i.query))=i.query then 0.95 when position(i.query in replace(lower(coalesce(u.display_name,'')||' '||coalesce(u.username,'')),'ё','е'))>0 then 0.84 else 0.0 end,extensions.similarity(replace(lower(coalesce(u.display_name,'')||' '||coalesce(u.username,'')),'ё','е'),i.query))::real relevance
    from public.users u cross join input i where i.kind='user' and char_length(i.query)>=2 and (u.is_public=true or u.id=auth.uid()) and (position(i.query in replace(lower(coalesce(u.display_name,'')||' '||coalesce(u.username,'')),'ё','е'))>0 or extensions.similarity(replace(lower(coalesce(u.display_name,'')||' '||coalesce(u.username,'')),'ё','е'),i.query)>=0.25)
  ), combined as (
    select * from club_results union all select * from competition_results union all select * from player_results union all select * from match_results union all select * from user_results

  ), selected as materialized (
    select r.* from combined r
    where p_cursor is null or r.relevance<(p_cursor->>'relevance')::real
      or (r.relevance=(p_cursor->>'relevance')::real and (r.title,r.entity_id)>(p_cursor->>'title',p_cursor->>'id'))
    order by r.relevance desc,r.title,r.entity_id limit(select result_limit+1 from input)
  ), page as materialized (
    select * from selected order by relevance desc,title,entity_id limit(select result_limit from input)
  ), enriched as (
    select r.*,jsonb_build_object(
      'entity_type',r.entity_type,'entity_id',r.entity_id,'title',r.title,
      'subtitle',r.subtitle,'meta',r.meta,'relevance',r.relevance,
      'match_date',m.match_date,'home_score',m.home_score,'away_score',m.away_score,
      'visual',case when r.entity_type in ('club','player','competition') then jsonb_build_object(
        'id',r.entity_id,'name',r.title,'tla',c.tla,
        'primary_color',coalesce(c.primary_color,pc.primary_color),'secondary_color',coalesce(c.secondary_color,pc.secondary_color),
        'media',case when ma.id is null then null else jsonb_build_object(
          'id',ma.id,'asset_type',ma.asset_type,'url',coalesce(ma.storage_url,ma.source_url),
          'source_provider',ma.source_provider,'license_name',ma.license_name,
          'license_url',ma.license_url,'attribution',ma.attribution,'usage_status',ma.usage_status
        ) end
      ) else null end
    ) as item
    from page r
    left join public.clubs c on c.id=case when r.entity_type='club' then r.entity_id::bigint end
    left join public.players p on p.id=case when r.entity_type='player' then r.entity_id::bigint end
    left join public.clubs pc on pc.id=p.club_id
    left join public.competitions cp on cp.id=case when r.entity_type='competition' then r.entity_id::bigint end
    left join public.matches m on m.id=case when r.entity_type='match' then r.entity_id::bigint end
    left join public.media_assets ma on ma.id=coalesce(c.logo_asset_id,p.photo_asset_id,cp.logo_asset_id)
      and ma.asset_type=case r.entity_type when 'club' then 'club_logo' when 'player' then 'player_photo' when 'competition' then 'competition_logo' end
      and public.is_displayable_media_asset(ma)
  )
  select jsonb_build_object(
    'items',coalesce((select jsonb_agg(item order by relevance desc,title,entity_id) from enriched),'[]'::jsonb),
    'next_cursor',case when (select count(*) from selected)>(select result_limit from input) then (
      select jsonb_build_object('query',v_query,'kind',p_kind,'relevance',relevance,'title',title,'id',entity_id)
      from page order by relevance,title desc,entity_id desc limit 1
    ) else null end
  )
  );
end;
$function$;
revoke all on function public.search_footbazed_page(text,text,jsonb,integer) from public;
grant execute on function public.search_footbazed_page(text,text,jsonb,integer) to anon,authenticated;
notify pgrst,'reload schema';
