begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('68000000-0000-0000-0000-00000000000'||i)::uuid,'authenticated','authenticated','expect'||i||'@example.test','{}','{}',now(),now() from generate_series(1,3) i;
insert into public.users(id,username,display_name,is_public)
select ('68000000-0000-0000-0000-00000000000'||i)::uuid,'Expect_'||i,'Expectation '||i,i<>3 from generate_series(1,3) i;
insert into public.matches(id,league_name,home_team_name,away_team_name,match_date,status) overriding system value values
(996501,'Expectation Cup','Home','Away',now()+interval '2 days','scheduled'),
(996502,'Expectation Cup','Home','Away',now()-interval '2 days','scheduled'),
(996503,'Expectation Cup','Home','Away',now()+interval '3 days','scheduled');
select ok(not has_table_privilege('authenticated','private.match_expectations','SELECT'),'raw expectations remain private');
select ok(not has_table_privilege('authenticated','private.match_expectations','INSERT'),'no direct writes');
select ok(not has_function_privilege('anon','public.save_match_expectation(bigint,smallint,text)','EXECUTE'),'anonymous writes denied');
select ok(not has_function_privilege('authenticated','private.notify_expected_match_finished()','EXECUTE'),'notification trigger cannot be invoked');
select ok(not has_column_privilege('authenticated','public.notifications','match_id','UPDATE'),'notification target is protected');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"68000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select is((public.save_match_expectation(996501,7::smallint,'home')->'own'->>'rating')::integer,7,'owner can rate expectations');
select is((public.get_match_expectations(996501)->'segments'->'home'->>'count')::integer,1,'fan side is stored');
select throws_ok($$select public.save_match_expectation(996501,8::smallint,'home')$$,'22023','expectation_rate_limit','rapid repeated save is limited');
select throws_ok($$select public.save_match_expectation(996501,0::smallint,'home')$$,'22023','rating_out_of_range','zero is not a stored rating');
select throws_ok($$select public.save_match_expectation(996501,11::smallint,'home')$$,'22023','rating_out_of_range','upper range enforced');
select throws_ok($$select public.save_match_expectation(996501,8::smallint,null)$$,'22023','supporter_side_required','fan context required');
select throws_ok($$select public.save_match_expectation(996502,8::smallint,'neutral')$$,'22023','expectation_closed','kickoff deadline checked even with stale status');
select throws_ok($$select public.save_match_expectation(996599,8::smallint,'neutral')$$,'22023','match_not_found','missing fixture rejected');
select set_config('request.jwt.claims','{"sub":"68000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select is(public.get_match_expectations(996501)->'own','null'::jsonb,'another user cannot read owner draft');
select is((public.save_match_expectation(996501,9::smallint,'neutral')->'own'->>'rating')::integer,9,'second user owns a separate expectation');
select set_config('request.jwt.claims','{"sub":"68000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
select is((public.save_match_expectation(996501,8::smallint,'away')->'own'->>'rating')::integer,8,'private profile retains its own expectation');
select is((public.get_match_expectations(996501)->'segments'->'all'->>'count')::integer,2,'private profile excluded from community summary');
reset role;
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select is(public.get_match_expectations(996501)->'own','null'::jsonb,'guest receives no private draft');
select is((public.get_match_expectations(996501)->'segments'->'all'->>'average')::numeric,8::numeric,'guest sees only aggregate');
select is(public.get_match_expectations(996599),null::jsonb,'missing fixture reader is empty');
reset role;
update private.match_expectations set updated_at=now()-interval '2 minutes' where user_id='68000000-0000-0000-0000-000000000001' and match_id=996501;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"68000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select is((public.save_match_expectation(996501,6::smallint,'home')->'own'->>'rating')::integer,6,'existing expectation updates atomically');
select is((public.save_match_expectation(996503,5::smallint,'neutral')->'own'->>'rating')::integer,5,'a separate match can be rated');
select is(public.delete_match_expectation(996503)->'own','null'::jsonb,'owner can withdraw before kickoff');
reset role;
select is((select count(*)::integer from private.match_expectations where match_id=996501),3,'upsert creates no duplicate');
update public.matches set status='finished',home_score=2,away_score=1 where id=996501;
select ok((select expectations_closed_at is not null from public.matches where id=996501),'actual start permanently closes expectation window');
select is((select count(*)::integer from public.notifications where type='match_ready' and match_id=996501),3,'completion notifies every expectation owner once');
insert into public.ratings(user_id,match_id,match_rating,supporter_side,is_public) values
('68000000-0000-0000-0000-000000000001',996501,8,'home',true),
('68000000-0000-0000-0000-000000000002',996501,9,'neutral',true);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"68000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select throws_ok($$select public.save_match_expectation(996501,10::smallint,'neutral')$$,'22023','expectation_closed','cannot rewrite expectations after result');
select throws_ok($$select public.delete_match_expectation(996501)$$,'22023','expectation_closed','cannot withdraw history after result');
select is((public.get_match_expectations(996501)->'segments'->'all'->>'paired_count')::integer,2,'comparison uses only authors who voted both times');
select is((public.get_match_expectations(996501)->'segments'->'all'->>'paired_delta')::numeric,1::numeric,'paired difference is rating minus expectation');
select is((select count(*)::integer from jsonb_array_elements(public.get_notifications_page_v2()->'items') n where n->>'type'='match_ready'),1,'notification page is owner scoped');
select is((select (n->'match'->>'id')::bigint from jsonb_array_elements(public.get_notifications_page_v2()->'items') n where n->>'type'='match_ready'),996501::bigint,'completion notification has a working match target');
reset role;
update public.matches set status='scheduled',expectations_closed_at=null where id=996501;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"68000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select is((public.get_match_expectations(996501)->>'is_open')::boolean,false,'status regression cannot reopen the window');
reset role;
update public.matches set status='finished' where id=996501;
select is((select count(*)::integer from public.notifications where type='match_ready' and match_id=996501),3,'repeated completion is idempotent');
select * from finish();
rollback;
