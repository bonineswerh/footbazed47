create index if not exists ratings_user_public_created_idx
  on public.ratings (user_id, is_public, created_at desc);

create or replace function public.get_leaderboard(p_metric text default 'likes', p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  requested_metric text := lower(btrim(coalesce(p_metric, 'likes')));
  requested_limit integer := least(greatest(coalesce(p_limit, 50), 3), 100);
  result jsonb;
begin
  if requested_metric not in ('likes', 'ratings') then
    raise exception using errcode = '22023', message = 'invalid_leaderboard_metric';
  end if;

  with ranked as (
    select
      u.id, u.username, u.display_name,
      case when u.avatar_url ~ '^https?://' and char_length(u.avatar_url) <= 2048 then u.avatar_url else null end as avatar_url,
      coalesce(u.ratings_count, 0)::integer as rating_count,
      coalesce(activity.like_count, 0) as like_count
    from public.users u
    left join lateral (
      select count(*)::integer as like_count
      from public.rating_likes rl
      join public.ratings r on r.id = rl.rating_id
      where r.user_id = u.id and r.is_public = true
    ) activity on true
    where u.is_public = true
    order by
      case when requested_metric = 'likes' then coalesce(activity.like_count, 0) end desc,
      case when requested_metric = 'ratings' then coalesce(u.ratings_count, 0) end desc,
      coalesce(u.ratings_count, 0) desc,
      u.created_at asc,
      u.id
    limit requested_limit
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'username', r.username,
    'display_name', r.display_name,
    'avatar_url', r.avatar_url,
    'tl', r.like_count,
    'rc', r.rating_count
  )), '[]'::jsonb)
  into result
  from ranked r;

  return result;
end
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
begin
  if p_user_id is null then
    raise exception using errcode = '22023', message = 'user_required';
  end if;

  if not exists (
    select 1 from public.users u
    where u.id = p_user_id
      and (
        u.is_public = true or u.id = current_user_id
        or exists (
          select 1 from public.friendships f
          where f.status = 'accepted'
            and ((f.user_id = current_user_id and f.friend_id = u.id)
              or (f.friend_id = current_user_id and f.user_id = u.id))
        )
      )
  ) then
    return null;
  end if;

  select jsonb_build_object(
    'id', u.id,
    'username', u.username,
    'display_name', u.display_name,
    'avatar_url', u.avatar_url,
    'bio', u.bio,
    'favorite_teams', u.favorite_teams,
    'ratings_count', coalesce(u.ratings_count, 0),
    'avg_rating', coalesce(u.avg_rating, 0),
    'streak', coalesce(u.streak, 0),
    'streak_date', u.streak_date,
    'is_public', u.is_public,
    'created_at', u.created_at,
    'invite_code', case when u.id = current_user_id then u.invite_code else null end,
    'is_admin', case when u.id = current_user_id then u.is_admin else false end
  ) into profile_data
  from public.users u
  where u.id = p_user_id;

  select jsonb_build_object(
    'friend_count', (
      select count(distinct case when f.user_id = p_user_id then f.friend_id else f.user_id end)::integer
      from public.friendships f
      where f.status = 'accepted' and (f.user_id = p_user_id or f.friend_id = p_user_id)
    ),
    'like_count', (
      select count(*)::integer
      from public.rating_likes rl
      join public.ratings r on r.id = rl.rating_id
      where r.user_id = p_user_id and (r.is_public = true or p_user_id = current_user_id)
    )
  ) into stats_data;

  if current_user_id is not null and current_user_id <> p_user_id then
    select jsonb_build_object(
      'status', f.status,
      'direction', case when f.user_id = current_user_id then 'outgoing' else 'incoming' end
    ) into friendship_data
    from public.friendships f
    where (f.user_id = current_user_id and f.friend_id = p_user_id)
       or (f.friend_id = current_user_id and f.user_id = p_user_id)
    order by case f.status when 'accepted' then 1 when 'pending' then 2 else 3 end,
             case when f.user_id = current_user_id then 1 else 2 end
    limit 1;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', x.id,
    'user_id', x.user_id,
    'match_id', x.match_id,
    'match_rating', x.match_rating,
    'comment', x.comment,
    'is_public', x.is_public,
    'created_at', x.created_at,
    'match', jsonb_build_object(
      'id', x.match_id,
      'home_team_name', x.home_team_name,
      'away_team_name', x.away_team_name,
      'league_name', x.league_name
    )
  ) order by x.created_at desc, x.id desc), '[]'::jsonb)
  into ratings_data
  from (
    select r.id, r.user_id, r.match_id, r.match_rating, r.comment, r.is_public, r.created_at,
           m.home_team_name, m.away_team_name, m.league_name
    from public.ratings r
    join public.matches m on m.id = r.match_id
    where r.user_id = p_user_id and (r.is_public = true or p_user_id = current_user_id)
    order by r.created_at desc, r.id desc
    limit requested_limit
  ) x;

  return jsonb_build_object(
    'profile', profile_data,
    'stats', stats_data,
    'friendship', friendship_data,
    'ratings', ratings_data
  );
end
$function$;

revoke all on function public.get_leaderboard(text, integer) from public;
revoke all on function public.get_profile_page(uuid, integer) from public;
grant execute on function public.get_leaderboard(text, integer) to anon, authenticated;
grant execute on function public.get_profile_page(uuid, integer) to anon, authenticated;

notify pgrst, 'reload schema';
