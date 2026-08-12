create or replace function public.has_accepted_inverse_friendship(requester uuid, recipient uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select requester = (select auth.uid())
    and exists (
      select 1 from public.friendships f
      where f.user_id = recipient and f.friend_id = requester and f.status = 'accepted'
    );
$function$;

create or replace function public.protect_friendship_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if (select auth.uid()) is not null and (
    new.id is distinct from old.id or new.user_id is distinct from old.user_id
    or new.friend_id is distinct from old.friend_id or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Friendship participants cannot be changed.';
  end if;
  return new;
end
$function$;

create or replace function public.protect_notification_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if (select auth.uid()) is not null and (
    new.id is distinct from old.id or new.user_id is distinct from old.user_id
    or new.from_user_id is distinct from old.from_user_id or new.type is distinct from old.type
    or new.message is distinct from old.message or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Only notification read state can be changed.';
  end if;
  return new;
end
$function$;

drop trigger if exists protect_friendship_identity_trigger on public.friendships;
create trigger protect_friendship_identity_trigger before update on public.friendships
for each row execute function public.protect_friendship_identity();

drop trigger if exists protect_notification_identity_trigger on public.notifications;
create trigger protect_notification_identity_trigger before update on public.notifications
for each row execute function public.protect_notification_identity();

drop policy if exists "Create own friend request" on public.friendships;
create policy "Create own friend request" on public.friendships for insert to authenticated with check (
  (select auth.uid()) = user_id and user_id <> friend_id
  and (status = 'pending' or (status = 'accepted' and public.has_accepted_inverse_friendship(user_id, friend_id)))
);

drop policy if exists "Recipient responds to friend request" on public.friendships;
create policy "Recipient responds to friend request" on public.friendships for update to authenticated
using ((select auth.uid()) = friend_id and status = 'pending')
with check ((select auth.uid()) = friend_id and status = any (array['accepted', 'rejected']));

alter table public.live_chat_messages enable row level security;
alter table public.support_tickets enable row level security;

revoke all on table public.live_chat_messages, public.support_tickets from public, anon, authenticated;
revoke all on function public.has_accepted_inverse_friendship(uuid, uuid) from public, anon, authenticated;

notify pgrst, 'reload schema';
