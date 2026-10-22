begin;
select plan(11);
select ok(not has_function_privilege('anon','public.consume_match_sync_ticket(text,text)','EXECUTE'),'guest cannot consume tickets');
select ok(not has_function_privilege('authenticated','public.consume_match_sync_ticket(text,text)','EXECUTE'),'users cannot consume tickets');
select ok(not has_function_privilege('service_role','private.dispatch_match_sync()','EXECUTE'),'service cannot mint tickets');
select ok(not has_table_privilege('authenticated','private.match_sync_tickets','SELECT'),'users cannot read tickets');
select ok(not has_table_privilege('service_role','private.match_sync_tickets','INSERT'),'service cannot mint tickets');
insert into private.match_sync_tickets values
  (extensions.digest(repeat('a',64),'sha256'),'PL','91800000000000000',now()+interval '3 minutes'),
  (extensions.digest(repeat('b',64),'sha256'),'PD','91800000000000001',now()-interval '1 second');
set local role service_role;
select is(public.consume_match_sync_ticket(repeat('a',64),'PD'),null::text,'wrong league cannot consume');
select is(public.consume_match_sync_ticket(repeat('a',64),'PL'),'91800000000000000','valid ticket consumed');
select is(public.consume_match_sync_ticket(repeat('a',64),'PL'),null::text,'replay denied');
select is(public.consume_match_sync_ticket(repeat('b',64),'PD'),null::text,'expired ticket denied');
select is(public.consume_match_sync_ticket('bad','PL'),null::text,'malformed token denied');
select is(public.consume_match_sync_ticket(null,'PL'),null::text,'missing token denied');
reset role;
select * from finish();
rollback;
