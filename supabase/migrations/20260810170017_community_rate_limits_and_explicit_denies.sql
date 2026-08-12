create or replace function public.enforce_community_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  recent_count integer;
begin
  if new.user_id is null then
    raise exception using errcode = '22023', message = 'missing_user_id';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.user_id::text || ':' || tg_table_name, 0)
  );

  if tg_table_name = 'rating_comments' then
    if exists (
      select 1
      from public.rating_comments rc
      where rc.user_id = new.user_id
        and rc.created_at > pg_catalog.clock_timestamp() - interval '3 seconds'
    ) then
      raise exception using errcode = 'P0001', message = 'comment_rate_limit';
    end if;

    select count(*)::integer into recent_count
    from public.rating_comments rc
    where rc.user_id = new.user_id
      and rc.created_at > pg_catalog.clock_timestamp() - interval '1 minute';

    if recent_count >= 5 then
      raise exception using errcode = 'P0001', message = 'comment_rate_limit';
    end if;
  elsif tg_table_name = 'chat_messages' then
    if exists (
      select 1
      from public.chat_messages cm
      where cm.user_id = new.user_id
        and cm.created_at > pg_catalog.clock_timestamp() - interval '1 second'
    ) then
      raise exception using errcode = 'P0001', message = 'chat_rate_limit';
    end if;

    select count(*)::integer into recent_count
    from public.chat_messages cm
    where cm.user_id = new.user_id
      and cm.created_at > pg_catalog.clock_timestamp() - interval '1 minute';

    if recent_count >= 15 then
      raise exception using errcode = 'P0001', message = 'chat_rate_limit';
    end if;
  end if;

  return new;
end
$function$;

drop trigger if exists rating_comments_rate_limit on public.rating_comments;
create trigger rating_comments_rate_limit
before insert on public.rating_comments
for each row execute function public.enforce_community_rate_limit();

drop trigger if exists chat_messages_rate_limit on public.chat_messages;
create trigger chat_messages_rate_limit
before insert on public.chat_messages
for each row execute function public.enforce_community_rate_limit();

revoke all on function public.enforce_community_rate_limit() from public, anon, authenticated;

drop policy if exists "Explicitly deny client access" on public.admin_audit_logs;
create policy "Explicitly deny client access"
on public.admin_audit_logs for all to anon, authenticated
using (false) with check (false);

drop policy if exists "Explicitly deny client access" on public.live_chat_messages;
create policy "Explicitly deny client access"
on public.live_chat_messages for all to anon, authenticated
using (false) with check (false);

drop policy if exists "Explicitly deny client access" on public.support_tickets;
create policy "Explicitly deny client access"
on public.support_tickets for all to anon, authenticated
using (false) with check (false);

comment on table public.live_chat_messages is
  'Deprecated and client-inaccessible. Retained temporarily for reversible cleanup.';
comment on table public.support_tickets is
  'Reserved and client-inaccessible. No product workflow currently depends on this table.';
comment on table public.referee_ratings is
  'Deprecated and client-inaccessible. Retained temporarily for reversible cleanup.';
