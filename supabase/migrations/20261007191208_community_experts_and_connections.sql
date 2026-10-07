-- Editorial roles are assigned by administrators, never by client profile writes.
create table private.community_experts (
  user_id uuid primary key references public.users(id) on delete cascade,
  assigned_by uuid references public.users(id) on delete set null,
  assigned_at timestamptz not null default now()
);
alter table private.community_experts enable row level security;
revoke all on private.community_experts from public,anon,authenticated,service_role;

create function public.admin_community_experts(p_actor uuid,p_username text default null,p_enabled boolean default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare target uuid; result jsonb; name text:=btrim(coalesce(p_username,''));
begin
  if coalesce(auth.role(),'')<>'service_role' or not exists(select 1 from public.users where id=p_actor and is_admin) then
    raise exception using errcode='42501',message='admin_required';
  end if;
  if p_enabled is not null then
    if char_length(name) not between 3 and 30 then raise exception using errcode='22023',message='expert_username_invalid'; end if;
    select id into target from public.users where lower(username)=lower(name);
    if target is null then raise exception using errcode='22023',message='expert_user_not_found'; end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('community-expert:'||target::text,0));
    if p_enabled then insert into private.community_experts(user_id,assigned_by) values(target,p_actor) on conflict(user_id) do nothing;
    else delete from private.community_experts where user_id=target; end if;
    insert into public.admin_audit_logs(actor_id,action,target_type,target_id,metadata)
      values(p_actor,'set_community_expert','user',target::text,jsonb_build_object('enabled',p_enabled));
  end if;
  select jsonb_build_object('items',coalesce(jsonb_agg(x.row order by x.username),'[]'::jsonb)) into result from (
    select u.username,jsonb_build_object('username',u.username,'display_name',u.display_name,'assigned_at',e.assigned_at,'is_public',u.is_public) row
    from private.community_experts e join public.users u on u.id=e.user_id order by u.username limit 100
  ) x;
  return result;
end $$;
revoke all on function public.admin_community_experts(uuid,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.admin_community_experts(uuid,text,boolean) to service_role;

-- Aggregate only: no private friendship rows or mutual-friend identities leave this reader.
create function public.get_community_suggestions(p_offset integer default 0,p_limit integer default 24)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid(); cap integer:=greatest(1,least(coalesce(p_limit,24),30)); skip integer:=greatest(0,least(coalesce(p_offset,0),100000)); result jsonb;
begin
  if actor is null then raise exception using errcode='42501',message='auth_required'; end if;
  with mutuals as materialized (
    select distinct case when f.user_id=actor then f.friend_id else f.user_id end id
    from public.friendships f join public.users u on u.id=case when f.user_id=actor then f.friend_id else f.user_id end
    where f.status='accepted' and actor in(f.user_id,f.friend_id) and u.is_public and private.community_pair_is_clear(actor,u.id)
  ), candidates as (
    select case when f.user_id=m.id then f.friend_id else f.user_id end id,count(distinct m.id)::integer mutual_count
    from mutuals m join public.friendships f on m.id in(f.user_id,f.friend_id) and f.status='accepted'
      and private.community_pair_is_clear(m.id,case when f.user_id=m.id then f.friend_id else f.user_id end)
    group by 1
  ), visible as materialized (
    select u.id,u.username,u.display_name,case when u.avatar_url ~ '^https?://' and char_length(u.avatar_url)<=2048 then u.avatar_url end avatar_url,
      u.ratings_count,c.mutual_count
    from candidates c join public.users u on u.id=c.id
    where u.id<>actor and u.is_public and private.community_pair_is_clear(actor,u.id)
      and not exists(select 1 from public.friendships f where (f.user_id=actor and f.friend_id=u.id) or(f.friend_id=actor and f.user_id=u.id))
  ), page as (select * from visible order by mutual_count desc,username,id limit cap offset skip)
  select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(p) order by p.mutual_count desc,p.username,p.id) from page p),'[]'::jsonb),
    'has_more',skip+cap<(select count(*) from visible),'next_offset',skip+(select count(*) from page)) into result;
  return result;
end $$;
revoke all on function public.get_community_suggestions(integer,integer) from public,anon,authenticated,service_role;
grant execute on function public.get_community_suggestions(integer,integer) to authenticated;



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
  if requested_scope not in ('all', 'friends', 'popular', 'mine', 'experts') then
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
      exists(select 1 from private.community_experts e where e.user_id=u.id) as is_expert,
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
          'is_best_player', highlights.is_best_player,
          'participation_verified', highlights.participation_verified
        ) order by highlights.is_best_player desc, highlights.rating desc, highlights.name)
        from (
          select pr.player_id, p.name, a.club_id,
                 case when a.club_id=m.home_club_id then m.home_team_name when a.club_id=m.away_club_id then m.away_team_name end team,
                 pr.rating,pr.is_best_player,a.player_id is not null participation_verified
          from public.player_ratings pr
          join public.players p on p.id = pr.player_id
          left join public.match_player_appearances a on a.match_id=pr.match_id and a.player_id=pr.player_id and a.participation in ('starter','substitute')
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
        when 'experts' then exists(select 1 from private.community_experts e where e.user_id=r.user_id)
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
        'avatar_url', n.avatar_url,
        'is_expert', n.is_expert
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
$function$
;



revoke all on function public.get_social_feed_page(text,integer,timestamptz,integer,integer) from public;
grant execute on function public.get_social_feed_page(text,integer,timestamptz,integer,integer) to anon,authenticated;
notify pgrst,'reload schema';
