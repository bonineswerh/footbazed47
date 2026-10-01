-- A direct team lookup has no tournament/season coverage claim. Existing
-- league-season batches remain valid; the new context uses a genuinely NULL season.
alter table public.club_emblem_batches
  drop constraint club_emblem_batches_league_check,
  add constraint club_emblem_batches_league_check check(league in ('PL','PD','BL1','SA','FL1','CL','CATALOG')),
  alter column season drop not null,
  add constraint club_emblem_batches_lookup_context_check check(
    (league='CATALOG' and season is null) or
    (league in ('PL','PD','BL1','SA','FL1','CL') and season is not null and season between 1990 and 2100)
  );

-- Keep the reviewed atomic apply/rollback, actor checks, locks, grants, expiry,
-- identity guards and provenance restrictions. Refuse unexpected definitions.
do $migration$
declare definition text; previous text; replacement text;
begin
  definition:=replace(pg_get_functiondef('public.admin_stage_club_emblems(jsonb,text,integer,uuid)'::regprocedure),E'\r\n',E'\n');
  previous:=$old$or p_league is null or p_league not in ('PL','PD','BL1','SA','FL1','CL') or p_season is null or p_season not between 1990 and 2100$old$;
  replacement:=$new$or p_league is null or not (
      (p_league='CATALOG' and p_season is null) or
      (p_league in ('PL','PD','BL1','SA','FL1','CL') and p_season is not null and p_season between 1990 and 2100)
    )$new$;
  if position(previous in definition)=0 then raise exception 'unexpected_emblem_stage_definition'; end if;
  execute replace(definition,previous,replacement);

  definition:=replace(pg_get_functiondef('public.admin_apply_club_emblems(uuid,uuid)'::regprocedure),E'\r\n',E'\n');
  previous:=$old$'country',entry->>'country','league',batch.league,'season',batch.season$old$;
  replacement:=$new$'country',entry->>'country',
          'lookup_mode',case when batch.league='CATALOG' then 'team-search' else 'league-season' end,
          'league',nullif(batch.league,'CATALOG'),'season',batch.season$new$;
  if position(previous in definition)=0 then raise exception 'unexpected_emblem_apply_definition'; end if;
  execute replace(definition,previous,replacement);
end $migration$;
notify pgrst,'reload schema';
