create or replace function public.is_user_visible(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    p_user_id = auth.uid()
    or exists (
      select 1
      from public.friendships f
      where f.status = 'accepted'
        and (
          (f.user_id = auth.uid() and f.friend_id = p_user_id)
          or (f.friend_id = auth.uid() and f.user_id = p_user_id)
        )
    );
$function$;

drop policy if exists "Read visible users" on public.users;
create policy "Read visible users"
on public.users for select
to anon, authenticated
using (is_public = true or public.is_user_visible(id));

revoke all on function public.is_user_visible(uuid) from public;
grant execute on function public.is_user_visible(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
