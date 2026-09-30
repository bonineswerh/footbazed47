-- Historical participation belongs to a fixture, never to the player's current club.
-- No existing scores, player identities or legacy provider IDs are rewritten.
create table public.player_provider_ids (
  provider text not null check (provider in ('api-football','football-data.org')),
  external_id bigint not null check (external_id > 0),
  player_id bigint not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (provider, external_id), unique (provider, player_id)
);
create index player_provider_ids_player_idx on public.player_provider_ids(player_id);
alter table public.player_provider_ids enable row level security;
revoke all on public.player_provider_ids from public, anon, authenticated;
grant select, insert, delete on public.player_provider_ids to service_role;

-- A legacy ID is imported only when it identifies exactly one local player.
insert into public.player_provider_ids(provider, external_id, player_id)
select 'football-data.org', (metadata->>'external_id')::bigint, id
from public.players p
where metadata->>'provider' = 'football-data.org'
  and metadata->>'external_id' ~ '^[1-9][0-9]{0,14}$'
  and (select count(*) from public.players other
       where other.metadata->>'provider' = 'football-data.org'
         and other.metadata->>'external_id' = p.metadata->>'external_id') = 1;

create table public.match_lineups (
  match_id bigint primary key references public.matches(id) on delete cascade,
  provider text not null default 'api-football' check (provider = 'api-football'),
  fixture_id bigint not null unique check (fixture_id > 0),
  home_club_id bigint not null references public.clubs(id),
  away_club_id bigint not null references public.clubs(id),
  home_formation text check (home_formation ~ '^[1-5](-[1-5]){2,4}$'),
  away_formation text check (away_formation ~ '^[1-5](-[1-5]){2,4}$'),
  events_available boolean not null default false,
  statistics_available boolean not null default false,
  obtained_at timestamptz not null default now(),
  check (home_club_id <> away_club_id)
);
create index match_lineups_home_idx on public.match_lineups(home_club_id);
create index match_lineups_away_idx on public.match_lineups(away_club_id);
alter table public.match_lineups enable row level security;
revoke all on public.match_lineups from public, anon, authenticated;
grant select on public.match_lineups to anon, authenticated;
grant select, insert, update, delete on public.match_lineups to service_role;
create policy "Public reads historical lineups" on public.match_lineups for select to anon, authenticated using (true);

create table public.match_player_appearances (
  match_id bigint not null references public.match_lineups(match_id) on delete cascade,
  provider_player_id bigint not null check (provider_player_id > 0),
  player_id bigint references public.players(id) on delete set null,
  club_id bigint not null references public.clubs(id),
  name text not null check (char_length(name) between 1 and 160),
  participation text not null check (participation in ('starter','substitute','bench')),
  position text check (position in ('G','D','M','F')),
  shirt_number smallint check (shirt_number between 1 and 99),
  grid text check (grid ~ '^[1-6]:[1-5]$'),
  entered_minute smallint check (entered_minute between 0 and 120),
  entered_extra smallint check (entered_extra between 0 and 30),
  left_minute smallint check (left_minute between 0 and 120),
  left_extra smallint check (left_extra between 0 and 30),
  minutes_played smallint check (minutes_played between 0 and 150),
  goals smallint check (goals between 0 and 20),
  assists smallint check (assists between 0 and 20),
  yellow_cards smallint check (yellow_cards between 0 and 2),
  red_cards smallint check (red_cards between 0 and 1),
  own_goals smallint check (own_goals between 0 and 10),
  missed_penalties smallint check (missed_penalties between 0 and 10),
  primary key (match_id, provider_player_id), unique (match_id, player_id),
  check ((participation <> 'substitute' or entered_minute is not null or minutes_played > 0) is true),
  check (participation <> 'bench' or (entered_minute is null and coalesce(minutes_played,0) = 0)),
  check (participation = 'starter' or grid is null)
);
create index match_appearances_player_idx on public.match_player_appearances(player_id) where player_id is not null;
create index match_appearances_club_idx on public.match_player_appearances(club_id);
alter table public.match_player_appearances enable row level security;
revoke all on public.match_player_appearances from public, anon, authenticated;
grant select on public.match_player_appearances to anon, authenticated;
grant select, insert, update, delete on public.match_player_appearances to service_role;
create policy "Public reads historical appearances" on public.match_player_appearances for select to anon, authenticated using (true);

create function public.validate_match_appearance()
returns trigger language plpgsql security invoker set search_path = '' as $function$
begin
  if not exists (select 1 from public.match_lineups l join public.matches m on m.id=l.match_id
    where l.match_id=new.match_id and l.home_club_id=m.home_club_id and l.away_club_id=m.away_club_id
      and new.club_id in (l.home_club_id,l.away_club_id)) then
    raise exception using errcode='22023',message='appearance_club_mismatch';
  end if;
  if new.player_id is not null and not exists (select 1 from public.player_provider_ids p
    where p.provider='api-football' and p.external_id=new.provider_player_id and p.player_id=new.player_id) then
    raise exception using errcode='22023',message='appearance_player_mapping_mismatch';
  end if;
  return new;
end
$function$;
revoke all on function public.validate_match_appearance() from public, anon, authenticated;
create trigger validate_match_appearance_trigger before insert or update on public.match_player_appearances
for each row execute function public.validate_match_appearance();

create function public.protect_historical_fixture_identity()
returns trigger language plpgsql security invoker set search_path = '' as $function$
begin
  if (new.home_club_id,new.away_club_id,new.match_date,new.competition_id,new.season,new.external_id)
    is distinct from (old.home_club_id,old.away_club_id,old.match_date,old.competition_id,old.season,old.external_id)
    and exists(select 1 from public.match_lineups where match_id=old.id) then
    raise exception using errcode='22023',message='historical_fixture_identity_locked';
  end if;
  return new;
end
$function$;
revoke all on function public.protect_historical_fixture_identity() from public, anon, authenticated;
create trigger protect_historical_fixture_identity_trigger before update on public.matches
for each row execute function public.protect_historical_fixture_identity();

create function public.get_match_lineup(p_match_id bigint)
returns jsonb language sql stable security invoker set search_path = '' as $function$
  select jsonb_build_object('available',l.match_id is not null,'provider',l.provider,'obtained_at',l.obtained_at,
    'events_available',coalesce(l.events_available,false),'statistics_available',coalesce(l.statistics_available,false),
    'home',jsonb_build_object('club_id',m.home_club_id,'name',m.home_team_name,'formation',l.home_formation),
    'away',jsonb_build_object('club_id',m.away_club_id,'name',m.away_team_name,'formation',l.away_formation),
    'players',coalesce((select jsonb_agg(to_jsonb(a) || jsonb_build_object('id',a.player_id,
      'eligible',a.player_id is not null and a.participation in ('starter','substitute'),
      'media',case when asset.id is null then null else jsonb_build_object('id',asset.id,'asset_type',asset.asset_type,
        'url',coalesce(asset.storage_url,asset.source_url),'source_provider',asset.source_provider,
        'usage_status',asset.usage_status,'attribution',asset.attribution,'license_name',asset.license_name,'license_url',asset.license_url) end)
      order by a.club_id,case a.participation when 'starter' then 0 when 'substitute' then 1 else 2 end,a.grid,a.name)
      from public.match_player_appearances a
      left join public.players p on p.id=a.player_id
      left join public.media_assets asset on asset.id=p.photo_asset_id and public.is_displayable_media_asset(asset)
      where a.match_id=m.id),'[]'::jsonb))
  from public.matches m left join public.match_lineups l on l.match_id=m.id where m.id=p_match_id
$function$;
revoke all on function public.get_match_lineup(bigint) from public;
grant execute on function public.get_match_lineup(bigint) to anon, authenticated;

-- Prepared payloads are bound to an administrator and the exact unchanged fixture.
create table public.match_lineup_batches (
  id uuid primary key default gen_random_uuid(),
  match_id bigint not null references public.matches(id) on delete cascade,
  identity jsonb not null,
  payload jsonb not null check (jsonb_typeof(payload)='object'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  result jsonb
);
create index match_lineup_batches_match_idx on public.match_lineup_batches(match_id);
create index match_lineup_batches_actor_idx on public.match_lineup_batches(created_by,created_at desc);
alter table public.match_lineup_batches enable row level security;
revoke all on public.match_lineup_batches from public, anon, authenticated;
grant select, insert, update, delete on public.match_lineup_batches to service_role;

create function public.admin_stage_match_lineup(p_match_id bigint,p_payload jsonb,p_actor uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare m public.matches; batch_id uuid; identity jsonb;
begin
  if current_user <> 'service_role' then raise exception using errcode='42501',message='service_role_required'; end if;
  if not exists(select 1 from public.users where id=p_actor and is_admin) then raise exception using errcode='42501',message='admin_required'; end if;
  select * into m from public.matches where id=p_match_id;
  if m.id is null or m.status <> 'finished' then raise exception using errcode='22023',message='match_not_finished'; end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object' or p_payload->>'provider' is distinct from 'api-football'
    or coalesce(p_payload->>'fixture_id','') !~ '^[1-9][0-9]{0,14}$'
    or p_payload->>'home_club_id' is distinct from m.home_club_id::text
    or p_payload->>'away_club_id' is distinct from m.away_club_id::text
    or p_payload->>'season' is distinct from m.season
    or p_payload->>'league_code' is distinct from m.league_code
    or p_payload->>'match_date' is null
    or abs(extract(epoch from ((p_payload->>'match_date')::timestamptz-m.match_date))) > 900
    or jsonb_typeof(p_payload->'players') is distinct from 'array'
    or jsonb_array_length(p_payload->'players') not between 22 and 60 then
    raise exception using errcode='22023',message='invalid_lineup_batch';
  end if;
  if exists(select 1 from public.match_lineups where match_id=m.id) then
    raise exception using errcode='22023',message='lineup_already_imported';
  end if;
  identity := jsonb_build_object('home_club_id',m.home_club_id,'away_club_id',m.away_club_id,'match_date',m.match_date,
    'competition_id',m.competition_id,'season',m.season,'external_id',m.external_id,'api_fixture_id',m.api_fixture_id);
  insert into public.match_lineup_batches(match_id,identity,payload,created_by) values(m.id,identity,p_payload,p_actor) returning id into batch_id;
  return jsonb_build_object('batch',batch_id,'match_id',m.id,'players',jsonb_array_length(p_payload->'players'));
end
$function$;

create function public.admin_apply_match_lineup(p_batch uuid,p_actor uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare b public.match_lineup_batches; m public.matches; identity jsonb; item jsonb; applied jsonb;
begin
  if current_user <> 'service_role' then raise exception using errcode='42501',message='service_role_required'; end if;
  if not exists(select 1 from public.users where id=p_actor and is_admin) then raise exception using errcode='42501',message='admin_required'; end if;
  select * into b from public.match_lineup_batches where id=p_batch and created_by=p_actor for update;
  if b.id is null then raise exception using errcode='22023',message='lineup_batch_not_found'; end if;
  if b.applied_at is not null then return b.result; end if;
  if b.created_at < now()-interval '30 minutes' then raise exception using errcode='22023',message='lineup_batch_expired'; end if;
  select * into m from public.matches where id=b.match_id for update;
  identity := jsonb_build_object('home_club_id',m.home_club_id,'away_club_id',m.away_club_id,'match_date',m.match_date,
    'competition_id',m.competition_id,'season',m.season,'external_id',m.external_id,'api_fixture_id',m.api_fixture_id);
  if identity is distinct from b.identity or m.status <> 'finished' then raise exception using errcode='22023',message='fixture_identity_changed'; end if;
  if m.api_fixture_id is not null and m.api_fixture_id::text <> b.payload->>'fixture_id' then
    raise exception using errcode='22023',message='provider_mapping_conflict'; end if;
  -- An import is immutable; a second batch cannot replace rated historical appearances.
  insert into public.match_lineups(match_id,fixture_id,home_club_id,away_club_id,home_formation,away_formation,events_available,statistics_available)
  values(m.id,(b.payload->>'fixture_id')::bigint,m.home_club_id,m.away_club_id,b.payload->>'home_formation',b.payload->>'away_formation',
    (b.payload->>'events_available')::boolean,(b.payload->>'statistics_available')::boolean);
  for item in select * from jsonb_array_elements(b.payload->'players') loop
    insert into public.match_player_appearances(match_id,provider_player_id,player_id,club_id,name,participation,position,shirt_number,grid,
      entered_minute,entered_extra,left_minute,left_extra,minutes_played,goals,assists,yellow_cards,red_cards,own_goals,missed_penalties)
    values(m.id,(item->>'provider_player_id')::bigint,(select p.player_id from public.player_provider_ids p
        where p.provider='api-football' and p.external_id=(item->>'provider_player_id')::bigint),
      (item->>'club_id')::bigint,item->>'name',item->>'participation',item->>'position',(item->>'shirt_number')::smallint,item->>'grid',
      (item->>'entered_minute')::smallint,(item->>'entered_extra')::smallint,(item->>'left_minute')::smallint,(item->>'left_extra')::smallint,
      (item->>'minutes_played')::smallint,(item->>'goals')::smallint,(item->>'assists')::smallint,(item->>'yellow_cards')::smallint,
      (item->>'red_cards')::smallint,(item->>'own_goals')::smallint,(item->>'missed_penalties')::smallint);
  end loop;
  if (select count(*) from public.match_player_appearances where match_id=m.id and club_id=m.home_club_id and participation='starter') <> 11
    or (select count(*) from public.match_player_appearances where match_id=m.id and club_id=m.away_club_id and participation='starter') <> 11 then
    raise exception using errcode='22023',message='starting_eleven_incomplete';
  end if;
  update public.matches set api_fixture_id=(b.payload->>'fixture_id')::integer where id=m.id;
  applied := jsonb_build_object('batch',b.id,'match_id',m.id,'players',jsonb_array_length(b.payload->'players'));
  update public.match_lineup_batches set applied_at=clock_timestamp(),result=applied where id=b.id;
  insert into public.admin_audit_logs(actor_id,action,target_type,target_id,metadata)
  values(p_actor,'apply_match_lineup','match',m.id::text,jsonb_build_object('batch',b.id,'fixture_id',b.payload->'fixture_id'));
  return applied;
end
$function$;
revoke all on function public.admin_stage_match_lineup(bigint,jsonb,uuid), public.admin_apply_match_lineup(uuid,uuid) from public, anon, authenticated;
grant execute on function public.admin_stage_match_lineup(bigint,jsonb,uuid), public.admin_apply_match_lineup(uuid,uuid) to service_role;
notify pgrst,'reload schema';
