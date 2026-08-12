create index if not exists ratings_public_created_id_idx
  on public.ratings (created_at desc, id desc)
  where is_public = true;

create or replace function public.get_social_feed_page(
  p_scope text default 'all',
  p_limit integer default 12,
  p_cursor_created_at timestamptz default null,
  p_cursor_rating_id integer default null,
  p_cursor_score integer default null
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

revoke all on function public.get_social_feed_page(text, integer, timestamptz, integer, integer) from public;
grant execute on function public.get_social_feed_page(text, integer, timestamptz, integer, integer) to anon, authenticated;
