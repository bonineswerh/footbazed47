-- Personal, mutual signed-in visibility. Football aggregates retain their fixed public scope.
-- No historical rating, friendship or notification is deleted by a block.
create table private.community_user_blocks (
  user_id uuid not null references auth.users(id) on delete cascade,
  blocked_user_id uuid not null references auth.users(id) on delete cascade,
  username text not null,
  display_name text,
  created_at timestamptz not null default now(),
  primary key (user_id, blocked_user_id),
  constraint community_user_blocks_not_self check(user_id <> blocked_user_id)
);
create index community_user_blocks_reverse_idx on private.community_user_blocks(blocked_user_id, user_id);
create index community_user_blocks_page_idx on private.community_user_blocks(user_id, created_at desc, blocked_user_id);
alter table private.community_user_blocks enable row level security;
revoke all on private.community_user_blocks from public, anon, authenticated, service_role;
comment on table private.community_user_blocks is 'Closed personal block pairs and previously visible labels. No client table access; only the owner RPC can list outgoing blocks.';

create function private.community_pair_is_clear(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = '' as $function$
  select a is null or b is null or a=b or not exists(
    select 1 from private.community_user_blocks x
    where (x.user_id=a and x.blocked_user_id=b) or (x.user_id=b and x.blocked_user_id=a)
  );
$function$;
revoke all on function private.community_pair_is_clear(uuid,uuid) from public, anon, authenticated, service_role;
-- Policies store the function OID. This does not grant private schema USAGE or expose a Data API RPC.
grant execute on function private.community_pair_is_clear(uuid,uuid) to anon, authenticated;

create function public.set_user_block(p_user_id uuid, p_blocked boolean)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare
  actor uuid := auth.uid();
  target public.users;
  changed_rows integer;
begin
  if actor is null or not exists(select 1 from public.users where id=actor) then
    raise exception using errcode='42501',message='auth_required';
  end if;
  if p_user_id is null or p_user_id=actor or p_blocked is null then
    raise exception using errcode='22023',message='invalid_block';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    least(actor::text,p_user_id::text)||':'||greatest(actor::text,p_user_id::text),0));
  if not p_blocked then
    delete from private.community_user_blocks where user_id=actor and blocked_user_id=p_user_id;
    get diagnostics changed_rows=row_count;
  elsif exists(select 1 from private.community_user_blocks where user_id=actor and blocked_user_id=p_user_id) then
    changed_rows:=0;
  else
    -- An incoming block does not reveal its author. Public/accepted-friend visibility is required.
    select * into target from public.users u where u.id=p_user_id
      and private.community_pair_is_clear(actor,u.id) and (u.is_public or public.is_user_visible(u.id));
    if target.id is null then raise exception using errcode='42501',message='user_unavailable'; end if;
    insert into private.community_user_blocks(user_id,blocked_user_id,username,display_name)
      values(actor,p_user_id,left(coalesce(target.username,'Пользователь'),80),left(target.display_name,120));
    changed_rows:=1;
  end if;
  return jsonb_build_object('user_id',p_user_id,'blocked',p_blocked,'changed',changed_rows>0);
end;
$function$;
revoke all on function public.set_user_block(uuid,boolean) from public, anon, authenticated, service_role;
grant execute on function public.set_user_block(uuid,boolean) to authenticated;

create function public.get_my_user_blocks(p_offset integer default 0, p_limit integer default 10)
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
declare
  actor uuid:=auth.uid();
  page_offset integer:=greatest(coalesce(p_offset,0),0);
  page_size integer:=least(greatest(coalesce(p_limit,10),1),20);
  total bigint;
  items jsonb;
begin
  if actor is null then raise exception using errcode='42501',message='auth_required'; end if;
  if page_offset>10000 then raise exception using errcode='22023',message='invalid_block_page'; end if;
  select count(*) into total from private.community_user_blocks where user_id=actor;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.user_id),'[]'::jsonb) into items from(
    select blocked_user_id user_id,username,display_name,created_at
    from private.community_user_blocks where user_id=actor
    order by created_at desc,blocked_user_id offset page_offset limit page_size
  ) x;
  return jsonb_build_object('items',items,'total',total,'has_more',page_offset+jsonb_array_length(items)<total);
end;
$function$;
revoke all on function public.get_my_user_blocks(integer,integer) from public, anon, authenticated, service_role;
grant execute on function public.get_my_user_blocks(integer,integer) to authenticated;

create policy "Personal blocks hide profiles" on public.users as restrictive for select to anon, authenticated
  using(private.community_pair_is_clear((select auth.uid()),id));
create policy "Personal blocks hide ratings" on public.ratings as restrictive for select to anon, authenticated
  using(private.community_pair_is_clear((select auth.uid()),user_id));
create policy "Personal blocks hide player votes" on public.player_ratings as restrictive for select to anon, authenticated
  using(private.community_pair_is_clear((select auth.uid()),user_id));
create policy "Personal blocks hide comments" on public.rating_comments as restrictive for select to anon, authenticated
  using(private.community_pair_is_clear((select auth.uid()),user_id) and exists(
    select 1 from public.ratings r where r.id=rating_comments.rating_id
  ));
create policy "Personal blocks hide reactions" on public.rating_likes as restrictive for select to anon, authenticated
  using(private.community_pair_is_clear((select auth.uid()),user_id));
create policy "Personal blocks hide friendships" on public.friendships as restrictive for select to authenticated
  using(private.community_pair_is_clear(user_id,friend_id));
create policy "Personal blocks hide notifications" on public.notifications as restrictive for select to authenticated
  using(private.community_pair_is_clear(user_id,from_user_id));
create policy "Personal blocks restrict notification updates" on public.notifications as restrictive for update to authenticated
  using(private.community_pair_is_clear(user_id,from_user_id)) with check(private.community_pair_is_clear(user_id,from_user_id));

-- Defense in depth for positive social writes, including existing SECURITY DEFINER mutations.
-- Shared pair locks serialize block/unblock with friendship acceptance, comments and reactions.
create function private.enforce_community_contact()
returns trigger language plpgsql security definer set search_path = '' as $function$
declare
  actor uuid;
  target uuid;
begin
  -- Historical service imports/restoration have no user JWT. They keep their existing ACLs.
  -- Every exposed positive-write RPC independently requires auth.uid().
  if auth.uid() is null then return new; end if;
  if tg_table_name='friendships' then
    if new.status not in ('pending','accepted') then return new; end if;
    actor:=new.user_id; target:=new.friend_id;
  elsif tg_table_name='notifications' then
    actor:=new.from_user_id; target:=new.user_id;
  else
    actor:=new.user_id;
    select r.user_id into target from public.ratings r where r.id=new.rating_id;
  end if;
  if actor is null or target is null or actor=target then return new; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    least(actor::text,target::text)||':'||greatest(actor::text,target::text),0));
  if not private.community_pair_is_clear(actor,target) then
    -- Returning NULL for a notification suppresses that side effect, including imports.
    if tg_table_name='notifications' then return null; end if;
    raise exception using errcode='42501',message='user_unavailable';
  end if;
  return new;
end;
$function$;
revoke all on function private.enforce_community_contact() from public, anon, authenticated, service_role;
create trigger community_contact_guard before insert or update on public.friendships
  for each row execute function private.enforce_community_contact();
create trigger community_contact_guard before insert or update on public.rating_comments
  for each row execute function private.enforce_community_contact();
create trigger community_contact_guard before insert or update on public.rating_likes
  for each row execute function private.enforce_community_contact();
create trigger community_contact_guard before insert on public.notifications
  for each row execute function private.enforce_community_contact();

CREATE OR REPLACE FUNCTION public.are_friends(p_user_a uuid, p_user_b uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select private.community_pair_is_clear(p_user_a,p_user_b) and exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.user_id = p_user_a and f.friend_id = p_user_b)
        or (f.user_id = p_user_b and f.friend_id = p_user_a))
  );
$function$;

CREATE OR REPLACE FUNCTION public.get_leaderboard(p_metric text DEFAULT 'likes'::text, p_limit integer DEFAULT 50)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  requested_metric text := lower(btrim(coalesce(p_metric, 'likes')));
  requested_limit integer := least(greatest(coalesce(p_limit, 50), 3), 100);
  result jsonb;
begin
  if requested_metric not in ('likes', 'ratings') then
    raise exception using errcode = '22023', message = 'invalid_leaderboard_metric';
  end if;
  with ranked as (
    select u.id, u.username, u.display_name,
      case when u.avatar_url ~ '^https?://' and char_length(u.avatar_url) <= 2048 then u.avatar_url else null end as avatar_url,
      coalesce(u.ratings_count, 0)::integer as rating_count,
      coalesce(activity.like_count, 0) as like_count
    from public.users u
    left join lateral (
      select count(*)::integer as like_count
      from public.rating_likes rl join public.ratings r on r.id = rl.rating_id
      where r.user_id = u.id and r.is_public = true
    ) activity on true
    where u.is_public = true and private.community_pair_is_clear(auth.uid(),u.id)
    order by
      case when requested_metric = 'likes' then coalesce(activity.like_count, 0) end desc,
      case when requested_metric = 'ratings' then coalesce(u.ratings_count, 0) end desc,
      coalesce(u.ratings_count, 0) desc, u.created_at asc, u.id
    limit requested_limit
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id, 'username', r.username, 'display_name', r.display_name,
    'avatar_url', r.avatar_url, 'tl', r.like_count, 'rc', r.rating_count
  )), '[]'::jsonb) into result from ranked r;
  return result;
end
$function$;

CREATE OR REPLACE FUNCTION public.get_profile_page(p_user_id uuid, p_rating_limit integer DEFAULT 50)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := auth.uid();
  requested_limit integer := least(greatest(coalesce(p_rating_limit, 50), 1), 100);
  profile_data jsonb;
  stats_data jsonb;
  friendship_data jsonb;
  ratings_data jsonb;
  favorite_clubs_data jsonb;
  rating_summary_data jsonb;
begin
  if p_user_id is null then raise exception using errcode = '22023', message = 'user_required'; end if;
  if not private.community_pair_is_clear(current_user_id,p_user_id) then return null; end if;
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
  left join public.media_assets ma on ma.id = c.logo_asset_id and public.is_displayable_media_asset(ma)
  where fc.user_id = p_user_id;

  select jsonb_build_object(
    'friend_count', (select count(distinct case when f.user_id = p_user_id then f.friend_id else f.user_id end)::integer from public.friendships f where f.status = 'accepted' and private.community_pair_is_clear(f.user_id,f.friend_id) and (f.user_id = p_user_id or f.friend_id = p_user_id)),
    'like_count', (select count(*)::integer from public.rating_likes rl join public.ratings r on r.id = rl.rating_id where r.user_id = p_user_id and (r.is_public = true or p_user_id = current_user_id) and private.community_pair_is_clear(current_user_id,rl.user_id))
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

  with visible as materialized (
    select r.match_rating,btrim(coalesce(r.comment,''))<>'' has_review,m.competition_id
    from public.ratings r join public.matches m on m.id=r.match_id
    where r.user_id=p_user_id and (r.is_public=true or p_user_id=current_user_id)
  ), totals as materialized (
    select count(*) total,round(avg(match_rating),1) average,
      count(*) filter(where has_review) reviewed,min(match_rating) minimum,max(match_rating) maximum
    from visible
  ), bins as materialized (
    select match_rating,count(*) votes from visible group by match_rating
  ), tournaments as materialized (
    select v.competition_id,count(*) votes,round(avg(v.match_rating),1) average
    from visible v where v.competition_id is not null group by v.competition_id
  )
  select jsonb_build_object(
    'scope',case when p_user_id=current_user_id then 'own' else 'public' end,
    'total',(select total from totals),
    'average',(select average from totals),
    'reviewed',(select reviewed from totals),
    'minimum',(select minimum from totals),
    'maximum',(select maximum from totals),
    'tournament_count',(select count(*) from tournaments),
    'distribution',(select jsonb_agg(jsonb_build_object('rating',n,'count',coalesce(b.votes,0)) order by n desc)
      from generate_series(1,10) n left join bins b on b.match_rating=n),
    'tournaments',coalesce((select jsonb_agg(to_jsonb(x) order by x.votes desc,x.id) from (
      select c.id,coalesce(c.short_name,c.name) name,t.votes,t.average
      from tournaments t join public.competitions c on c.id=t.competition_id
      order by t.votes desc,c.id limit 6
    ) x),'[]'::jsonb)
  ) into rating_summary_data;

  -- Old clients read these existing fields; give them the same permitted scope.
  -- Do not rewrite stored user counters or expose private averages via this RPC.
  profile_data := profile_data || jsonb_build_object(
    'ratings_count',rating_summary_data->'total',
    'avg_rating',coalesce(rating_summary_data->'average','0'::jsonb));

  return jsonb_build_object('profile', profile_data, 'favorite_clubs', favorite_clubs_data,
    'stats', stats_data, 'friendship', friendship_data, 'ratings', ratings_data,
    'rating_summary',rating_summary_data);
end
$function$;

CREATE OR REPLACE FUNCTION public.get_rating_comments(p_rating_id integer, p_limit integer DEFAULT 60)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', x.id, 'user_id', x.user_id, 'comment', x.comment,
    'created_at', x.created_at, 'updated_at', x.updated_at, 'edited_at', x.edited_at,
    'can_edit', coalesce(x.user_id = auth.uid(), false),
    'can_delete', coalesce(x.user_id = auth.uid(), false),
    'user', jsonb_build_object('username', x.username, 'display_name', x.display_name, 'avatar_url', x.avatar_url)
  ) order by x.created_at), '[]'::jsonb)
  from (
    select rc.id, rc.user_id, rc.comment, rc.created_at, rc.updated_at, rc.edited_at,
      u.username, u.display_name,
      case when u.avatar_url ~ '^https?://' and char_length(u.avatar_url) <= 2048 then u.avatar_url end avatar_url
    from public.rating_comments rc
    join public.ratings r on r.id = rc.rating_id
    join public.users u on u.id = rc.user_id
    where rc.rating_id = p_rating_id and (r.is_public = true or r.user_id = auth.uid())
      and private.community_pair_is_clear(auth.uid(),r.user_id) and private.community_pair_is_clear(auth.uid(),rc.user_id)
    order by rc.created_at
    limit least(greatest(coalesce(p_limit, 60), 1), 100)
  ) x;
$function$;

CREATE OR REPLACE FUNCTION public.get_social_feed(p_scope text DEFAULT 'all'::text, p_limit integer DEFAULT 12, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := auth.uid();
  requested_scope text := lower(coalesce(p_scope, 'all'));
  requested_limit integer := least(greatest(coalesce(p_limit, 12), 1), 30);
  requested_offset integer := least(greatest(coalesce(p_offset, 0), 0), 300);
  result jsonb;
begin
  if requested_scope not in ('all', 'friends', 'popular', 'mine') then
    raise exception using errcode = '22023', message = 'invalid_feed_scope';
  end if;

  with feed_base as (
    select
      r.id as rating_id,
      r.user_id,
      r.match_id,
      r.match_rating,
      r.comment,
      r.created_at,
      r.updated_at,
      u.username,
      u.display_name,
      case
        when u.avatar_url ~ '^https?://' and char_length(u.avatar_url) <= 2048 then u.avatar_url
        else null
      end as avatar_url,
      m.league_name,
      m.home_team_name,
      m.away_team_name,
      m.home_club_id,
      m.away_club_id,
      m.match_date,
      m.home_score,
      m.away_score,
      (select count(*)::integer from public.rating_likes rl where rl.rating_id = r.id and private.community_pair_is_clear(current_user_id,rl.user_id)) as like_count,
      (select count(*)::integer from public.rating_comments rc where rc.rating_id = r.id and private.community_pair_is_clear(current_user_id,rc.user_id)) as comment_count,
      exists (
        select 1 from public.rating_likes rl
        where rl.rating_id = r.id and rl.user_id = current_user_id
      ) as liked_by_me,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'player_id', highlights.player_id,
          'name', highlights.name,
          'club_id', highlights.club_id,
          'team', highlights.team,
          'rating', highlights.rating,
          'is_best_player', highlights.is_best_player
        ) order by highlights.is_best_player desc, highlights.rating desc, highlights.name)
        from (
          select pr.player_id, p.name, p.club_id, p.team, pr.rating, pr.is_best_player
          from public.player_ratings pr
          join public.players p on p.id = pr.player_id
          where pr.user_id = r.user_id and pr.match_id = r.match_id
          order by pr.is_best_player desc, pr.rating desc, p.name
          limit 3
        ) highlights
      ), '[]'::jsonb) as player_highlights
    from public.ratings r
    join public.users u on u.id = r.user_id
    join public.matches m on m.id = r.match_id
    where r.is_public = true and private.community_pair_is_clear(current_user_id,r.user_id)
      and (
        u.is_public = true
        or u.id = current_user_id
        or exists (
          select 1 from public.friendships visible_friend
          where visible_friend.status = 'accepted'
            and (
              (visible_friend.user_id = current_user_id and visible_friend.friend_id = u.id)
              or (visible_friend.friend_id = current_user_id and visible_friend.user_id = u.id)
            )
        )
      )
      and case requested_scope
        when 'friends' then current_user_id is not null and exists (
          select 1 from public.friendships f
          where f.status = 'accepted'
            and (
              (f.user_id = current_user_id and f.friend_id = r.user_id)
              or (f.friend_id = current_user_id and f.user_id = r.user_id)
            )
        )
        when 'mine' then current_user_id is not null and r.user_id = current_user_id
        else true
      end
  ),
  ordered_feed as (
    select fb.*,
           (fb.like_count * 3 + fb.comment_count * 2 + case when fb.comment is null then 0 else 1 end) as engagement_score
    from feed_base fb
    order by
      case when requested_scope = 'popular' then (fb.like_count * 3 + fb.comment_count * 2 + case when fb.comment is null then 0 else 1 end) end desc,
      fb.created_at desc,
      fb.rating_id desc
    offset requested_offset
    limit requested_limit + 1
  ),
  numbered as (
    select of.*, row_number() over () as row_position
    from ordered_feed of
  )
  select jsonb_build_object(
    'items', coalesce(jsonb_agg(jsonb_build_object(
      'rating_id', n.rating_id,
      'user_id', n.user_id,
      'match_id', n.match_id,
      'match_rating', n.match_rating,
      'comment', n.comment,
      'created_at', n.created_at,
      'updated_at', n.updated_at,
      'user', jsonb_build_object(
        'username', n.username,
        'display_name', n.display_name,
        'avatar_url', n.avatar_url
      ),
      'match', jsonb_build_object(
        'league_name', n.league_name,
        'home_team_name', n.home_team_name,
        'away_team_name', n.away_team_name,
        'home_club_id', n.home_club_id,
        'away_club_id', n.away_club_id,
        'match_date', n.match_date,
        'home_score', n.home_score,
        'away_score', n.away_score
      ),
      'like_count', n.like_count,
      'comment_count', n.comment_count,
      'liked_by_me', n.liked_by_me,
      'player_highlights', n.player_highlights
    ) order by n.row_position) filter (where n.row_position <= requested_limit), '[]'::jsonb),
    'has_more', coalesce(bool_or(n.row_position > requested_limit), false),
    'next_offset', requested_offset + least(count(*)::integer, requested_limit)
  ) into result
  from numbered n;

  return coalesce(result, jsonb_build_object('items', '[]'::jsonb, 'has_more', false, 'next_offset', requested_offset));
end
$function$;

CREATE OR REPLACE FUNCTION public.get_social_feed_page(p_scope text DEFAULT 'all'::text, p_limit integer DEFAULT 12, p_cursor_created_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_cursor_rating_id integer DEFAULT NULL::integer, p_cursor_score integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := auth.uid();
  requested_scope text := lower(coalesce(p_scope, 'all'));
  requested_limit integer := least(greatest(coalesce(p_limit, 12), 1), 30);
  has_cursor boolean := p_cursor_created_at is not null;
  result jsonb;
begin
  if requested_scope not in ('all', 'friends', 'popular', 'mine') then
    raise exception using errcode = '22023', message = 'invalid_feed_scope';
  end if;

  if (p_cursor_created_at is null)::integer
     + (p_cursor_rating_id is null)::integer
     + (p_cursor_score is null)::integer not in (0, 3) then
    raise exception using errcode = '22023', message = 'invalid_feed_cursor';
  end if;

  if p_cursor_score is not null and p_cursor_score < 0 then
    raise exception using errcode = '22023', message = 'invalid_feed_cursor';
  end if;

  with feed_base as (
    select
      r.id as rating_id,
      r.user_id,
      r.match_id,
      r.match_rating,
      r.comment,
      r.created_at,
      r.updated_at,
      u.username,
      u.display_name,
      case
        when u.avatar_url ~ '^https?://' and char_length(u.avatar_url) <= 2048 then u.avatar_url
        else null
      end as avatar_url,
      m.league_name,
      m.home_team_name,
      m.away_team_name,
      m.home_club_id,
      m.away_club_id,
      m.match_date,
      m.home_score,
      m.away_score,
      (select count(*)::integer from public.rating_likes rl where rl.rating_id = r.id and private.community_pair_is_clear(current_user_id,rl.user_id)) as like_count,
      (select count(*)::integer from public.rating_comments rc where rc.rating_id = r.id and private.community_pair_is_clear(current_user_id,rc.user_id)) as comment_count,
      exists (
        select 1 from public.rating_likes rl
        where rl.rating_id = r.id and rl.user_id = current_user_id
      ) as liked_by_me,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'player_id', highlights.player_id,
          'name', highlights.name,
          'club_id', highlights.club_id,
          'team', highlights.team,
          'rating', highlights.rating,
          'is_best_player', highlights.is_best_player
        ) order by highlights.is_best_player desc, highlights.rating desc, highlights.name)
        from (
          select pr.player_id, p.name, p.club_id, p.team, pr.rating, pr.is_best_player
          from public.player_ratings pr
          join public.players p on p.id = pr.player_id
          where pr.user_id = r.user_id and pr.match_id = r.match_id
          order by pr.is_best_player desc, pr.rating desc, p.name
          limit 3
        ) highlights
      ), '[]'::jsonb) as player_highlights
    from public.ratings r
    join public.users u on u.id = r.user_id
    join public.matches m on m.id = r.match_id
    where r.is_public = true and private.community_pair_is_clear(current_user_id,r.user_id)
      and (
        u.is_public = true
        or u.id = current_user_id
        or exists (
          select 1 from public.friendships visible_friend
          where visible_friend.status = 'accepted'
            and (
              (visible_friend.user_id = current_user_id and visible_friend.friend_id = u.id)
              or (visible_friend.friend_id = current_user_id and visible_friend.user_id = u.id)
            )
        )
      )
      and case requested_scope
        when 'friends' then current_user_id is not null and exists (
          select 1 from public.friendships f
          where f.status = 'accepted'
            and (
              (f.user_id = current_user_id and f.friend_id = r.user_id)
              or (f.friend_id = current_user_id and f.user_id = r.user_id)
            )
        )
        when 'mine' then current_user_id is not null and r.user_id = current_user_id
        else true
      end
  ),
  scored_feed as (
    select fb.*,
      (fb.like_count * 3 + fb.comment_count * 2 + case when fb.comment is null then 0 else 1 end) as engagement_score
    from feed_base fb
  ),
  page_rows as (
    select sf.*
    from scored_feed sf
    where not has_cursor
      or (
        requested_scope = 'popular'
        and (
          sf.engagement_score < p_cursor_score
          or (sf.engagement_score = p_cursor_score and sf.created_at < p_cursor_created_at)
          or (sf.engagement_score = p_cursor_score and sf.created_at = p_cursor_created_at and sf.rating_id < p_cursor_rating_id)
        )
      )
      or (
        requested_scope <> 'popular'
        and (
          sf.created_at < p_cursor_created_at
          or (sf.created_at = p_cursor_created_at and sf.rating_id < p_cursor_rating_id)
        )
      )
    order by
      case when requested_scope = 'popular' then sf.engagement_score end desc,
      sf.created_at desc,
      sf.rating_id desc
    limit requested_limit + 1
  ),
  numbered as (
    select pr.*,
      row_number() over (
        order by
          case when requested_scope = 'popular' then pr.engagement_score end desc,
          pr.created_at desc,
          pr.rating_id desc
      ) as row_position
    from page_rows pr
  )
  select jsonb_build_object(
    'items', coalesce(jsonb_agg(jsonb_build_object(
      'rating_id', n.rating_id,
      'user_id', n.user_id,
      'match_id', n.match_id,
      'match_rating', n.match_rating,
      'comment', n.comment,
      'created_at', n.created_at,
      'updated_at', n.updated_at,
      'user', jsonb_build_object(
        'username', n.username,
        'display_name', n.display_name,
        'avatar_url', n.avatar_url
      ),
      'match', jsonb_build_object(
        'league_name', n.league_name,
        'home_team_name', n.home_team_name,
        'away_team_name', n.away_team_name,
        'home_club_id', n.home_club_id,
        'away_club_id', n.away_club_id,
        'match_date', n.match_date,
        'home_score', n.home_score,
        'away_score', n.away_score
      ),
      'like_count', n.like_count,
      'comment_count', n.comment_count,
      'liked_by_me', n.liked_by_me,
      'player_highlights', n.player_highlights
    ) order by n.row_position) filter (where n.row_position <= requested_limit), '[]'::jsonb),
    'has_more', count(*) > requested_limit,
    'next_cursor', case when count(*) > requested_limit then
      (jsonb_agg(jsonb_build_object(
        'created_at', n.created_at,
        'rating_id', n.rating_id,
        'score', n.engagement_score
      ) order by n.row_position) filter (where n.row_position = requested_limit))->0
      else null
    end
  ) into result
  from numbered n;

  return coalesce(result, jsonb_build_object('items', '[]'::jsonb, 'has_more', false, 'next_cursor', null));
end
$function$;

CREATE OR REPLACE FUNCTION public.has_accepted_inverse_friendship(requester uuid, recipient uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select private.community_pair_is_clear(requester,recipient) and requester = (select auth.uid())
    and exists (
      select 1
      from public.friendships f
      where f.user_id = recipient
        and f.friend_id = requester
        and f.status = 'accepted'
    );
$function$;

CREATE OR REPLACE FUNCTION public.is_user_visible(p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select private.community_pair_is_clear(auth.uid(),p_user_id) and (
    p_user_id = auth.uid()
    or exists (
      select 1
      from public.friendships f
      where f.status = 'accepted'
        and (
          (f.user_id = auth.uid() and f.friend_id = p_user_id)
          or (f.friend_id = auth.uid() and f.user_id = p_user_id)
        )
    ));
$function$;

CREATE OR REPLACE FUNCTION public.request_friendship(p_friend_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'auth_required';
  end if;
  if p_friend_id is null or p_friend_id = current_user_id then
    raise exception using errcode = '22023', message = 'invalid_friend';
  end if;
  if not exists (select 1 from public.users u where u.id = p_friend_id) then
    raise exception using errcode = 'P0002', message = 'user_not_found';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      least(current_user_id::text, p_friend_id::text) || ':' ||
      greatest(current_user_id::text, p_friend_id::text),
      0
    )
  );

  if not private.community_pair_is_clear(current_user_id,p_friend_id) then
    raise exception using errcode='42501',message='user_unavailable';
  end if;

  if exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.user_id = current_user_id and f.friend_id = p_friend_id)
        or (f.user_id = p_friend_id and f.friend_id = current_user_id))
  ) then
    return jsonb_build_object('status', 'accepted', 'changed', false);
  end if;

  if exists (
    select 1 from public.friendships f
    where f.user_id = current_user_id and f.friend_id = p_friend_id and f.status = 'pending'
  ) then
    return jsonb_build_object('status', 'pending', 'changed', false);
  end if;

  if exists (
    select 1 from public.friendships f
    where f.user_id = p_friend_id and f.friend_id = current_user_id and f.status = 'pending'
    for update
  ) then
    update public.friendships
    set status = 'accepted'
    where user_id = p_friend_id and friend_id = current_user_id and status = 'pending';

    insert into public.friendships (user_id, friend_id, status)
    values (current_user_id, p_friend_id, 'accepted')
    on conflict (user_id, friend_id) do update set status = 'accepted';

    update public.notifications
    set read = true
    where user_id = current_user_id and from_user_id = p_friend_id
      and type = 'friend_request' and read = false;

    return jsonb_build_object('status', 'accepted', 'changed', true);
  end if;

  delete from public.friendships
  where ((user_id = current_user_id and friend_id = p_friend_id)
      or (user_id = p_friend_id and friend_id = current_user_id))
    and status = 'rejected';

  insert into public.friendships (user_id, friend_id, status)
  values (current_user_id, p_friend_id, 'pending')
  on conflict (user_id, friend_id) do update set status = 'pending';

  return jsonb_build_object('status', 'pending', 'changed', true);
end
$function$;

CREATE OR REPLACE FUNCTION public.respond_friendship(p_requester_id uuid, p_action text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := auth.uid();
  normalized_action text := lower(btrim(coalesce(p_action, '')));
  request_id integer;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'auth_required';
  end if;
  if p_requester_id is null or p_requester_id = current_user_id then
    raise exception using errcode = '22023', message = 'invalid_friend';
  end if;
  if normalized_action not in ('accept', 'reject') then
    raise exception using errcode = '22023', message = 'invalid_friendship_action';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      least(current_user_id::text, p_requester_id::text) || ':' ||
      greatest(current_user_id::text, p_requester_id::text),
      0
    )
  );

  if normalized_action='accept' and not private.community_pair_is_clear(current_user_id,p_requester_id) then
    raise exception using errcode='42501',message='user_unavailable';
  end if;

  select f.id into request_id
  from public.friendships f
  where f.user_id = p_requester_id and f.friend_id = current_user_id and f.status = 'pending'
  for update;

  if request_id is null then
    if normalized_action = 'accept' and exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.user_id = current_user_id and f.friend_id = p_requester_id)
          or (f.user_id = p_requester_id and f.friend_id = current_user_id))
    ) then
      return jsonb_build_object('status', 'accepted', 'changed', false);
    end if;
    raise exception using errcode = 'P0002', message = 'friendship_request_not_found';
  end if;

  if normalized_action = 'accept' then
    update public.friendships set status = 'accepted' where id = request_id;
    insert into public.friendships (user_id, friend_id, status)
    values (current_user_id, p_requester_id, 'accepted')
    on conflict (user_id, friend_id) do update set status = 'accepted';
  else
    delete from public.friendships where id = request_id;
  end if;

  update public.notifications
  set read = true
  where user_id = current_user_id and from_user_id = p_requester_id
    and type = 'friend_request' and read = false;

  return jsonb_build_object(
    'status', case when normalized_action = 'accept' then 'accepted' else 'rejected' end,
    'changed', true
  );
end
$function$;

CREATE OR REPLACE FUNCTION public.submit_community_report(p_target_type text, p_target_id text, p_reason text, p_details text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := auth.uid();
  subject uuid;
  target text := btrim(coalesce(p_target_id,''));
  details text := btrim(coalesce(p_details,''));
  target_number integer;
  target_user uuid;
  captured jsonb;
  existing public.community_reports;
  saved public.community_reports;
begin
  if actor is null or not exists(select 1 from public.users where id=actor) then
    raise exception using errcode='42501',message='auth_required';
  end if;
  if p_target_type is null or p_target_type not in ('rating','comment','profile')
     or p_reason is null or p_reason not in ('harassment','hate','spam','impersonation','other')
     or char_length(details)>1000 then
    raise exception using errcode='22023',message='invalid_report';
  end if;
  if p_target_type='profile' then
    if target !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
      raise exception using errcode='22023',message='invalid_report_target';
    end if;
    target_user:=target::uuid; target:=target_user::text;
    select u.id,jsonb_build_object('username',u.username,'label',coalesce(u.display_name,u.username),'text',left(coalesce(u.bio,''),1000))
      into subject,captured from public.users u
      where u.id=target_user and private.community_pair_is_clear(actor,u.id) and (u.is_public or public.is_user_visible(u.id));
  else
    if target !~ '^[1-9][0-9]{0,9}$' then
      raise exception using errcode='22023',message='invalid_report_target';
    end if;
    if target::bigint>2147483647 then
      raise exception using errcode='22023',message='invalid_report_target';
    end if;
    target_number:=target::integer; target:=target_number::text;
    if p_target_type='rating' then
      select r.user_id,jsonb_build_object('username',u.username,'label',concat_ws(' — ',m.home_team_name,m.away_team_name),'text',left(coalesce(r.comment,''),1000),'match_id',r.match_id)
        into subject,captured from public.ratings r join public.users u on u.id=r.user_id join public.matches m on m.id=r.match_id
        where r.id=target_number and r.is_public and private.community_pair_is_clear(actor,r.user_id) and (u.is_public or public.is_user_visible(u.id));
    else
      -- A comment's existing reader exposes it on public ratings, independently of profile visibility.
      select rc.user_id,jsonb_build_object('username',u.username,'label','Комментарий к оценке матча','text',left(rc.comment,1000),'match_id',r.match_id)
        into subject,captured from public.rating_comments rc join public.ratings r on r.id=rc.rating_id join public.users u on u.id=rc.user_id
        where rc.id=target_number and r.is_public and private.community_pair_is_clear(actor,rc.user_id) and private.community_pair_is_clear(actor,r.user_id);
    end if;
  end if;
  if subject is null or subject=actor then
    raise exception using errcode='42501',message='report_target_unavailable';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('community-report:'||actor::text,0));
  select * into existing from public.community_reports where reporter_id=actor and target_type=p_target_type and target_id=target and status='open';
  if found then
    return jsonb_build_object('id',existing.id,'status',existing.status,'duplicate',true);
  end if;
  if (select count(*) from public.community_reports where reporter_id=actor and created_at>now()-interval '10 minutes')>=5
     or (select count(*) from public.community_reports where reporter_id=actor and created_at>now()-interval '1 day')>=20 then
    raise exception using errcode='P0001',message='report_rate_limit';
  end if;
  insert into public.community_reports(reporter_id,subject_id,target_type,target_id,reason,details,snapshot)
    values(actor,subject,p_target_type,target,p_reason,details,captured) returning * into saved;
  return jsonb_build_object('id',saved.id,'status',saved.status,'duplicate',false);
end;
$function$;

CREATE OR REPLACE FUNCTION public.resolve_invite_code(lookup_code text)
 RETURNS TABLE(id uuid, username text, display_name text, avatar_url text, bio text, favorite_teams text, ratings_count integer, avg_rating numeric, streak integer, is_public boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    u.id, u.username, u.display_name, u.avatar_url, u.bio,
    u.favorite_teams, u.ratings_count, u.avg_rating, u.streak, u.is_public
  from public.users u
  where upper(u.invite_code) = upper(btrim(lookup_code))
    and u.id <> (select auth.uid()) and private.community_pair_is_clear(auth.uid(),u.id)
  limit 1;
$function$;

notify pgrst, 'reload schema';
