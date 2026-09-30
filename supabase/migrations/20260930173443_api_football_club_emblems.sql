-- Additive logo-only pilot: internal identities and legacy external_id stay intact.
alter table public.media_assets drop constraint media_assets_usage_status_check;
alter table public.media_assets add constraint media_assets_usage_status_check
  check (usage_status in ('verified','identification','unknown','restricted','disabled'));
alter table public.media_assets add constraint media_assets_identification_scope_check check (
  usage_status <> 'identification' or (
    source_provider = 'api-football' and asset_type = 'club_logo'
    and source_url ~ '^https://media[.]api-sports[.]io/football/teams/[1-9][0-9]*[.]png$'
    and storage_url is null and storage_key is null
    and license_name is null and license_url is null and verified_at is null and verified_by is null
    and metadata->>'usage_scope' = 'club_identification'
    and metadata->>'rights_status' = 'not_verified'
    and metadata->>'terms_url' = 'https://www.api-football.com/terms'
  ) is true
);

create function public.is_displayable_media_asset(p_asset public.media_assets)
returns boolean language sql immutable security invoker set search_path = '' as $function$
  select coalesce((p_asset).usage_status = 'verified' or (
    (p_asset).usage_status = 'identification' and (p_asset).source_provider = 'api-football'
    and (p_asset).asset_type = 'club_logo'
    and (p_asset).source_url ~ '^https://media[.]api-sports[.]io/football/teams/[1-9][0-9]*[.]png$'
    and (p_asset).storage_url is null and (p_asset).storage_key is null
  ),false)
$function$;
revoke all on function public.is_displayable_media_asset(public.media_assets) from public;
grant execute on function public.is_displayable_media_asset(public.media_assets) to anon,authenticated,service_role;
drop policy "Public reads verified media assets" on public.media_assets;
create policy "Public reads displayable media assets" on public.media_assets for select
  to anon,authenticated using (public.is_displayable_media_asset(media_assets));
comment on column public.media_assets.usage_status is 'IDENTIFICATION is narrowly scoped API-Football club identification, not a verified license. UNKNOWN/RESTRICTED/DISABLED remain private.';

-- Extend the five existing page aggregates without changing signatures, grants,
-- visibility predicates or return shape. Assertions detect baseline drift.
do $migration$
declare item record; definition text; updated text;
begin
  for item in select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prokind='f' and p.proname in
      ('get_club_page','get_my_favorite_clubs','get_competition_page','get_player_page','get_profile_page')
  loop
    definition := pg_get_functiondef(item.oid);
    updated := regexp_replace(definition, '([a-z]+)[.]usage_status = ''verified''', 'public.is_displayable_media_asset(\1)', 'g');
    if updated=definition then raise exception 'media_contract_drift: %',item.proname; end if;
    execute updated;
  end loop;
end
$migration$;

create table public.club_provider_ids (
  provider text not null check (provider in ('api-football','football-data.org')),
  external_id bigint not null check (external_id>0),
  club_id bigint not null references public.clubs(id) on delete cascade,
  provider_name text not null check (char_length(provider_name) between 1 and 160),
  country text not null check (char_length(country) between 1 and 100),
  created_at timestamptz not null default now(),
  primary key (provider,external_id), unique (provider,club_id)
);
create index club_provider_ids_club_idx on public.club_provider_ids(club_id);
alter table public.club_provider_ids enable row level security;
revoke all on public.club_provider_ids from public,anon,authenticated;
grant select,insert,delete on public.club_provider_ids to service_role;

create table public.club_emblem_batches (
  id uuid primary key default gen_random_uuid(),
  league text not null check (league in ('PL','PD','BL1','SA','FL1','CL')),
  season integer not null check (season between 1990 and 2100),
  status text not null default 'prepared' check (status in ('prepared','applied','rolled_back')),
  items jsonb not null check (jsonb_typeof(items)='array' and jsonb_array_length(items) between 1 and 120),
  result jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  applied_at timestamptz
);
create index club_emblem_batches_created_by_idx on public.club_emblem_batches(created_by,created_at desc);
alter table public.club_emblem_batches enable row level security;
revoke all on public.club_emblem_batches from public,anon,authenticated;
grant select,insert,update on public.club_emblem_batches to service_role;

create function public.admin_stage_club_emblems(p_items jsonb,p_league text,p_season integer,p_actor uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare entry jsonb; club public.clubs; prepared jsonb := '[]'; batch_id uuid;
begin
  if current_user <> 'service_role' then raise exception using errcode='42501',message='service_role_required'; end if;
  if not exists(select 1 from public.users where id=p_actor and is_admin) then raise exception using errcode='42501',message='admin_required'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 120
    or p_league is null or p_league not in ('PL','PD','BL1','SA','FL1','CL') or p_season is null or p_season not between 1990 and 2100
    then raise exception using errcode='22023',message='invalid_emblem_batch'; end if;
  if (select count(distinct e->>'club_id') from jsonb_array_elements(p_items) e) <> jsonb_array_length(p_items)
    or (select count(distinct e->>'provider_id') from jsonb_array_elements(p_items) e) <> jsonb_array_length(p_items)
    then raise exception using errcode='22023',message='duplicate_emblem_identity'; end if;
  for entry in select * from jsonb_array_elements(p_items) loop
    if jsonb_typeof(entry)<>'object' or coalesce(entry->>'club_id','') !~ '^[1-9][0-9]*$'
      or coalesce(entry->>'provider_id','') !~ '^[1-9][0-9]*$'
      or entry->>'source_url' is distinct from 'https://media.api-sports.io/football/teams/'||(entry->>'provider_id')||'.png'
      or coalesce(char_length(entry->>'provider_name'),0) not between 1 and 160
      or coalesce(char_length(entry->>'country'),0) not between 1 and 100
      then raise exception using errcode='22023',message='invalid_emblem_item'; end if;
    select * into club from public.clubs where id=(entry->>'club_id')::bigint;
    if club.id is null or club.external_id::text is distinct from entry->>'legacy_external_id'
      or club.name is distinct from entry->>'club_name' then raise exception using errcode='22023',message='club_identity_changed'; end if;
    -- Do not replace another source or a deliberately disabled asset.
    if club.logo_asset_id is not null and not exists (
      select 1 from public.media_assets a where a.id=club.logo_asset_id
        and a.source_provider='api-football' and a.usage_status='identification'
    ) then continue; end if;
    prepared := prepared || jsonb_build_array(entry||jsonb_build_object('previous_asset_id',club.logo_asset_id,
      'previous_mapping',(select to_jsonb(m) from public.club_provider_ids m where m.provider='api-football' and m.club_id=club.id)));
  end loop;
  if jsonb_array_length(prepared)=0 then raise exception using errcode='22023',message='no_emblems_to_apply'; end if;
  insert into public.club_emblem_batches(league,season,items,created_by) values(p_league,p_season,prepared,p_actor) returning id into batch_id;
  return jsonb_build_object('batch',batch_id,'items',prepared,'matched',jsonb_array_length(prepared));
end
$function$;

create function public.admin_apply_club_emblems(p_batch uuid,p_actor uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare batch public.club_emblem_batches; entry jsonb; club public.clubs; asset_id bigint; applied jsonb := '[]'; apply_result jsonb;
begin
  if current_user <> 'service_role' then raise exception using errcode='42501',message='service_role_required'; end if;
  if not exists(select 1 from public.users where id=p_actor and is_admin) then raise exception using errcode='42501',message='admin_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('footbazed:club-emblems',0));
  select * into batch from public.club_emblem_batches where id=p_batch and created_by=p_actor for update;
  if batch.id is null then raise exception using errcode='22023',message='emblem_batch_not_found'; end if;
  if batch.status='applied' then return batch.result; end if;
  if batch.status<>'prepared' or batch.created_at < now()-interval '30 minutes' then raise exception using errcode='22023',message='emblem_batch_expired'; end if;
  for entry in select * from jsonb_array_elements(batch.items) loop
    select * into club from public.clubs where id=(entry->>'club_id')::bigint for update;
    if club.id is null or club.external_id::text is distinct from entry->>'legacy_external_id'
      or club.name is distinct from entry->>'club_name'
      or club.logo_asset_id is distinct from (entry->>'previous_asset_id')::bigint
      then raise exception using errcode='22023',message='club_identity_changed'; end if;
    if exists(select 1 from public.club_provider_ids m where m.provider='api-football' and
      ((m.external_id=(entry->>'provider_id')::bigint and m.club_id<>club.id)
      or (m.club_id=club.id and m.external_id<>(entry->>'provider_id')::bigint)))
      then raise exception using errcode='22023',message='provider_mapping_conflict'; end if;
    insert into public.club_provider_ids(provider,external_id,club_id,provider_name,country)
      values('api-football',(entry->>'provider_id')::bigint,club.id,entry->>'provider_name',entry->>'country') on conflict do nothing;
    insert into public.media_assets(asset_type,source_provider,source_url,attribution,usage_status,metadata)
      values('club_logo','api-football',entry->>'source_url','API-Football / API-Sports · эмблема клуба','identification',
        jsonb_build_object('usage_scope','club_identification','rights_status','not_verified','terms_url','https://www.api-football.com/terms',
          'provider_team_id',(entry->>'provider_id')::bigint,'provider_name',entry->>'provider_name','country',entry->>'country','league',batch.league,'season',batch.season))
      on conflict (source_provider,source_url) where source_url is not null do nothing;
    select id into asset_id from public.media_assets where source_provider='api-football' and source_url=entry->>'source_url'
      and usage_status='identification' and asset_type='club_logo';
    if asset_id is null then raise exception using errcode='22023',message='emblem_asset_unavailable'; end if;
    update public.clubs set logo_asset_id=asset_id where id=club.id;
    applied := applied || jsonb_build_array(jsonb_build_object('club_id',club.id,'asset_id',asset_id,
      'updated_at',(select updated_at from public.clubs where id=club.id)));
  end loop;
  apply_result := jsonb_build_object('batch',batch.id,'applied',jsonb_array_length(applied),'items',applied);
  update public.club_emblem_batches set status='applied',applied_at=clock_timestamp(),result=apply_result where id=batch.id;
  insert into public.admin_audit_logs(actor_id,action,target_type,target_id,metadata)
    values(p_actor,'apply_club_emblems','club_emblem_batch',batch.id::text,jsonb_build_object('applied',jsonb_array_length(applied),'league',batch.league));
  return apply_result;
end
$function$;

create function public.admin_rollback_club_emblems(p_batch uuid,p_actor uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare batch public.club_emblem_batches; entry jsonb; after_item jsonb;
begin
  if current_user <> 'service_role' then raise exception using errcode='42501',message='service_role_required'; end if;
  if not exists(select 1 from public.users where id=p_actor and is_admin) then raise exception using errcode='42501',message='admin_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('footbazed:club-emblems',0));
  select * into batch from public.club_emblem_batches where id=p_batch and created_by=p_actor for update;
  if batch.id is null or batch.status<>'applied' then raise exception using errcode='22023',message='emblem_batch_not_applied'; end if;
  for entry in select * from jsonb_array_elements(batch.items) loop
    select e into after_item from jsonb_array_elements(batch.result->'items') e where e->>'club_id'=entry->>'club_id';
    perform 1 from public.clubs where id=(entry->>'club_id')::bigint for update;
    if not exists(select 1 from public.clubs where id=(entry->>'club_id')::bigint
      and logo_asset_id=(after_item->>'asset_id')::bigint and updated_at=(after_item->>'updated_at')::timestamptz)
      then raise exception using errcode='22023',message='club_changed_since_apply'; end if;
    update public.clubs set logo_asset_id=(entry->>'previous_asset_id')::bigint where id=(entry->>'club_id')::bigint;
    if entry->'previous_mapping'='null'::jsonb then
      delete from public.club_provider_ids where provider='api-football' and club_id=(entry->>'club_id')::bigint and external_id=(entry->>'provider_id')::bigint;
    end if;
  end loop;
  update public.club_emblem_batches set status='rolled_back' where id=batch.id;
  insert into public.admin_audit_logs(actor_id,action,target_type,target_id,metadata)
    values(p_actor,'rollback_club_emblems','club_emblem_batch',batch.id::text,jsonb_build_object('restored',jsonb_array_length(batch.items)));
  return jsonb_build_object('restored',jsonb_array_length(batch.items));
end
$function$;
revoke all on function public.admin_stage_club_emblems(jsonb,text,integer,uuid),public.admin_apply_club_emblems(uuid,uuid),public.admin_rollback_club_emblems(uuid,uuid) from public,anon,authenticated;
grant execute on function public.admin_stage_club_emblems(jsonb,text,integer,uuid),public.admin_apply_club_emblems(uuid,uuid),public.admin_rollback_club_emblems(uuid,uuid) to service_role;

-- One bounded request for all marks on a page; no per-card HTTP requests.
create function public.get_club_marks(p_ids bigint[])
returns jsonb language sql stable security invoker set search_path = '' as $function$
  select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'media',case when a.id is null then null else
    jsonb_build_object('id',a.id,'asset_type',a.asset_type,'url',coalesce(a.storage_url,a.source_url),'source_provider',a.source_provider,
      'license_name',a.license_name,'license_url',a.license_url,'attribution',a.attribution,'usage_status',a.usage_status) end) order by c.id),'[]')
  from (select distinct id from unnest(p_ids[1:96]) id where id>0) wanted
  join public.clubs c on c.id=wanted.id
  left join public.media_assets a on a.id=c.logo_asset_id and public.is_displayable_media_asset(a)
$function$;
revoke all on function public.get_club_marks(bigint[]) from public;
grant execute on function public.get_club_marks(bigint[]) to anon,authenticated;
notify pgrst,'reload schema';
