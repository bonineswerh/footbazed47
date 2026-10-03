-- Additive notification history. Personal readers keep the existing RLS and
-- block scope; clients still cannot create events or change their identity.
update public.notifications set read=false where read is null;
alter table public.notifications add constraint notifications_read_required check(read is not null);
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('friend_request','friend_accepted','like','comment','system'));
create index notifications_user_cursor_idx on public.notifications(user_id,created_at desc,id desc);
create index notifications_user_unread_idx on public.notifications(user_id,id) where read=false;

create function public.get_notifications_page(
  p_unread_only boolean default false,
  p_cursor_created_at timestamptz default null,
  p_cursor_id integer default null,
  p_limit integer default 20
) returns jsonb language plpgsql stable security invoker set search_path='' as $function$
declare
  viewer uuid := auth.uid();
  page_size integer := least(greatest(coalesce(p_limit,20),1),50);
  result jsonb;
begin
  if viewer is null then raise exception using errcode='42501',message='auth_required'; end if;
  if (p_cursor_created_at is null) <> (p_cursor_id is null) or p_cursor_id<=0 then
    raise exception using errcode='22023',message='invalid_notification_cursor';
  end if;
  with candidates as materialized (
    select n.* from public.notifications n
    where n.user_id=viewer and (not coalesce(p_unread_only,false) or not n.read)
      and (p_cursor_created_at is null or (n.created_at,n.id)<(p_cursor_created_at,p_cursor_id))
    order by n.created_at desc,n.id desc limit page_size+1
  ), page as materialized (
    select * from candidates order by created_at desc,id desc limit page_size
  ), enriched as (
    select n.id,n.type,case when n.type='system' then n.message else null end message,n.read,n.created_at,n.rating_id,n.comment_id,
      case when u.id is null then null else jsonb_build_object('id',u.id,'username',u.username,
        'display_name',u.display_name,'avatar_url',u.avatar_url) end actor,
      case when r.id is null then null else jsonb_build_object('id',m.id,'home_team_name',m.home_team_name,
        'away_team_name',m.away_team_name,'league_name',m.league_name,
        'home_club',jsonb_build_object('name',hc.name,'short_name',hc.short_name),
        'away_club',jsonb_build_object('name',ac.name,'short_name',ac.short_name)) end "match",
      case when n.type in ('like','comment') then r.id is not null else true end target_available,
      case when n.type in ('friend_request','friend_accepted') then
        case when exists(select 1 from public.friendships f where f.status='accepted'
          and ((f.user_id=viewer and f.friend_id=n.from_user_id) or (f.friend_id=viewer and f.user_id=n.from_user_id))) then 'accepted'
        when exists(select 1 from public.friendships f where f.user_id=n.from_user_id and f.friend_id=viewer and f.status='pending') then 'pending'
        else 'closed' end else null end friend_status
    from page n left join public.users u on u.id=n.from_user_id
    left join public.ratings r on r.id=n.rating_id and r.user_id=viewer
    left join public.matches m on m.id=r.match_id
    left join public.clubs hc on hc.id=m.home_club_id
    left join public.clubs ac on ac.id=m.away_club_id
  ) select jsonb_build_object(
    'items',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc,e.id desc) from enriched e),'[]'::jsonb),
    'has_more',(select count(*)>page_size from candidates),
    'next_cursor',(select jsonb_build_object('created_at',created_at,'id',id) from page order by created_at,id limit 1),
    'unread_count',(select count(*)::integer from public.notifications where user_id=viewer and not read),
    'through_id',(select max(id) from public.notifications where user_id=viewer)
  ) into result;
  return result;
end
$function$;
revoke all on function public.get_notifications_page(boolean,timestamptz,integer,integer) from public,anon,service_role;
grant execute on function public.get_notifications_page(boolean,timestamptz,integer,integer) to authenticated;

create function public.set_notification_read(
  p_notification_id integer default null,
  p_read boolean default true,
  p_through_id integer default null
) returns jsonb language plpgsql volatile security invoker set search_path='' as $function$
declare viewer uuid := auth.uid(); affected integer;
begin
  if viewer is null then raise exception using errcode='42501',message='auth_required'; end if;
  if p_read is null or (p_notification_id is null)=(p_through_id is null)
     or p_notification_id<=0 or p_through_id<=0 or (p_through_id is not null and not p_read) then
    raise exception using errcode='22023',message='invalid_notification_update';
  end if;
  if p_notification_id is not null and not exists(select 1 from public.notifications where user_id=viewer and id=p_notification_id) then
    raise exception using errcode='42501',message='notification_unavailable';
  end if;
  update public.notifications set read=p_read where user_id=viewer and read is distinct from p_read
    and ((p_notification_id is not null and id=p_notification_id) or (p_through_id is not null and id<=p_through_id));
  get diagnostics affected=row_count;
  return jsonb_build_object('affected',affected,
    'unread_count',(select count(*)::integer from public.notifications where user_id=viewer and not read));
end
$function$;
revoke all on function public.set_notification_read(integer,boolean,integer) from public,anon,service_role;
grant execute on function public.set_notification_read(integer,boolean,integer) to authenticated;

-- Reuse the existing feed privacy scope to open one permitted entry directly.
-- The tuple boundary includes this ID without scanning the first 120 entries.
create function public.get_rating_entry(p_rating_id integer)
returns jsonb language plpgsql stable security invoker set search_path='' as $function$
declare rating_time timestamptz; payload jsonb; entry jsonb;
begin
  select created_at into rating_time from public.ratings where id=p_rating_id;
  if rating_time is null then return null; end if;
  if p_rating_id<2147483647 then
    payload := public.get_social_feed_page('all',1,rating_time,p_rating_id+1,0);
  else
    payload := public.get_social_feed_page('all',1,rating_time+interval '1 microsecond',2147483647,0);
  end if;
  entry := payload->'items'->0;
  if (entry->>'rating_id')::integer=p_rating_id then return entry; end if;
  return null;
end
$function$;
revoke all on function public.get_rating_entry(integer) from public,service_role;
grant execute on function public.get_rating_entry(integer) to anon,authenticated;

create function public.get_rating_comment(p_rating_id integer,p_comment_id integer)
returns jsonb language sql stable security invoker set search_path='' as $function$
  select jsonb_build_object('id',c.id,'user_id',c.user_id,'comment',c.comment,'created_at',c.created_at,
    'updated_at',c.updated_at,'edited_at',c.edited_at,'can_edit',c.user_id=(select auth.uid()),
    'can_delete',c.user_id=(select auth.uid()),'user',case when u.id is null then null else
      jsonb_build_object('username',u.username,'display_name',u.display_name,'avatar_url',u.avatar_url) end)
  from public.rating_comments c join public.ratings r on r.id=c.rating_id
  left join public.users u on u.id=c.user_id
  where c.id=p_comment_id and c.rating_id=p_rating_id
    and exists(select 1 from public.users owner where owner.id=r.user_id)
$function$;
revoke all on function public.get_rating_comment(integer,integer) from public,service_role;
grant execute on function public.get_rating_comment(integer,integer) to anon,authenticated;

create function private.notify_friend_acceptance()
returns trigger language plpgsql security definer set search_path='' as $function$
declare actor_name text;
begin
  if old.status<>'pending' or new.status<>'accepted' or new.user_id=new.friend_id
     or not private.community_pair_is_clear(new.user_id,new.friend_id) then return new; end if;
  select coalesce(nullif(display_name,''),username,'Болельщик') into actor_name from public.users where id=new.friend_id;
  insert into public.notifications(user_id,from_user_id,type,message)
    values(new.user_id,new.friend_id,'friend_accepted',coalesce(actor_name,'Болельщик')||' принял заявку в друзья');
  return new;
end
$function$;
revoke all on function private.notify_friend_acceptance() from public,anon,authenticated,service_role;
create trigger friendship_acceptance_notification after update of status on public.friendships
  for each row execute function private.notify_friend_acceptance();
notify pgrst,'reload schema';
