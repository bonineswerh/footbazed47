-- Personal, reversible inbox cleanup; the underlying event remains intact.
create table public.notification_dismissals (
  notification_id integer primary key references public.notifications(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index notification_dismissals_user_idx on public.notification_dismissals(user_id);
alter table public.notification_dismissals enable row level security;
revoke all on public.notification_dismissals from public,anon,authenticated;
grant select,insert,delete on public.notification_dismissals to authenticated;
grant all on public.notification_dismissals to service_role;
create policy "Owners read dismissed notification IDs" on public.notification_dismissals
  for select to authenticated using(user_id=(select auth.uid()));
create policy "Owners dismiss visible notifications" on public.notification_dismissals
  for insert to authenticated with check(user_id=(select auth.uid()) and exists(
    select 1 from public.notifications n where n.id=notification_id and n.user_id=(select auth.uid())));
create policy "Owners restore their notifications" on public.notification_dismissals
  for delete to authenticated using(user_id=(select auth.uid()));
-- Break the policy cycle: dismissal INSERT checks the visible inbox, while
-- inbox SELECT checks dismissal metadata. This private predicate only reveals
-- the caller's own dismissal and never reads the underlying notification.
create function private.is_notification_dismissed(p_notification_id integer)
returns boolean language sql stable security definer set search_path='' as $function$
  select exists(select 1 from public.notification_dismissals d
    where d.notification_id=p_notification_id and d.user_id=(select auth.uid()));
$function$;
revoke all on function private.is_notification_dismissed(integer) from public,anon,authenticated,service_role;
grant execute on function private.is_notification_dismissed(integer) to authenticated;
-- Applied to existing readers, pagination and badge counts alike. Other privacy
-- restrictions remain in force; clearing an event never changes its read state.
create policy "Dismissed notifications leave the inbox" on public.notifications
  as restrictive for select to authenticated using(not private.is_notification_dismissed(id));
create function public.set_notification_dismissed(p_notification_id integer,p_dismissed boolean default true)
returns jsonb language plpgsql volatile security invoker set search_path='' as $function$
declare viewer uuid:=auth.uid(); affected integer;
begin
  if viewer is null then raise exception using errcode='42501',message='auth_required'; end if;
  if p_notification_id is null or p_notification_id<=0 or p_dismissed is null then
    raise exception using errcode='22023',message='invalid_notification_update';
  end if;
  if p_dismissed then
    insert into public.notification_dismissals(notification_id,user_id)
      select n.id,viewer from public.notifications n where n.id=p_notification_id and n.user_id=viewer
      on conflict(notification_id) do nothing;
    get diagnostics affected=row_count;
    if affected=0 and not exists(select 1 from public.notification_dismissals where notification_id=p_notification_id and user_id=viewer) then
      raise exception using errcode='42501',message='notification_unavailable';
    end if;
  else
    delete from public.notification_dismissals where notification_id=p_notification_id and user_id=viewer;
    get diagnostics affected=row_count;
    if affected=0 then raise exception using errcode='42501',message='notification_unavailable'; end if;
  end if;
  return jsonb_build_object('affected',affected,'unread_count',(
    select count(*)::integer from public.notifications where user_id=viewer and not read));
end
$function$;
revoke all on function public.set_notification_dismissed(integer,boolean) from public,anon,service_role;
grant execute on function public.set_notification_dismissed(integer,boolean) to authenticated;
notify pgrst,'reload schema';
