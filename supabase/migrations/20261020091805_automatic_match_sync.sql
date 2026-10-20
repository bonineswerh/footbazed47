-- Additive only: reuse the existing append-only, service-only audit trail.
create unique index admin_auto_sync_run_idx
  on public.admin_audit_logs (target_id, (metadata->>'run_id'))
  where action = 'auto_sync_started';
create index admin_auto_sync_recent_idx
  on public.admin_audit_logs (target_id, created_at desc)
  where action = 'auto_sync_started';

create or replace function public.claim_automatic_match_sync(p_league text, p_run_id text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_league is null or p_league not in ('PL','PD','BL1','SA','FL1','CL')
     or p_run_id is null or p_run_id !~ '^[0-9]{1,24}$' then
    raise exception using errcode='22023', message='invalid_sync_claim';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('automatic-match-sync:' || p_league, 0));
  if exists (
    select 1 from public.admin_audit_logs
    where action='auto_sync_started' and target_id=p_league
      and (metadata->>'run_id'=p_run_id or created_at>pg_catalog.clock_timestamp()-interval '10 minutes')
  ) then return false; end if;
  insert into public.admin_audit_logs(action,target_type,target_id,metadata)
    values('auto_sync_started','league',p_league,pg_catalog.jsonb_build_object('run_id',p_run_id));
  return true;
end;
$$;
revoke all on function public.claim_automatic_match_sync(text,text) from public,anon,authenticated;
grant execute on function public.claim_automatic_match_sync(text,text) to service_role;
