-- No job is activated by migrations: clean CI databases must never call production.
create extension if not exists pg_net;
create extension if not exists pg_cron;

create table private.match_sync_tickets (
  token_hash bytea primary key,
  league text not null check (league in ('PL','PD','BL1','SA','FL1','CL')),
  run_id text not null check (run_id ~ '^[0-9]{1,24}$'),
  expires_at timestamptz not null
);
alter table private.match_sync_tickets enable row level security;
revoke all on private.match_sync_tickets from public,anon,authenticated;
grant usage on schema private to service_role;
grant select,delete on private.match_sync_tickets to service_role;
-- pg_net queues contain short-lived Authorization headers. No public access.
revoke all on schema net from public,anon,authenticated;
revoke all on all tables in schema net from public,anon,authenticated;
revoke all on all functions in schema net from public,anon,authenticated;

create function public.consume_match_sync_ticket(p_token text,p_league text)
returns text language plpgsql security invoker set search_path='' as $$
declare v_run text;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{64}$'
     or p_league is null or p_league not in ('PL','PD','BL1','SA','FL1','CL') then
    return null;
  end if;
  delete from private.match_sync_tickets
    where token_hash=extensions.digest(p_token,'sha256')
      and league=p_league and expires_at>pg_catalog.clock_timestamp()
    returning run_id into v_run;
  return v_run;
end;
$$;
revoke all on function public.consume_match_sync_ticket(text,text) from public,anon,authenticated;
grant execute on function public.consume_match_sync_ticket(text,text) to service_role;

-- Only the database owner can dispatch. Fixed destination, no user-supplied URL.
create function private.dispatch_match_sync()
returns bigint language plpgsql security invoker set search_path='' as $$
declare
  v_slot integer := extract(minute from pg_catalog.clock_timestamp() at time zone 'UTC')::integer % 15;
  v_league text;
  v_token text;
  v_request bigint;
begin
  if v_slot>5 then return null; end if;
  if not pg_catalog.pg_try_advisory_xact_lock(864201321) then return null; end if;
  v_league := (array['PL','PD','BL1','SA','FL1','CL'])[v_slot+1];
  -- Keep transient storage bounded and avoid dispatching during the shared cooldown.
  delete from private.match_sync_tickets where expires_at<pg_catalog.clock_timestamp();
  if exists(select 1 from public.admin_audit_logs where action='auto_sync_started'
    and target_id=v_league and created_at>pg_catalog.clock_timestamp()-interval '10 minutes')
    or exists(select 1 from private.match_sync_tickets where league=v_league) then return null; end if;
  v_token := pg_catalog.encode(extensions.gen_random_bytes(32),'hex');
  insert into private.match_sync_tickets(token_hash,league,run_id,expires_at)
    values(extensions.digest(v_token,'sha256'),v_league,
      '9'||(extract(epoch from pg_catalog.clock_timestamp())*1000000)::bigint::text,
      pg_catalog.clock_timestamp()+interval '3 minutes');
  v_request := net.http_post(
    url:='https://footbazed47.vercel.app/api/sync-results-db?league='||v_league,
    body:='{}'::jsonb,
    headers:=pg_catalog.jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_token),
    timeout_milliseconds:=65000);
  return v_request;
end;
$$;
revoke all on function private.dispatch_match_sync() from public,anon,authenticated,service_role;
