alter table public.notifications
  add column if not exists rating_id integer references public.ratings(id) on delete cascade,
  add column if not exists comment_id integer references public.rating_comments(id) on delete cascade;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type = any (array['friend_request'::text, 'like'::text, 'comment'::text, 'system'::text]));

create unique index if not exists notifications_like_once_idx
  on public.notifications (user_id, from_user_id, rating_id, type)
  where type = 'like';
create unique index if not exists notifications_comment_once_idx
  on public.notifications (comment_id)
  where type = 'comment';

create or replace function public.notify_rating_like()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  rating_owner uuid;
  actor_name text;
begin
  select r.user_id into rating_owner
  from public.ratings r
  where r.id = new.rating_id and r.is_public = true;

  if rating_owner is null or rating_owner = new.user_id then
    return new;
  end if;

  select coalesce(nullif(u.display_name, ''), nullif(u.username, ''), 'Пользователь')
  into actor_name
  from public.users u
  where u.id = new.user_id;

  insert into public.notifications (user_id, from_user_id, type, message, rating_id)
  values (rating_owner, new.user_id, 'like', coalesce(actor_name, 'Пользователь') || ' оценил вашу запись', new.rating_id)
  on conflict do nothing;
  return new;
end
$function$;

create or replace function public.notify_rating_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  rating_owner uuid;
  actor_name text;
begin
  select r.user_id into rating_owner
  from public.ratings r
  where r.id = new.rating_id and r.is_public = true;

  if rating_owner is null or rating_owner = new.user_id then
    return new;
  end if;

  select coalesce(nullif(u.display_name, ''), nullif(u.username, ''), 'Пользователь')
  into actor_name
  from public.users u
  where u.id = new.user_id;

  insert into public.notifications (user_id, from_user_id, type, message, rating_id, comment_id)
  values (rating_owner, new.user_id, 'comment', coalesce(actor_name, 'Пользователь') || ' прокомментировал вашу запись', new.rating_id, new.id)
  on conflict do nothing;
  return new;
end
$function$;

drop trigger if exists rating_like_notification on public.rating_likes;
create trigger rating_like_notification
after insert on public.rating_likes
for each row execute function public.notify_rating_like();

drop trigger if exists rating_comment_notification on public.rating_comments;
create trigger rating_comment_notification
after insert on public.rating_comments
for each row execute function public.notify_rating_comment();

drop policy if exists "Public read users" on public.users;
create policy "Read visible users"
on public.users for select
to anon, authenticated
using (
  is_public = true
  or id = (select auth.uid())
  or exists (
    select 1
    from public.friendships f
    where f.status = 'accepted'
      and (
        (f.user_id = (select auth.uid()) and f.friend_id = users.id)
        or (f.friend_id = (select auth.uid()) and f.user_id = users.id)
      )
  )
);

revoke select on table public.users from anon, authenticated;
grant select (
  id, username, display_name, avatar_url, bio, favorite_teams,
  ratings_count, avg_rating, streak, streak_date, is_public, created_at
) on table public.users to anon, authenticated;

create or replace function public.get_social_feed(
  p_scope text default 'all',
  p_limit integer default 12,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
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
      (select count(*)::integer from public.rating_likes rl where rl.rating_id = r.id) as like_count,
      (select count(*)::integer from public.rating_comments rc where rc.rating_id = r.id) as comment_count,
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
    where r.is_public = true
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

create or replace function public.get_rating_comments(
  p_rating_id integer,
  p_limit integer default 60
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', x.id,
    'user_id', x.user_id,
    'comment', x.comment,
    'created_at', x.created_at,
    'can_delete', coalesce(x.user_id = auth.uid(), false),
    'user', jsonb_build_object(
      'username', x.username,
      'display_name', x.display_name,
      'avatar_url', x.avatar_url
    )
  ) order by x.created_at), '[]'::jsonb)
  from (
    select rc.id, rc.user_id, rc.comment, rc.created_at,
           u.username, u.display_name,
           case
             when u.avatar_url ~ '^https?://' and char_length(u.avatar_url) <= 2048 then u.avatar_url
             else null
           end as avatar_url
    from public.rating_comments rc
    join public.ratings r on r.id = rc.rating_id
    join public.users u on u.id = rc.user_id
    where rc.rating_id = p_rating_id
      and (r.is_public = true or r.user_id = auth.uid())
    order by rc.created_at
    limit least(greatest(coalesce(p_limit, 60), 1), 100)
  ) x;
$function$;

create or replace function public.toggle_rating_like(p_rating_id integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  rating_owner uuid;
  existing_like_id integer;
  now_liked boolean;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'auth_required';
  end if;

  select r.user_id into rating_owner
  from public.ratings r
  where r.id = p_rating_id and r.is_public = true;

  if rating_owner is null then
    raise exception using errcode = 'P0002', message = 'rating_not_found';
  end if;
  if rating_owner = current_user_id then
    raise exception using errcode = '22023', message = 'cannot_like_own_rating';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text || ':' || p_rating_id::text, 0)
  );

  select rl.id into existing_like_id
  from public.rating_likes rl
  where rl.user_id = current_user_id and rl.rating_id = p_rating_id;

  if existing_like_id is null then
    insert into public.rating_likes (user_id, rating_id)
    values (current_user_id, p_rating_id);
    now_liked := true;
  else
    delete from public.rating_likes where id = existing_like_id;
    now_liked := false;
  end if;

  return jsonb_build_object(
    'liked', now_liked,
    'like_count', (select count(*)::integer from public.rating_likes rl where rl.rating_id = p_rating_id)
  );
end
$function$;

create or replace function public.add_rating_comment(p_rating_id integer, p_comment text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  clean_comment text := btrim(coalesce(p_comment, ''));
  saved public.rating_comments;
  author public.users;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'auth_required';
  end if;
  if char_length(clean_comment) < 1 or char_length(clean_comment) > 1000 then
    raise exception using errcode = '22023', message = 'invalid_comment';
  end if;
  if not exists (select 1 from public.ratings r where r.id = p_rating_id and r.is_public = true) then
    raise exception using errcode = 'P0002', message = 'rating_not_found';
  end if;

  insert into public.rating_comments (rating_id, user_id, comment)
  values (p_rating_id, current_user_id, clean_comment)
  returning * into saved;

  select * into author from public.users u where u.id = current_user_id;
  return jsonb_build_object(
    'id', saved.id,
    'user_id', saved.user_id,
    'comment', saved.comment,
    'created_at', saved.created_at,
    'can_delete', true,
    'user', jsonb_build_object(
      'username', author.username,
      'display_name', author.display_name,
      'avatar_url', case
        when author.avatar_url ~ '^https?://' and char_length(author.avatar_url) <= 2048 then author.avatar_url
        else null
      end
    )
  );
end
$function$;

create or replace function public.delete_rating_comment(p_comment_id integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  deleted_count integer;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'auth_required';
  end if;

  delete from public.rating_comments rc
  where rc.id = p_comment_id and rc.user_id = current_user_id;
  get diagnostics deleted_count = row_count;
  return deleted_count > 0;
end
$function$;

revoke all on function public.notify_rating_like() from public, anon, authenticated;
revoke all on function public.notify_rating_comment() from public, anon, authenticated;
revoke all on function public.get_social_feed(text, integer, integer) from public;
revoke all on function public.get_rating_comments(integer, integer) from public;
revoke all on function public.toggle_rating_like(integer) from public, anon;
revoke all on function public.add_rating_comment(integer, text) from public, anon;
revoke all on function public.delete_rating_comment(integer) from public, anon;
grant execute on function public.get_social_feed(text, integer, integer) to anon, authenticated;
grant execute on function public.get_rating_comments(integer, integer) to anon, authenticated;
grant execute on function public.toggle_rating_like(integer) to authenticated;
grant execute on function public.add_rating_comment(integer, text) to authenticated;
grant execute on function public.delete_rating_comment(integer) to authenticated;

notify pgrst, 'reload schema';
