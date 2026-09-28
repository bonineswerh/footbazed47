-- Respect PostgREST safeupdate: only mutate identities already captured in the locked backup.
create or replace function public.admin_cleanup_development_data(p_scope text,p_confirmation text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  clean_scope text:=lower(btrim(coalesce(p_scope,'')));
  batch uuid:=nullif(current_setting('app.catalog_reset_batch',true),'')::uuid;
  backup_id uuid; snap jsonb:='{}'; table_name text; rows_json jsonb;
  matches_before bigint; players_before bigint; ratings_before bigint; clubs_before bigint;
  favorite_before bigint; favorite_after bigint; part jsonb;
begin
  if current_user<>'service_role' then raise exception using errcode='42501',message='service_role_required'; end if;
  if p_confirmation is distinct from 'DELETE FOOTBAZED DATA' then raise exception using errcode='22023',message='confirmation_required'; end if;
  if clean_scope not in ('matches','players','ratings','all') then raise exception using errcode='22023',message='invalid_cleanup_scope'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('footbazed-catalog-reset',0));
  if clean_scope='all' and (batch is null or (select count(*) from private.catalog_staging where batch_id=batch and created_at>now()-interval '1 day')<>6
    or (select count(distinct payload->>'from') from private.catalog_staging where batch_id=batch)<>1
    or (select count(distinct payload->>'to') from private.catalog_staging where batch_id=batch)<>1) then
    raise exception using errcode='22023',message='complete_catalog_required';
  end if;
  -- Serialize writes for a consistent backup and replacement. Ordinary reads continue.
  lock table public.matches,public.players,public.clubs,public.competitions,public.ratings,
    public.player_ratings,public.rating_likes,public.rating_comments,public.predictions,
    public.chat_messages,public.live_chat_messages,public.referee_ratings,public.rating_activity_days,
    public.club_aliases,public.club_competitions,public.favorite_clubs,public.notifications,
    public.direct_messages,public.users in share row exclusive mode;
  foreach table_name in array array['competitions','clubs','club_aliases','club_competitions','favorite_clubs',
    'players','matches','ratings','player_ratings','rating_likes','rating_comments','predictions',
    'chat_messages','live_chat_messages','referee_ratings','rating_activity_days'] loop
    execute format('select coalesce(jsonb_agg(to_jsonb(t)),''[]''::jsonb) from public.%I t',table_name) into rows_json;
    snap:=snap||jsonb_build_object(table_name,rows_json);
  end loop;
  snap:=snap||jsonb_build_object(
    'notifications',coalesce((select jsonb_agg(to_jsonb(n)) from public.notifications n where n.rating_id is not null or n.comment_id is not null),'[]'::jsonb),
    'direct_message_links',coalesce((select jsonb_agg(jsonb_build_object('id',id,'rating_id',rating_id,'body',body)) from public.direct_messages where rating_id is not null),'[]'::jsonb),
    'user_counters',coalesce((select jsonb_agg(jsonb_build_object('id',id,'ratings_count',ratings_count,'avg_rating',avg_rating,'streak',streak,'streak_date',streak_date)) from public.users),'[]'::jsonb));
  insert into private.football_backups(scope,snapshot) values(clean_scope,snap) returning id into backup_id;
  matches_before:=jsonb_array_length(snap->'matches');players_before:=jsonb_array_length(snap->'players');
  ratings_before:=jsonb_array_length(snap->'ratings');clubs_before:=jsonb_array_length(snap->'clubs');
  favorite_before:=jsonb_array_length(snap->'favorite_clubs');
  if clean_scope in ('ratings','matches','all') then
    update public.direct_messages set body=coalesce(nullif(btrim(body),''),'Оценка удалённого тестового матча') where rating_id is not null;
    delete from public.ratings where id in (select (item->>'id')::bigint from jsonb_array_elements(snap->'ratings') item);
    delete from public.rating_activity_days where user_id in (select (item->>'user_id')::uuid from jsonb_array_elements(snap->'rating_activity_days') item);
    perform set_config('app.allow_managed_profile_update','true',true);
    update public.users set ratings_count=0,avg_rating=0,streak=0,streak_date=null where id in (select (item->>'id')::uuid from jsonb_array_elements(snap->'user_counters') item);
  end if;
  if clean_scope in ('matches','all') then
    delete from public.live_chat_messages where id in (select (item->>'id')::bigint from jsonb_array_elements(snap->'live_chat_messages') item);delete from public.referee_ratings where id in (select (item->>'id')::bigint from jsonb_array_elements(snap->'referee_ratings') item);delete from public.matches where id in (select (item->>'id')::bigint from jsonb_array_elements(snap->'matches') item);
  end if;
  if clean_scope in ('players','all') then delete from public.players where id in (select (item->>'id')::bigint from jsonb_array_elements(snap->'players') item);end if;
  if clean_scope='all' then
    delete from public.clubs where id in (select (item->>'id')::bigint from jsonb_array_elements(snap->'clubs') item);delete from public.competitions where id in (select (item->>'id')::bigint from jsonb_array_elements(snap->'competitions') item);
    for part in select payload from private.catalog_staging where batch_id=batch order by league loop
      insert into public.competitions(external_id,code,name,short_name,area_name,competition_type)
        select x.external_id,x.code,x.name,x.name,x.area_name,x.competition_type from jsonb_to_record(part->'competition') x(external_id bigint,code text,name text,area_name text,competition_type text);
      insert into public.clubs(external_id,name,short_name,tla,area_name,venue,founded,club_colors,primary_color,secondary_color)
        select x.external_id,x.name,x.short_name,x.tla,x.area_name,x.venue,x.founded,x.club_colors,x.primary_color,x.secondary_color
        from jsonb_to_recordset(part->'clubs') x(external_id bigint,name text,short_name text,tla text,area_name text,venue text,founded integer,club_colors text,primary_color text,secondary_color text)
        on conflict(external_id) do nothing;
      insert into public.club_competitions(club_id,competition_id)
        select c.id,co.id from public.clubs c join jsonb_to_recordset(part->'clubs') x(external_id bigint) on x.external_id=c.external_id
        cross join public.competitions co where co.code=part->'competition'->>'code' on conflict do nothing;
      insert into public.players(name,team,club_id,position,shirt_number,metadata)
        select x.name,c.name,c.id,x.position,x.shirt_number,x.metadata from jsonb_to_recordset(part->'players') x(name text,external_club_id bigint,position text,shirt_number integer,metadata jsonb)
        join public.clubs c on c.external_id=x.external_club_id on conflict(name,team) do nothing;
      insert into public.matches(external_id,league_name,league_code,competition_id,home_team_name,away_team_name,home_club_id,away_club_id,match_date,status,home_score,away_score,matchday,season)
        select x.external_id,co.name,co.code,co.id,h.name,a.name,h.id,a.id,x.match_date,x.status,x.home_score,x.away_score,x.matchday,x.season
        from jsonb_to_recordset(part->'matches') x(external_id bigint,home_external_id bigint,away_external_id bigint,match_date timestamptz,status text,home_score smallint,away_score smallint,matchday integer,season text)
        join public.clubs h on h.external_id=x.home_external_id join public.clubs a on a.external_id=x.away_external_id
        cross join public.competitions co where co.code=part->'competition'->>'code' on conflict(external_id) do nothing;
    end loop;
    insert into public.club_aliases(club_id,alias) select id,name from public.clubs on conflict do nothing;
    insert into public.club_aliases(club_id,alias) select id,short_name from public.clubs where nullif(btrim(short_name),'') is not null on conflict do nothing;
    insert into public.favorite_clubs(user_id,club_id,created_at)
      select distinct f.user_id,n.id,f.created_at from jsonb_to_recordset(snap->'favorite_clubs') f(user_id uuid,club_id bigint,created_at timestamptz)
      join jsonb_to_recordset(snap->'clubs') old(id bigint,external_id bigint,name text,short_name text) on old.id=f.club_id
      join public.clubs n on n.external_id=old.external_id or lower(n.name)=lower(old.name) or lower(n.short_name)=lower(old.name)
      on conflict do nothing;
    select count(*) into favorite_after from public.favorite_clubs;
    if favorite_after<>favorite_before then raise exception using errcode='22023',message='favorite_mapping_required';end if;
    if not exists(select 1 from public.matches) or not exists(select 1 from public.players) then raise exception using errcode='22023',message='empty_catalog';end if;
    delete from private.catalog_staging where batch_id=batch;
  end if;
  return jsonb_build_object('scope',clean_scope,'backup_id',backup_id,'deleted',jsonb_build_object(
    'matches',case when clean_scope in ('matches','all') then matches_before else 0 end,
    'players',case when clean_scope in ('players','all') then players_before else 0 end,
    'ratings',case when clean_scope in ('ratings','matches','all') then ratings_before else 0 end,
    'clubs',case when clean_scope='all' then clubs_before else 0 end),
    'imported',case when clean_scope='all' then jsonb_build_object('matches',(select count(*) from public.matches),'players',(select count(*) from public.players),'clubs',(select count(*) from public.clubs),'competitions',(select count(*) from public.competitions),'favorites',favorite_after) else null end);
end $$;

notify pgrst,'reload schema';
