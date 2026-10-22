-- pg_net is not relocatable. It was just installed, with no activated jobs.
-- Fail rather than discard any queued work if this assumption ever changes.
do $$ begin
  if exists(select 1 from net.http_request_queue) or exists(select 1 from net._http_response)
    then raise exception 'scheduler_extension_has_requests'; end if;
end $$;
drop extension pg_net;
create extension pg_net with schema extensions;
revoke all on schema net from public,anon,authenticated;
revoke all on all tables in schema net from public,anon,authenticated;
revoke all on all functions in schema net from public,anon,authenticated;
