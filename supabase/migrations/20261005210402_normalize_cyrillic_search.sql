-- Match the query and searchable text with the same Cyrillic normalization.
-- Original labels, invoker privileges, visibility and bounded ranking stay intact.
CREATE OR REPLACE FUNCTION public.search_footbazed(p_query text, p_limit integer DEFAULT 14)
 RETURNS TABLE(entity_type text, entity_id text, title text, subtitle text, meta text, relevance real)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with input as (
    select replace(lower(btrim(coalesce(p_query, ''))),'ё','е') as query, least(greatest(coalesce(p_limit, 14), 1), 24) as result_limit
  ), club_results as (
    select distinct on (c.id) 'club'::text entity_type, c.id::text entity_id, c.name title,
      coalesce(nullif(c.area_name, ''), 'Клуб') subtitle, c.tla meta,
      greatest(case when replace(lower(c.name),'ё','е')=i.query or replace(lower(ca.alias),'ё','е')=i.query then 1.0 when left(replace(lower(c.name),'ё','е'),char_length(i.query))=i.query then 0.96 when position(i.query in replace(lower(c.name||' '||ca.alias),'ё','е'))>0 then 0.88 else 0.0 end,
        extensions.similarity(replace(lower(c.name||' '||ca.alias),'ё','е'),i.query))::real relevance
    from public.clubs c left join public.club_aliases ca on ca.club_id=c.id cross join input i
    where char_length(i.query)>=2 and (position(i.query in replace(lower(c.name||' '||replace(coalesce(ca.alias,''),'ё','е')),'ё','е'))>0 or extensions.similarity(replace(lower(c.name||' '||replace(coalesce(ca.alias,''),'ё','е')),'ё','е'),i.query)>=0.2)
    order by c.id,relevance desc
  ), competition_results as (
    select 'competition'::text entity_type, cp.id::text entity_id, cp.name title,
      coalesce(nullif(cp.area_name,''),'Турнир') subtitle, cp.code meta,
      greatest(case when replace(lower(cp.name),'ё','е')=i.query or lower(coalesce(cp.code,''))=i.query then 0.99 when left(replace(lower(cp.name),'ё','е'),char_length(i.query))=i.query then 0.94 when position(i.query in replace(lower(cp.name||' '||coalesce(cp.code,'')||' '||case cp.code when 'CL' then 'лига чемпионов' when 'PL' then 'апл английская премьер-лига' when 'PD' then 'ла лига' when 'BL1' then 'бундеслига' when 'SA' then 'серия а' when 'FL1' then 'лига 1' when 'EL' then 'лига европы' else '' end),'ё','е'))>0 then 0.86 else 0.0 end,
        extensions.similarity(replace(lower(cp.name||' '||coalesce(cp.code,'')||' '||case cp.code when 'CL' then 'лига чемпионов' when 'PL' then 'апл английская премьер-лига' when 'PD' then 'ла лига' when 'BL1' then 'бундеслига' when 'SA' then 'серия а' when 'FL1' then 'лига 1' when 'EL' then 'лига европы' else '' end),'ё','е'),i.query))::real relevance
    from public.competitions cp cross join input i
    where char_length(i.query)>=2 and (position(i.query in replace(lower(cp.name||' '||coalesce(cp.code,'')||' '||case cp.code when 'CL' then 'лига чемпионов' when 'PL' then 'апл английская премьер-лига' when 'PD' then 'ла лига' when 'BL1' then 'бундеслига' when 'SA' then 'серия а' when 'FL1' then 'лига 1' when 'EL' then 'лига европы' else '' end),'ё','е'))>0 or extensions.similarity(replace(lower(cp.name||' '||coalesce(cp.code,'')||' '||case cp.code when 'CL' then 'лига чемпионов' when 'PL' then 'апл английская премьер-лига' when 'PD' then 'ла лига' when 'BL1' then 'бундеслига' when 'SA' then 'серия а' when 'FL1' then 'лига 1' when 'EL' then 'лига европы' else '' end),'ё','е'),i.query)>=0.2)
  ), player_results as (
    select 'player'::text entity_type,p.id::text entity_id,p.name title,coalesce(c.short_name,c.name,p.team) subtitle,p.position meta,
      greatest(case when replace(lower(p.name),'ё','е')=i.query then 1.0 when left(replace(lower(p.name),'ё','е'),char_length(i.query))=i.query then 0.95 when position(i.query in replace(lower(p.name),'ё','е'))>0 then 0.87 else 0.0 end,extensions.similarity(replace(lower(p.name),'ё','е'),i.query))::real relevance
    from public.players p left join public.clubs c on c.id=p.club_id cross join input i
    where char_length(i.query)>=2 and (position(i.query in replace(lower(p.name),'ё','е'))>0 or extensions.similarity(replace(lower(p.name),'ё','е'),i.query)>=0.28)
  ), match_results as (
    select 'match'::text entity_type,m.id::text entity_id,m.home_team_name||' — '||m.away_team_name title,m.league_name subtitle,m.status meta,
      greatest(case when (position(i.query in replace(lower(m.home_team_name||' '||m.away_team_name||' '||m.league_name),'ё','е'))>0 or exists(select 1 from public.club_aliases ca where ca.club_id in (m.home_club_id,m.away_club_id) and position(replace(lower(i.query),'ё','е') in replace(replace(lower(ca.alias),'ё','е'),'ё','е'))>0) or exists(select 1 from public.competitions cp where cp.id=m.competition_id and position(lower(i.query) in case cp.code when 'CL' then 'лига чемпионов' when 'PL' then 'апл английская премьер-лига' when 'PD' then 'ла лига' when 'BL1' then 'бундеслига' when 'SA' then 'серия а' when 'FL1' then 'лига 1' when 'EL' then 'лига европы' else '' end)>0)) then 0.82 else 0.0 end,extensions.similarity(replace(lower(m.home_team_name||' '||m.away_team_name||' '||m.league_name),'ё','е'),i.query))::real relevance
    from public.matches m cross join input i where char_length(i.query)>=2 and ((position(i.query in replace(lower(m.home_team_name||' '||m.away_team_name||' '||m.league_name),'ё','е'))>0 or exists(select 1 from public.club_aliases ca where ca.club_id in (m.home_club_id,m.away_club_id) and position(replace(lower(i.query),'ё','е') in replace(replace(lower(ca.alias),'ё','е'),'ё','е'))>0) or exists(select 1 from public.competitions cp where cp.id=m.competition_id and position(lower(i.query) in case cp.code when 'CL' then 'лига чемпионов' when 'PL' then 'апл английская премьер-лига' when 'PD' then 'ла лига' when 'BL1' then 'бундеслига' when 'SA' then 'серия а' when 'FL1' then 'лига 1' when 'EL' then 'лига европы' else '' end)>0)) or extensions.similarity(replace(lower(m.home_team_name||' '||m.away_team_name||' '||m.league_name),'ё','е'),i.query)>=0.2)
  ), user_results as (
    select 'user'::text entity_type,u.id::text entity_id,coalesce(nullif(u.display_name,''),u.username,'Пользователь') title,
      case when u.username is null then 'Профиль' else '@'||u.username end subtitle,'Профиль'::text meta,
      greatest(case when replace(lower(coalesce(u.username,'')),'ё','е')=i.query then 1.0 when left(replace(lower(coalesce(u.username,'')),'ё','е'),char_length(i.query))=i.query then 0.95 when position(i.query in replace(lower(coalesce(u.display_name,'')||' '||coalesce(u.username,'')),'ё','е'))>0 then 0.84 else 0.0 end,extensions.similarity(replace(lower(coalesce(u.display_name,'')||' '||coalesce(u.username,'')),'ё','е'),i.query))::real relevance
    from public.users u cross join input i where char_length(i.query)>=2 and (u.is_public=true or u.id=auth.uid()) and (position(i.query in replace(lower(coalesce(u.display_name,'')||' '||coalesce(u.username,'')),'ё','е'))>0 or extensions.similarity(replace(lower(coalesce(u.display_name,'')||' '||coalesce(u.username,'')),'ё','е'),i.query)>=0.25)
  ), combined as (
    select * from club_results union all select * from competition_results union all select * from player_results union all select * from match_results union all select * from user_results
  ), ranked as (
    select c.*,row_number() over(partition by c.entity_type order by c.relevance desc,c.title) type_position from combined c
  )
  select r.entity_type,r.entity_id,r.title,r.subtitle,r.meta,r.relevance from ranked r
  where r.type_position<=case r.entity_type when 'club' then 4 when 'competition' then 3 when 'player' then 4 when 'match' then 5 when 'user' then 3 else 2 end
  order by r.relevance desc,case r.entity_type when 'club' then 1 when 'competition' then 2 when 'player' then 3 when 'match' then 4 else 5 end,r.title
  limit(select result_limit from input);
$function$
;
