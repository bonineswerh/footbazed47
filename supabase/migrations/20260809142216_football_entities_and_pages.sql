create table if not exists public.clubs (
  id bigint generated always as identity primary key,
  external_id bigint unique,
  name text not null,
  short_name text,
  tla text,
  crest_url text,
  area_name text,
  venue text,
  founded integer check (founded is null or founded between 1800 and 2100),
  club_colors text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists clubs_name_lower_key
  on public.clubs (lower(name));
create index if not exists clubs_name_trgm_idx
  on public.clubs using gin (lower(name) extensions.gin_trgm_ops);

create table if not exists public.club_aliases (
  id bigint generated always as identity primary key,
  club_id bigint not null references public.clubs(id) on delete cascade,
  alias text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists club_aliases_alias_lower_key
  on public.club_aliases (lower(alias));
create index if not exists club_aliases_club_idx
  on public.club_aliases (club_id);
create index if not exists club_aliases_alias_trgm_idx
  on public.club_aliases using gin (lower(alias) extensions.gin_trgm_ops);

alter table public.players
  add column if not exists club_id bigint references public.clubs(id) on delete set null;
alter table public.matches
  add column if not exists home_club_id bigint references public.clubs(id) on delete set null,
  add column if not exists away_club_id bigint references public.clubs(id) on delete set null;

insert into public.clubs (name, short_name)
select distinct p.team, p.team
from public.players p
where nullif(btrim(p.team), '') is not null
on conflict do nothing;

insert into public.club_aliases (club_id, alias)
select c.id, c.name
from public.clubs c
on conflict do nothing;

with known_alias(alias, canonical_name) as (
  values
    ('Alavés', 'Deportivo Alavés'),
    ('Atleti', 'Club Atlético de Madrid'),
    ('Barça', 'FC Barcelona'),
    ('Bayern', 'FC Bayern München'),
    ('Bologna', 'Bologna FC 1909'),
    ('Bremen', 'SV Werder Bremen'),
    ('Brest', 'Stade Brestois 29'),
    ('Celta', 'RC Celta de Vigo'),
    ('Dortmund', 'Borussia Dortmund'),
    ('Espanyol', 'RCD Espanyol de Barcelona'),
    ('Frankfurt', 'Eintracht Frankfurt'),
    ('Heidenheim', '1. FC Heidenheim 1846'),
    ('HSV', 'Hamburger SV'),
    ('Inter', 'FC Internazionale Milano'),
    ('M''gladbach', 'Borussia Mönchengladbach'),
    ('Mainz', '1. FSV Mainz 05'),
    ('Man City', 'Manchester City FC'),
    ('Man United', 'Manchester United FC'),
    ('Marseille', 'Olympique de Marseille'),
    ('Monaco', 'AS Monaco FC'),
    ('Newcastle', 'Newcastle United FC'),
    ('Parma', 'Parma Calcio 1913'),
    ('PSG', 'Paris Saint-Germain FC'),
    ('RC Lens', 'Racing Club de Lens'),
    ('Sassuolo', 'US Sassuolo Calcio'),
    ('Sporting CP', 'Sporting Clube de Portugal'),
    ('St. Pauli', 'FC St. Pauli 1910'),
    ('Strasbourg', 'RC Strasbourg Alsace'),
    ('Tottenham', 'Tottenham Hotspur FC'),
    ('Udinese', 'Udinese Calcio'),
    ('Verona', 'Hellas Verona FC'),
    ('West Ham', 'West Ham United FC'),
    ('Wolverhampton', 'Wolverhampton Wanderers FC')
)
insert into public.club_aliases (club_id, alias)
select c.id, a.alias
from known_alias a
join public.clubs c on lower(c.name) = lower(a.canonical_name)
on conflict do nothing;

with match_teams as (
  select distinct m.home_team_name as name from public.matches m
  union
  select distinct m.away_team_name from public.matches m
),
unmatched as (
  select mt.name
  from match_teams mt
  where nullif(btrim(mt.name), '') is not null
    and not exists (
      select 1 from public.club_aliases ca where lower(ca.alias) = lower(mt.name)
    )
),
confident_matches as (
  select u.name as alias, candidate.id as club_id
  from unmatched u
  cross join lateral (
    select c.id, extensions.similarity(lower(u.name), lower(c.name)) as score
    from public.clubs c
    order by score desc, c.id
    limit 1
  ) candidate
  where candidate.score >= 0.55
)
insert into public.club_aliases (club_id, alias)
select cm.club_id, cm.alias
from confident_matches cm
on conflict do nothing;

with match_teams as (
  select distinct m.home_team_name as name from public.matches m
  union
  select distinct m.away_team_name from public.matches m
),
unmatched as (
  select mt.name
  from match_teams mt
  where nullif(btrim(mt.name), '') is not null
    and not exists (
      select 1 from public.club_aliases ca where lower(ca.alias) = lower(mt.name)
    )
)
insert into public.clubs (name, short_name)
select u.name, u.name
from unmatched u
on conflict do nothing;

insert into public.club_aliases (club_id, alias)
select c.id, c.name
from public.clubs c
on conflict do nothing;

update public.players p
set club_id = ca.club_id
from public.club_aliases ca
where lower(ca.alias) = lower(p.team)
  and p.club_id is distinct from ca.club_id;

update public.matches m
set home_club_id = ca.club_id
from public.club_aliases ca
where lower(ca.alias) = lower(m.home_team_name)
  and m.home_club_id is distinct from ca.club_id;

update public.matches m
set away_club_id = ca.club_id
from public.club_aliases ca
where lower(ca.alias) = lower(m.away_team_name)
  and m.away_club_id is distinct from ca.club_id;

create index if not exists players_club_position_name_idx
  on public.players (club_id, position, name);
create index if not exists players_name_trgm_idx
  on public.players using gin (lower(name) extensions.gin_trgm_ops);
create index if not exists matches_home_club_date_idx
  on public.matches (home_club_id, match_date desc);
create index if not exists matches_away_club_date_idx
  on public.matches (away_club_id, match_date desc);

alter table public.clubs enable row level security;
alter table public.club_aliases enable row level security;

drop policy if exists "Public read clubs" on public.clubs;
create policy "Public read clubs"
on public.clubs for select
to anon, authenticated
using (true);

drop policy if exists "Public read club aliases" on public.club_aliases;
create policy "Public read club aliases"
on public.club_aliases for select
to anon, authenticated
using (true);

revoke all on table public.clubs from public, anon, authenticated;
revoke all on table public.club_aliases from public, anon, authenticated;
grant select on table public.clubs, public.club_aliases to anon, authenticated;
grant select, insert, update, delete on table public.clubs, public.club_aliases to service_role;
grant usage, select on sequence public.clubs_id_seq, public.club_aliases_id_seq to service_role;

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
      'crest_url', c.crest_url,
      'area_name', c.area_name,
      'venue', c.venue,
      'founded', c.founded,
      'club_colors', c.club_colors
    ),
    'competitions', coalesce((
      select jsonb_agg(x.league_name order by x.league_name)
      from (
        select distinct m.league_name
        from public.matches m
        where m.home_club_id = c.id or m.away_club_id = c.id
      ) x
    ), '[]'::jsonb),
    'stats', jsonb_build_object(
      'squad_count', (select count(*)::integer from public.players p where p.club_id = c.id),
      'match_count', (select count(*)::integer from public.matches m where m.home_club_id = c.id or m.away_club_id = c.id),
      'upcoming_count', (select count(*)::integer from public.matches m where (m.home_club_id = c.id or m.away_club_id = c.id) and m.status = 'scheduled'),
      'player_rating', (
        select round(avg(pr.rating)::numeric, 1)
        from public.player_ratings pr
        join public.players p on p.id = pr.player_id
        where p.club_id = c.id
      ),
      'player_rating_count', (
        select count(*)::integer
        from public.player_ratings pr
        join public.players p on p.id = pr.player_id
        where p.club_id = c.id
      )
    ),
    'squad', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'position', p.position,
        'shirt_number', p.shirt_number,
        'photo_url', p.photo_url,
        'average', ps.average,
        'rating_count', coalesce(ps.rating_count, 0),
        'best_votes', coalesce(ps.best_votes, 0)
      ) order by
        case p.position when 'Вратарь' then 1 when 'Защитник' then 2 when 'Полузащитник' then 3 when 'Нападающий' then 4 else 5 end,
        p.name)
      from public.players p
      left join lateral (
        select round(avg(pr.rating)::numeric, 1) as average,
               count(*)::integer as rating_count,
               count(*) filter (where pr.is_best_player)::integer as best_votes
        from public.player_ratings pr
        where pr.player_id = p.id
      ) ps on true
      where p.club_id = c.id
    ), '[]'::jsonb),
    'matches', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', x.id,
        'league_name', x.league_name,
        'home_team_name', x.home_team_name,
        'away_team_name', x.away_team_name,
        'home_club_id', x.home_club_id,
        'away_club_id', x.away_club_id,
        'match_date', x.match_date,
        'status', x.status,
        'home_score', x.home_score,
        'away_score', x.away_score
      ) order by x.match_date desc)
      from (
        select m.*
        from public.matches m
        where m.home_club_id = c.id or m.away_club_id = c.id
        order by
          case m.status when 'live' then 1 when 'scheduled' then 2 else 3 end,
          case when m.status = 'finished' then null else m.match_date end asc,
          m.match_date desc
        limit 24
      ) x
    ), '[]'::jsonb)
  )
  from public.clubs c
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
      'id', p.id,
      'name', p.name,
      'position', p.position,
      'shirt_number', p.shirt_number,
      'photo_url', p.photo_url,
      'team', p.team,
      'club', case when c.id is null then null else jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'short_name', c.short_name,
        'tla', c.tla,
        'crest_url', c.crest_url
      ) end
    ),
    'stats', jsonb_build_object(
      'average', ps.average,
      'rating_count', coalesce(ps.rating_count, 0),
      'best_votes', coalesce(ps.best_votes, 0),
      'matches_rated', coalesce(ps.matches_rated, 0)
    ),
    'performances', coalesce((
      select jsonb_agg(jsonb_build_object(
        'match_id', x.match_id,
        'average', x.average,
        'rating_count', x.rating_count,
        'best_votes', x.best_votes,
        'league_name', x.league_name,
        'home_team_name', x.home_team_name,
        'away_team_name', x.away_team_name,
        'match_date', x.match_date,
        'home_score', x.home_score,
        'away_score', x.away_score
      ) order by x.match_date desc)
      from (
        select pr.match_id,
               round(avg(pr.rating)::numeric, 1) as average,
               count(*)::integer as rating_count,
               count(*) filter (where pr.is_best_player)::integer as best_votes,
               m.league_name, m.home_team_name, m.away_team_name, m.match_date,
               m.home_score, m.away_score
        from public.player_ratings pr
        join public.matches m on m.id = pr.match_id
        where pr.player_id = p.id
        group by pr.match_id, m.league_name, m.home_team_name, m.away_team_name,
                 m.match_date, m.home_score, m.away_score
        order by m.match_date desc
        limit 20
      ) x
    ), '[]'::jsonb),
    'teammates', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id,
        'name', t.name,
        'position', t.position,
        'shirt_number', t.shirt_number,
        'photo_url', t.photo_url
      ) order by t.name)
      from (
        select teammate.*
        from public.players teammate
        where teammate.club_id = p.club_id and teammate.id <> p.id
        order by teammate.name
        limit 16
      ) t
    ), '[]'::jsonb)
  )
  from public.players p
  left join public.clubs c on c.id = p.club_id
  left join lateral (
    select round(avg(pr.rating)::numeric, 1) as average,
           count(*)::integer as rating_count,
           count(*) filter (where pr.is_best_player)::integer as best_votes,
           count(distinct pr.match_id)::integer as matches_rated
    from public.player_ratings pr
    where pr.player_id = p.id
  ) ps on true
  where p.id = p_player_id;
$function$;

create or replace function public.search_footbazed(
  p_query text,
  p_limit integer default 14
)
returns table (
  entity_type text,
  entity_id text,
  title text,
  subtitle text,
  meta text,
  relevance real
)
language sql
stable
security invoker
set search_path = ''
as $function$
  with input as (
    select lower(btrim(coalesce(p_query, ''))) as query,
           least(greatest(coalesce(p_limit, 14), 1), 24) as result_limit
  ),
  club_results as (
    select distinct on (c.id)
      'club'::text as entity_type,
      c.id::text as entity_id,
      c.name as title,
      coalesce(nullif(c.area_name, ''), 'Клуб') as subtitle,
      c.tla as meta,
      greatest(
        case
          when lower(c.name) = i.query or lower(ca.alias) = i.query then 1.0
          when left(lower(c.name), char_length(i.query)) = i.query then 0.96
          when position(i.query in lower(c.name || ' ' || ca.alias)) > 0 then 0.88
          else 0.0
        end,
        extensions.similarity(lower(c.name || ' ' || ca.alias), i.query)
      )::real as relevance
    from public.clubs c
    join public.club_aliases ca on ca.club_id = c.id
    cross join input i
    where char_length(i.query) >= 2
      and (
        position(i.query in lower(c.name || ' ' || ca.alias)) > 0
        or extensions.similarity(lower(c.name || ' ' || ca.alias), i.query) >= 0.2
      )
    order by c.id, relevance desc
  ),
  player_results as (
    select
      'player'::text as entity_type,
      p.id::text as entity_id,
      p.name as title,
      coalesce(c.short_name, c.name, p.team) as subtitle,
      p.position as meta,
      greatest(
        case
          when lower(p.name) = i.query then 1.0
          when left(lower(p.name), char_length(i.query)) = i.query then 0.95
          when position(i.query in lower(p.name)) > 0 then 0.87
          else 0.0
        end,
        extensions.similarity(lower(p.name), i.query)
      )::real as relevance
    from public.players p
    left join public.clubs c on c.id = p.club_id
    cross join input i
    where char_length(i.query) >= 2
      and (
        position(i.query in lower(p.name)) > 0
        or extensions.similarity(lower(p.name), i.query) >= 0.28
      )
  ),
  match_results as (
    select
      'match'::text as entity_type,
      m.id::text as entity_id,
      m.home_team_name || ' — ' || m.away_team_name as title,
      m.league_name as subtitle,
      m.status as meta,
      greatest(
        case
          when position(i.query in lower(m.home_team_name || ' ' || m.away_team_name || ' ' || m.league_name)) > 0 then 0.82
          else 0.0
        end,
        extensions.similarity(lower(m.home_team_name || ' ' || m.away_team_name || ' ' || m.league_name), i.query)
      )::real as relevance
    from public.matches m
    cross join input i
    where char_length(i.query) >= 2
      and (
        position(i.query in lower(m.home_team_name || ' ' || m.away_team_name || ' ' || m.league_name)) > 0
        or extensions.similarity(lower(m.home_team_name || ' ' || m.away_team_name || ' ' || m.league_name), i.query) >= 0.2
      )
  ),
  user_results as (
    select
      'user'::text as entity_type,
      u.id::text as entity_id,
      coalesce(nullif(u.display_name, ''), u.username, 'Пользователь') as title,
      case when u.username is null then 'Профиль' else '@' || u.username end as subtitle,
      'Профиль'::text as meta,
      greatest(
        case
          when lower(coalesce(u.username, '')) = i.query then 1.0
          when left(lower(coalesce(u.username, '')), char_length(i.query)) = i.query then 0.95
          when position(i.query in lower(coalesce(u.display_name, '') || ' ' || coalesce(u.username, ''))) > 0 then 0.84
          else 0.0
        end,
        extensions.similarity(lower(coalesce(u.display_name, '') || ' ' || coalesce(u.username, '')), i.query)
      )::real as relevance
    from public.users u
    cross join input i
    where char_length(i.query) >= 2
      and (u.is_public = true or u.id = auth.uid())
      and (
        position(i.query in lower(coalesce(u.display_name, '') || ' ' || coalesce(u.username, ''))) > 0
        or extensions.similarity(lower(coalesce(u.display_name, '') || ' ' || coalesce(u.username, '')), i.query) >= 0.25
      )
  ),
  combined as (
    select * from club_results
    union all select * from player_results
    union all select * from match_results
    union all select * from user_results
  ),
  ranked as (
    select c.*,
           row_number() over (partition by c.entity_type order by c.relevance desc, c.title) as type_position
    from combined c
  )
  select r.entity_type, r.entity_id, r.title, r.subtitle, r.meta, r.relevance
  from ranked r
  where r.type_position <= case r.entity_type
    when 'club' then 4 when 'player' then 4 when 'match' then 5 when 'user' then 3 else 2 end
  order by r.relevance desc,
           case r.entity_type when 'club' then 1 when 'player' then 2 when 'match' then 3 else 4 end,
           r.title
  limit (select result_limit from input);
$function$;

revoke all on function public.get_club_page(bigint) from public;
revoke all on function public.get_player_page(bigint) from public;
revoke all on function public.search_footbazed(text, integer) from public;
grant execute on function public.get_club_page(bigint) to anon, authenticated;
grant execute on function public.get_player_page(bigint) to anon, authenticated;
grant execute on function public.search_footbazed(text, integer) to anon, authenticated;

notify pgrst, 'reload schema';
