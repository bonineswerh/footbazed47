with ranked as (
  select id,
         row_number() over (
           partition by user_id, from_user_id, type
           order by created_at desc nulls last, id desc
         ) as row_number
  from public.notifications
  where type = 'friend_request'
)
delete from public.notifications n
using ranked r
where n.id = r.id and r.row_number > 1;

create unique index if not exists notifications_friend_request_once_idx
  on public.notifications (user_id, from_user_id, type)
  where type = 'friend_request';

create or replace function public.notify_friend_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_name text;
begin
  if new.status <> 'pending' then
    return new;
  end if;

  select coalesce(nullif(u.display_name, ''), nullif(u.username, ''), 'Пользователь')
  into actor_name
  from public.users u
  where u.id = new.user_id;

  insert into public.notifications (user_id, from_user_id, type, message)
  values (
    new.friend_id,
    new.user_id,
    'friend_request',
    coalesce(actor_name, 'Пользователь') || ' хочет добавить вас в друзья'
  )
  on conflict do nothing;
  return new;
end
$function$;

drop trigger if exists friendship_request_notification on public.friendships;
create trigger friendship_request_notification
after insert on public.friendships
for each row
when (new.status = 'pending')
execute function public.notify_friend_request();

drop policy if exists "Create verified friend notification" on public.notifications;
revoke insert, delete on table public.notifications from authenticated;
revoke update on table public.notifications from authenticated;
grant update (read) on table public.notifications to authenticated;

drop policy if exists "Create own rating like" on public.rating_likes;
drop policy if exists "Remove own rating like" on public.rating_likes;
revoke insert, update, delete on table public.rating_likes from authenticated;

drop policy if exists "Create own rating comment" on public.rating_comments;
drop policy if exists "Edit own rating comment" on public.rating_comments;
drop policy if exists "Delete own rating comment" on public.rating_comments;
revoke insert, update, delete on table public.rating_comments from authenticated;

revoke all on function public.notify_friend_request() from public, anon, authenticated;

notify pgrst, 'reload schema';
