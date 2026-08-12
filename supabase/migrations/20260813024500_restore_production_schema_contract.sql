-- Restore historical production details that predate repository migrations.
-- Every statement is idempotent against the current production schema.

alter table public.matches alter column id set generated always;
alter table public.players alter column id set generated always;
alter table public.live_chat_messages alter column id set generated always;
alter table public.support_tickets alter column id set generated always;
alter table public.referee_ratings alter column id set generated always;

do $migration$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.live_chat_messages'::regclass
      and conname = 'live_chat_messages_match_id_fkey'
  ) then
    alter table public.live_chat_messages
      add constraint live_chat_messages_match_id_fkey
      foreign key (match_id) references public.matches(id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.referee_ratings'::regclass
      and conname = 'referee_ratings_match_id_fkey'
  ) then
    alter table public.referee_ratings
      add constraint referee_ratings_match_id_fkey
      foreign key (match_id) references public.matches(id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.referee_ratings'::regclass
      and conname = 'referee_ratings_rating_check'
  ) then
    alter table public.referee_ratings
      add constraint referee_ratings_rating_check
      check (rating >= 1 and rating <= 10);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.referee_ratings'::regclass
      and conname = 'referee_ratings_user_id_match_id_key'
  ) then
    alter table public.referee_ratings
      add constraint referee_ratings_user_id_match_id_key
      unique (user_id, match_id);
  end if;
end
$migration$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(
    (select u.is_admin from public.users u where u.id = (select auth.uid())),
    false
  );
$function$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

notify pgrst, 'reload schema';
