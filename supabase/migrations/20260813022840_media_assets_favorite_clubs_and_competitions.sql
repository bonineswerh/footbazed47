create table if not exists public.media_assets (
  id bigint generated always as identity primary key,
  asset_type text not null check (asset_type in ('club_logo', 'player_photo', 'competition_logo', 'team_photo', 'other')),
  source_provider text not null check (char_length(btrim(source_provider)) between 1 and 80),
  source_url text check (source_url is null or source_url ~ '^https://'),
  storage_key text check (storage_key is null or char_length(storage_key) between 1 and 500),
  storage_url text check (storage_url is null or storage_url ~ '^https://'),
  license_name text check (license_name is null or char_length(license_name) <= 160),
  license_url text check (license_url is null or license_url ~ '^https://'),
  attribution text check (attribution is null or char_length(attribution) <= 500),
  usage_status text not null default 'unknown' check (usage_status in ('verified', 'unknown', 'restricted', 'disabled')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (storage_url is not null or source_url is not null or storage_key is not null),
  check (usage_status <> 'verified' or verified_at is not null),
  check (usage_status <> 'verified' or coalesce(storage_url, source_url) is not null)
);

create index if not exists media_assets_status_type_idx
  on public.media_assets (usage_status, asset_type, id);
create index if not exists media_assets_source_provider_idx
  on public.media_assets (source_provider, id);
create unique index if not exists media_assets_source_url_key
  on public.media_assets (source_provider, source_url)
  where source_url is not null;

create table if not exists public.competitions (
  id bigint generated always as identity primary key,
  external_id bigint unique,
  code text,
  name text not null,
  short_name text,
  area_name text,
  competition_type text,
  logo_asset_id bigint references public.media_assets(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists competitions_name_lower_key
  on public.competitions (lower(name));
create unique index if not exists competitions_code_lower_key
  on public.competitions (lower(code))
  where code is not null and btrim(code) <> '';
create index if not exists competitions_name_trgm_idx
  on public.competitions using gin (lower(name) extensions.gin_trgm_ops);

alter table public.clubs
  add column if not exists primary_color text check (primary_color is null or primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  add column if not exists secondary_color text check (secondary_color is null or secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  add column if not exists logo_asset_id bigint references public.media_assets(id) on delete set null,
  add column if not exists metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object');

alter table public.players
  add column if not exists photo_asset_id bigint references public.media_assets(id) on delete set null,
  add column if not exists metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  add column if not exists updated_at timestamptz not null default now();

alter table public.matches
  add column if not exists competition_id bigint references public.competitions(id) on delete set null;

create table if not exists public.club_competitions (
  club_id bigint not null references public.clubs(id) on delete cascade,
  competition_id bigint not null references public.competitions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (club_id, competition_id)
);

create index if not exists club_competitions_competition_club_idx
  on public.club_competitions (competition_id, club_id);

create table if not exists public.favorite_clubs (
  user_id uuid not null references public.users(id) on delete cascade,
  club_id bigint not null references public.clubs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, club_id)
);

create index if not exists favorite_clubs_club_user_idx
  on public.favorite_clubs (club_id, user_id);

insert into public.competitions (code, name, short_name)
select nullif(btrim(min(m.league_code)), ''), btrim(m.league_name), btrim(m.league_name)
from public.matches m
where nullif(btrim(m.league_name), '') is not null
group by lower(btrim(m.league_name)), btrim(m.league_name)
on conflict do nothing;

update public.matches m
set competition_id = c.id
from public.competitions c
where lower(btrim(c.name)) = lower(btrim(m.league_name))
  and m.competition_id is distinct from c.id;

insert into public.club_competitions (club_id, competition_id)
select distinct club_id, competition_id
from (
  select m.home_club_id as club_id, m.competition_id from public.matches m
  union all
  select m.away_club_id as club_id, m.competition_id from public.matches m
) links
where club_id is not null and competition_id is not null
on conflict do nothing;

insert into public.favorite_clubs (user_id, club_id)
select distinct u.id, c.id
from public.users u
cross join lateral regexp_split_to_table(coalesce(u.favorite_teams, ''), '[,;\n]+') as split(team_name)
join public.clubs c on lower(btrim(c.name)) = lower(btrim(team_name))
where nullif(btrim(team_name), '') is not null
on conflict do nothing;

create or replace function public.set_entity_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.updated_at := now();
  return new;
end
$function$;

drop trigger if exists set_media_assets_updated_at_trigger on public.media_assets;
create trigger set_media_assets_updated_at_trigger
before update on public.media_assets
for each row execute function public.set_entity_updated_at();

drop trigger if exists set_competitions_updated_at_trigger on public.competitions;
create trigger set_competitions_updated_at_trigger
before update on public.competitions
for each row execute function public.set_entity_updated_at();

drop trigger if exists set_clubs_updated_at_trigger on public.clubs;
create trigger set_clubs_updated_at_trigger
before update on public.clubs
for each row execute function public.set_entity_updated_at();

drop trigger if exists set_players_updated_at_trigger on public.players;
create trigger set_players_updated_at_trigger
before update on public.players
for each row execute function public.set_entity_updated_at();

alter table public.media_assets enable row level security;
alter table public.competitions enable row level security;
alter table public.club_competitions enable row level security;
alter table public.favorite_clubs enable row level security;

drop policy if exists "Public reads verified media assets" on public.media_assets;
create policy "Public reads verified media assets"
on public.media_assets for select
to anon, authenticated
using (usage_status = 'verified');

drop policy if exists "Public reads competitions" on public.competitions;
create policy "Public reads competitions"
on public.competitions for select
to anon, authenticated
using (true);

drop policy if exists "Public reads club competitions" on public.club_competitions;
create policy "Public reads club competitions"
on public.club_competitions for select
to anon, authenticated
using (true);

drop policy if exists "Users read own favorite clubs" on public.favorite_clubs;
create policy "Users read own favorite clubs"
on public.favorite_clubs for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

revoke all on table public.media_assets, public.competitions, public.club_competitions, public.favorite_clubs
from public, anon, authenticated;
grant select on table public.media_assets, public.competitions, public.club_competitions to anon, authenticated;
grant select on table public.favorite_clubs to anon, authenticated;
grant select, insert, update, delete on table public.media_assets, public.competitions, public.club_competitions, public.favorite_clubs to service_role;
grant usage, select on sequence public.media_assets_id_seq, public.competitions_id_seq to service_role;

comment on table public.media_assets is 'Media provenance registry. Client roles can read VERIFIED assets only.';
comment on column public.media_assets.usage_status is 'UNKNOWN, RESTRICTED and DISABLED assets never reach the public Data API.';
comment on column public.clubs.crest_url is 'Deprecated provider URL. Production UI resolves only verified media_assets.';
comment on column public.players.photo_url is 'Deprecated provider URL. Production UI resolves only verified media_assets.';
comment on column public.users.favorite_teams is 'Deprecated free-text preference retained for backward compatibility. Use favorite_clubs.';

create or replace function public.set_favorite_club(p_club_id bigint, p_favorite boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  changed_count integer := 0;
  favorite_count integer := 0;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'auth_required';
  end if;
  if p_club_id is null or not exists (select 1 from public.clubs c where c.id = p_club_id) then
    raise exception using errcode = '22023', message = 'club_not_found';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text || ':favorite_club:' || p_club_id::text, 0));

  if coalesce(p_favorite, true) then
    insert into public.favorite_clubs (user_id, club_id)
    values (current_user_id, p_club_id)
    on conflict do nothing;
    get diagnostics changed_count = row_count;
  else
    delete from public.favorite_clubs
    where user_id = current_user_id and club_id = p_club_id;
    get diagnostics changed_count = row_count;
  end if;

  select count(*)::integer into favorite_count
  from public.favorite_clubs fc
  where fc.club_id = p_club_id;

  return jsonb_build_object(
    'club_id', p_club_id,
    'is_favorite', coalesce(p_favorite, true),
    'changed', changed_count > 0,
    'favorite_count', favorite_count
  );
end
$function$;

create or replace function public.get_my_favorite_clubs()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'name', c.name,
    'short_name', c.short_name,
    'tla', c.tla,
    'area_name', c.area_name,
    'primary_color', c.primary_color,
    'secondary_color', c.secondary_color,
    'media', case when ma.id is null then null else jsonb_build_object(
      'id', ma.id,
      'asset_type', ma.asset_type,
      'url', coalesce(ma.storage_url, ma.source_url),
      'source_provider', ma.source_provider,
      'license_name', ma.license_name,
      'license_url', ma.license_url,
      'attribution', ma.attribution,
      'usage_status', ma.usage_status
    ) end,
    'favorited_at', fc.created_at
  ) order by fc.created_at desc), '[]'::jsonb)
  from public.favorite_clubs fc
  join public.clubs c on c.id = fc.club_id
  left join public.media_assets ma on ma.id = c.logo_asset_id and ma.usage_status = 'verified'
  where fc.user_id = (select auth.uid());
$function$;

create or replace function public.get_club_page(p_club_id bigint)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
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
    'is_favorite', exists (
      select 1 from public.favorite_clubs fc
      where fc.user_id = (select auth.uid()) and fc.club_id = c.id
    ),
    'favorite_count', (select count(*)::integer from public.favorite_clubs fc where fc.club_id = c.id),
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
      'player_rating', (select round(avg(pr.rating)::numeric, 1) from public.player_ratings pr join public.players p on p.id = pr.player_id where p.club_id = c.id),
      'player_rating_count', (select count(*)::integer from public.player_ratings pr join public.players p on p.id = pr.player_id where p.club_id = c.id)
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
      left join public.media_assets pma on pma.id = p.photo_asset_id and pma.usage_status = 'verified'
      left join lateral (
        select round(avg(pr.rating)::numeric, 1) as average, count(*)::integer as rating_count,
               count(*) filter (where pr.is_best_player)::integer as best_votes
        from public.player_ratings pr where pr.player_id = p.id
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
  left join public.media_assets ma on ma.id = c.logo_asset_id and ma.usage_status = 'verified'
  where c.id = p_club_id;
$function$;

create or replace function public.get_player_page(p_player_id bigint)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
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
        from public.player_ratings pr join public.matches m on m.id = pr.match_id
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
      left join public.media_assets tma on tma.id = t.photo_asset_id and tma.usage_status = 'verified'
    ), '[]'::jsonb)
  )
  from public.players p
  left join public.clubs c on c.id = p.club_id
  left join public.media_assets pma on pma.id = p.photo_asset_id and pma.usage_status = 'verified'
  left join public.media_assets cma on cma.id = c.logo_asset_id and cma.usage_status = 'verified'
  left join lateral (
    select round(avg(pr.rating)::numeric, 1) as average, count(*)::integer as rating_count,
           count(*) filter (where pr.is_best_player)::integer as best_votes,
           count(distinct pr.match_id)::integer as matches_rated
    from public.player_ratings pr where pr.player_id = p.id
  ) ps on true
  where p.id = p_player_id;
$function$;

create or replace function public.get_competition_page(p_competition_id bigint)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  select jsonb_build_object(
    'competition', jsonb_build_object(
      'id', cp.id, 'code', cp.code, 'name', cp.name, 'short_name', cp.short_name,
      'area_name', cp.area_name, 'competition_type', cp.competition_type,
      'media', case when ma.id is null then null else jsonb_build_object(
        'id', ma.id, 'asset_type', ma.asset_type, 'url', coalesce(ma.storage_url, ma.source_url),
        'source_provider', ma.source_provider, 'license_name', ma.license_name,
        'license_url', ma.license_url, 'attribution', ma.attribution, 'usage_status', ma.usage_status
      ) end
    ),
    'stats', jsonb_build_object(
      'club_count', (select count(*)::integer from public.club_competitions cc where cc.competition_id = cp.id),
      'match_count', (select count(*)::integer from public.matches m where m.competition_id = cp.id),
      'finished_count', (select count(*)::integer from public.matches m where m.competition_id = cp.id and m.status = 'finished'),
      'upcoming_count', (select count(*)::integer from public.matches m where m.competition_id = cp.id and m.status in ('live', 'scheduled'))
    ),
    'clubs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.name, 'short_name', c.short_name, 'tla', c.tla,
        'primary_color', c.primary_color, 'secondary_color', c.secondary_color,
        'media', case when cma.id is null then null else jsonb_build_object(
          'id', cma.id, 'asset_type', cma.asset_type, 'url', coalesce(cma.storage_url, cma.source_url),
          'source_provider', cma.source_provider, 'license_name', cma.license_name,
          'license_url', cma.license_url, 'attribution', cma.attribution, 'usage_status', cma.usage_status
        ) end
      ) order by c.name)
      from public.club_competitions cc
      join public.clubs c on c.id = cc.club_id
      left join public.media_assets cma on cma.id = c.logo_asset_id and cma.usage_status = 'verified'
      where cc.competition_id = cp.id
    ), '[]'::jsonb),
    'matches', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', x.id, 'competition_id', x.competition_id, 'league_name', x.league_name,
        'home_team_name', x.home_team_name, 'away_team_name', x.away_team_name,
        'home_club_id', x.home_club_id, 'away_club_id', x.away_club_id,
        'match_date', x.match_date, 'status', x.status, 'home_score', x.home_score, 'away_score', x.away_score
      ) order by x.match_date desc)
      from (select m.* from public.matches m where m.competition_id = cp.id order by m.match_date desc limit 48) x
    ), '[]'::jsonb)
  )
  from public.competitions cp
  left join public.media_assets ma on ma.id = cp.logo_asset_id and ma.usage_status = 'verified'
  where cp.id = p_competition_id;
$function$;

create or replace function public.get_profile_page(p_user_id uuid, p_rating_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  requested_limit integer := least(greatest(coalesce(p_rating_limit, 50), 1), 100);
  profile_data jsonb;
  stats_data jsonb;
  friendship_data jsonb;
  ratings_data jsonb;
  favorite_clubs_data jsonb;
begin
  if p_user_id is null then raise exception using errcode = '22023', message = 'user_required'; end if;
  if not exists (
    select 1 from public.users u where u.id = p_user_id and (
      u.is_public = true or u.id = current_user_id or exists (
        select 1 from public.friendships f where f.status = 'accepted'
          and ((f.user_id = current_user_id and f.friend_id = u.id) or (f.friend_id = current_user_id and f.user_id = u.id))
      )
    )
  ) then return null; end if;

  select jsonb_build_object(
    'id', u.id, 'username', u.username, 'display_name', u.display_name, 'avatar_url', u.avatar_url,
    'bio', u.bio, 'favorite_teams', u.favorite_teams, 'ratings_count', coalesce(u.ratings_count, 0),
    'avg_rating', coalesce(u.avg_rating, 0), 'streak', coalesce(u.streak, 0), 'streak_date', u.streak_date,
    'is_public', u.is_public, 'created_at', u.created_at,
    'invite_code', case when u.id = current_user_id then u.invite_code else null end,
    'is_admin', case when u.id = current_user_id then u.is_admin else false end
  ) into profile_data from public.users u where u.id = p_user_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'name', c.name, 'short_name', c.short_name, 'tla', c.tla,
    'primary_color', c.primary_color, 'secondary_color', c.secondary_color,
    'media', case when ma.id is null then null else jsonb_build_object(
      'id', ma.id, 'asset_type', ma.asset_type, 'url', coalesce(ma.storage_url, ma.source_url),
      'source_provider', ma.source_provider, 'license_name', ma.license_name,
      'license_url', ma.license_url, 'attribution', ma.attribution, 'usage_status', ma.usage_status
    ) end
  ) order by fc.created_at desc), '[]'::jsonb)
  into favorite_clubs_data
  from public.favorite_clubs fc
  join public.clubs c on c.id = fc.club_id
  left join public.media_assets ma on ma.id = c.logo_asset_id and ma.usage_status = 'verified'
  where fc.user_id = p_user_id;

  select jsonb_build_object(
    'friend_count', (select count(distinct case when f.user_id = p_user_id then f.friend_id else f.user_id end)::integer from public.friendships f where f.status = 'accepted' and (f.user_id = p_user_id or f.friend_id = p_user_id)),
    'like_count', (select count(*)::integer from public.rating_likes rl join public.ratings r on r.id = rl.rating_id where r.user_id = p_user_id and (r.is_public = true or p_user_id = current_user_id))
  ) into stats_data;

  if current_user_id is not null and current_user_id <> p_user_id then
    select jsonb_build_object('status', f.status, 'direction', case when f.user_id = current_user_id then 'outgoing' else 'incoming' end)
    into friendship_data from public.friendships f
    where (f.user_id = current_user_id and f.friend_id = p_user_id) or (f.friend_id = current_user_id and f.user_id = p_user_id)
    order by case f.status when 'accepted' then 1 when 'pending' then 2 else 3 end,
             case when f.user_id = current_user_id then 1 else 2 end limit 1;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', x.id, 'user_id', x.user_id, 'match_id', x.match_id, 'match_rating', x.match_rating,
    'comment', x.comment, 'is_public', x.is_public, 'created_at', x.created_at,
    'match', jsonb_build_object('id', x.match_id, 'home_team_name', x.home_team_name, 'away_team_name', x.away_team_name, 'league_name', x.league_name)
  ) order by x.created_at desc, x.id desc), '[]'::jsonb)
  into ratings_data
  from (
    select r.id, r.user_id, r.match_id, r.match_rating, r.comment, r.is_public, r.created_at,
           m.home_team_name, m.away_team_name, m.league_name
    from public.ratings r join public.matches m on m.id = r.match_id
    where r.user_id = p_user_id and (r.is_public = true or p_user_id = current_user_id)
    order by r.created_at desc, r.id desc limit requested_limit
  ) x;

  return jsonb_build_object('profile', profile_data, 'favorite_clubs', favorite_clubs_data,
    'stats', stats_data, 'friendship', friendship_data, 'ratings', ratings_data);
end
$function$;

create or replace function public.get_matches_page(
  p_status text default 'all', p_league text default null, p_query text default null,
  p_limit integer default 24, p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare
  normalized_status text := lower(btrim(coalesce(p_status, 'all')));
  normalized_league text := nullif(btrim(coalesce(p_league, '')), '');
  normalized_query text := left(lower(btrim(coalesce(p_query, ''))), 80);
  normalized_limit integer := least(greatest(coalesce(p_limit, 24), 1), 48);
  normalized_offset integer := least(greatest(coalesce(p_offset, 0), 0), 10000);
  result jsonb;
begin
  if normalized_status not in ('all', 'live', 'scheduled', 'finished', 'postponed', 'cancelled') then
    raise exception using errcode = '22023', message = 'invalid_match_status';
  end if;
  if normalized_league = 'all' then normalized_league := null; end if;
  with filtered as materialized (
    select m.id, m.competition_id, m.league_name, m.home_team_name, m.away_team_name,
      m.home_club_id, m.away_club_id, m.match_date, m.status, m.home_score, m.away_score,
      m.external_id, m.league_code, m.matchday, m.season,
      case m.status when 'live' then 0 when 'scheduled' then 1 when 'finished' then 2 else 3 end as sort_status,
      case when m.status = 'scheduled' and m.match_date < current_timestamp then 1 else 0 end as sort_stale,
      case when m.status in ('live', 'scheduled') and m.match_date >= current_timestamp then m.match_date end as sort_upcoming,
      case when m.status = 'finished' or (m.status = 'scheduled' and m.match_date < current_timestamp) then m.match_date end as sort_recent
    from public.matches m
    where (normalized_status = 'all' or m.status = normalized_status)
      and (normalized_league is null or m.league_name = normalized_league)
      and (normalized_query = '' or lower(m.home_team_name) like '%' || normalized_query || '%'
        or lower(m.away_team_name) like '%' || normalized_query || '%' or lower(m.league_name) like '%' || normalized_query || '%')
  ), page as materialized (
    select * from filtered order by sort_status, sort_stale, sort_upcoming asc nulls last, sort_recent desc nulls last, id desc
    limit normalized_limit offset normalized_offset
  ), totals as (select count(*)::integer as total from filtered),
  league_values as (select distinct m.league_name from public.matches m where nullif(btrim(m.league_name), '') is not null)
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'id', p.id, 'competition_id', p.competition_id, 'league_name', p.league_name,
      'home_team_name', p.home_team_name, 'away_team_name', p.away_team_name,
      'home_club_id', p.home_club_id, 'away_club_id', p.away_club_id,
      'match_date', p.match_date, 'status', p.status, 'home_score', p.home_score, 'away_score', p.away_score,
      'external_id', p.external_id, 'league_code', p.league_code, 'matchday', p.matchday, 'season', p.season
    ) order by p.sort_status, p.sort_stale, p.sort_upcoming asc nulls last, p.sort_recent desc nulls last, p.id desc) from page p), '[]'::jsonb),
    'total', totals.total, 'has_more', normalized_offset + (select count(*) from page) < totals.total,
    'next_offset', normalized_offset + (select count(*) from page),
    'leagues', coalesce((select jsonb_agg(l.league_name order by l.league_name) from league_values l), '[]'::jsonb)
  ) into result from totals;
  return result;
end
$function$;

create or replace function public.search_footbazed(p_query text, p_limit integer default 14)
returns table (entity_type text, entity_id text, title text, subtitle text, meta text, relevance real)
language sql
stable
security invoker
set search_path = ''
as $function$
  with input as (
    select lower(btrim(coalesce(p_query, ''))) as query, least(greatest(coalesce(p_limit, 14), 1), 24) as result_limit
  ), club_results as (
    select distinct on (c.id) 'club'::text entity_type, c.id::text entity_id, c.name title,
      coalesce(nullif(c.area_name, ''), 'Клуб') subtitle, c.tla meta,
      greatest(case when lower(c.name)=i.query or lower(ca.alias)=i.query then 1.0 when left(lower(c.name),char_length(i.query))=i.query then 0.96 when position(i.query in lower(c.name||' '||ca.alias))>0 then 0.88 else 0.0 end,
        extensions.similarity(lower(c.name||' '||ca.alias),i.query))::real relevance
    from public.clubs c left join public.club_aliases ca on ca.club_id=c.id cross join input i
    where char_length(i.query)>=2 and (position(i.query in lower(c.name||' '||coalesce(ca.alias,'')))>0 or extensions.similarity(lower(c.name||' '||coalesce(ca.alias,'')),i.query)>=0.2)
    order by c.id,relevance desc
  ), competition_results as (
    select 'competition'::text entity_type, cp.id::text entity_id, cp.name title,
      coalesce(nullif(cp.area_name,''),'Турнир') subtitle, cp.code meta,
      greatest(case when lower(cp.name)=i.query or lower(coalesce(cp.code,''))=i.query then 0.99 when left(lower(cp.name),char_length(i.query))=i.query then 0.94 when position(i.query in lower(cp.name||' '||coalesce(cp.code,'')))>0 then 0.86 else 0.0 end,
        extensions.similarity(lower(cp.name||' '||coalesce(cp.code,'')),i.query))::real relevance
    from public.competitions cp cross join input i
    where char_length(i.query)>=2 and (position(i.query in lower(cp.name||' '||coalesce(cp.code,'')))>0 or extensions.similarity(lower(cp.name||' '||coalesce(cp.code,'')),i.query)>=0.2)
  ), player_results as (
    select 'player'::text entity_type,p.id::text entity_id,p.name title,coalesce(c.short_name,c.name,p.team) subtitle,p.position meta,
      greatest(case when lower(p.name)=i.query then 1.0 when left(lower(p.name),char_length(i.query))=i.query then 0.95 when position(i.query in lower(p.name))>0 then 0.87 else 0.0 end,extensions.similarity(lower(p.name),i.query))::real relevance
    from public.players p left join public.clubs c on c.id=p.club_id cross join input i
    where char_length(i.query)>=2 and (position(i.query in lower(p.name))>0 or extensions.similarity(lower(p.name),i.query)>=0.28)
  ), match_results as (
    select 'match'::text entity_type,m.id::text entity_id,m.home_team_name||' — '||m.away_team_name title,m.league_name subtitle,m.status meta,
      greatest(case when position(i.query in lower(m.home_team_name||' '||m.away_team_name||' '||m.league_name))>0 then 0.82 else 0.0 end,extensions.similarity(lower(m.home_team_name||' '||m.away_team_name||' '||m.league_name),i.query))::real relevance
    from public.matches m cross join input i where char_length(i.query)>=2 and (position(i.query in lower(m.home_team_name||' '||m.away_team_name||' '||m.league_name))>0 or extensions.similarity(lower(m.home_team_name||' '||m.away_team_name||' '||m.league_name),i.query)>=0.2)
  ), user_results as (
    select 'user'::text entity_type,u.id::text entity_id,coalesce(nullif(u.display_name,''),u.username,'Пользователь') title,
      case when u.username is null then 'Профиль' else '@'||u.username end subtitle,'Профиль'::text meta,
      greatest(case when lower(coalesce(u.username,''))=i.query then 1.0 when left(lower(coalesce(u.username,'')),char_length(i.query))=i.query then 0.95 when position(i.query in lower(coalesce(u.display_name,'')||' '||coalesce(u.username,'')))>0 then 0.84 else 0.0 end,extensions.similarity(lower(coalesce(u.display_name,'')||' '||coalesce(u.username,'')),i.query))::real relevance
    from public.users u cross join input i where char_length(i.query)>=2 and (u.is_public=true or u.id=auth.uid()) and (position(i.query in lower(coalesce(u.display_name,'')||' '||coalesce(u.username,'')))>0 or extensions.similarity(lower(coalesce(u.display_name,'')||' '||coalesce(u.username,'')),i.query)>=0.25)
  ), combined as (
    select * from club_results union all select * from competition_results union all select * from player_results union all select * from match_results union all select * from user_results
  ), ranked as (
    select c.*,row_number() over(partition by c.entity_type order by c.relevance desc,c.title) type_position from combined c
  )
  select r.entity_type,r.entity_id,r.title,r.subtitle,r.meta,r.relevance from ranked r
  where r.type_position<=case r.entity_type when 'club' then 4 when 'competition' then 3 when 'player' then 4 when 'match' then 5 when 'user' then 3 else 2 end
  order by r.relevance desc,case r.entity_type when 'club' then 1 when 'competition' then 2 when 'player' then 3 when 'match' then 4 else 5 end,r.title
  limit(select result_limit from input);
$function$;

revoke all on function public.set_favorite_club(bigint, boolean) from public, anon;
revoke all on function public.get_my_favorite_clubs() from public, anon;
revoke all on function public.set_entity_updated_at() from public, anon, authenticated;
revoke all on function public.get_competition_page(bigint) from public;
revoke all on function public.get_club_page(bigint) from public;
revoke all on function public.get_player_page(bigint) from public;
revoke all on function public.search_footbazed(text, integer) from public;
revoke all on function public.get_matches_page(text, text, text, integer, integer) from public;
grant execute on function public.set_favorite_club(bigint, boolean) to authenticated;
grant execute on function public.get_my_favorite_clubs() to authenticated;
grant execute on function public.set_entity_updated_at() to service_role;
grant execute on function public.get_competition_page(bigint) to anon, authenticated;
grant execute on function public.get_club_page(bigint) to anon, authenticated;
grant execute on function public.get_player_page(bigint) to anon, authenticated;
grant execute on function public.search_footbazed(text, integer) to anon, authenticated;
grant execute on function public.get_matches_page(text, text, text, integer, integer) to anon, authenticated;

notify pgrst, 'reload schema';
