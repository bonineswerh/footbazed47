begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(25);
insert into public.media_assets(id,asset_type,source_provider,source_url,usage_status,metadata)
overriding system value values(985000,'club_logo','api-football','https://media.api-sports.io/football/teams/985000.png','identification','{"usage_scope":"club_identification","rights_status":"not_verified","terms_url":"https://www.api-football.com/terms"}');
insert into public.clubs(id,name,tla,logo_asset_id) overriding system value
select 985000+n,'Pagedscope Club '||lpad(n::text,2,'0'),'PGC',case when n=1 then 985000 end from generate_series(1,30) n;
insert into public.players(id,name,team,club_id) overriding system value
select 985000+n,'Pagedscope Player '||lpad(n::text,2,'0'),'Pagedscope Club 01',985001 from generate_series(1,20) n;
insert into public.matches(id,home_team_name,away_team_name,league_name,match_date,status,home_score,away_score,home_club_id,away_club_id)
overriding system value select 985000+n,'Pagedscope Club 01','Pagedscope Club 02','Pagedscope League','2026-09-01'::timestamptz+n*interval '1 day','finished',0,0,985001,985002 from generate_series(1,30) n;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('54000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','pagedscope@example.test',crypt('search-test',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now());
insert into public.users(id,username,display_name,is_public) values('54000000-0000-0000-0000-000000000001','pagedscope_private','Ёж Pagedscope',false);
select ok(has_function_privilege('anon','public.search_footbazed_page(text,text,jsonb,integer)','EXECUTE'),'anonymous reader grant');
select ok(has_function_privilege('authenticated','public.search_footbazed_page(text,text,jsonb,integer)','EXECUTE'),'signed-in reader grant');
select ok((select not prosecdef from pg_proc where oid='public.search_footbazed_page(text,text,jsonb,integer)'::regprocedure),'caller RLS remains in effect');
select is((select proconfig[1] from pg_proc where oid='public.search_footbazed_page(text,text,jsonb,integer)'::regprocedure),'search_path=""','fixed empty search path');
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select is(jsonb_array_length(search_footbazed_page('Pagedscope','club')->'items'),14,'category limit follows complete search, not the four-club preview');
select ok(not exists(select 1 from jsonb_array_elements(search_footbazed_page('Pagedscope','club')->'items') x where x->>'entity_type'<>'club'),'unrelated categories are absent');
select ok(search_footbazed_page('Pagedscope','club')->'next_cursor'<>'null'::jsonb,'lookahead provides a continuation cursor');
select is(jsonb_array_length(search_footbazed_page('Pagedscope','club',search_footbazed_page('Pagedscope','club')->'next_cursor')->'items'),14,'second category page is complete');
select is((with first_page as(select search_footbazed_page('Pagedscope','club') j) select count(*)::integer from first_page,jsonb_array_elements(j->'items') a,jsonb_array_elements(search_footbazed_page('Pagedscope','club',j->'next_cursor')->'items') b where a->>'entity_id'=b->>'entity_id'),0,'adjacent pages never repeat a stable entity');
select is((with p1 as(select search_footbazed_page('Pagedscope','club') j),p2 as(select search_footbazed_page('Pagedscope','club',j->'next_cursor') j from p1) select jsonb_array_length(search_footbazed_page('Pagedscope','club',j->'next_cursor')->'items') from p2),2,'last page retains the tail beyond preview caps');
select is((with p1 as(select search_footbazed_page('Pagedscope','club') j),p2 as(select search_footbazed_page('Pagedscope','club',j->'next_cursor') j from p1) select search_footbazed_page('Pagedscope','club',j->'next_cursor')->'next_cursor' from p2),'null'::jsonb,'no cursor remains after the tail');
select is(jsonb_array_length(search_footbazed_page('Pagedscope','player',null,1000)->'items'),20,'players search beyond the old four-result cap');
select is(jsonb_array_length(search_footbazed_page('Pagedscope','club',null,1000)->'items'),24,'oversized requested page stays bounded');
select is(jsonb_array_length(search_footbazed_page('p','club')->'items'),0,'short query stays empty');
select is(jsonb_array_length(search_footbazed_page(repeat('a',81),'club')->'items'),0,'oversized query stays bounded');
select throws_ok($$select search_footbazed_page('Pagedscope','secret')$$,'22023','Unsupported search category','category allowlist is enforced');
select throws_ok($$select search_footbazed_page('Other','club',search_footbazed_page('Pagedscope','club')->'next_cursor')$$,'22023','Invalid search cursor','cursor cannot cross queries');
select throws_ok($$select search_footbazed_page('Pagedscope','match',search_footbazed_page('Pagedscope','club')->'next_cursor')$$,'22023','Invalid search cursor','cursor cannot cross categories');
select throws_ok($$select search_footbazed_page('Pagedscope','club','{"relevance":"invalid"}')$$,'22023','Invalid search cursor','malformed cursor is rejected');
select is(search_footbazed_page('Pagedscope Club 01','club')#>>'{items,0,visual,media,usage_status}','identification','displayable club media remains optional identification');
select is(search_footbazed_page('Pagedscope Club 01','club')#>'{items,0,visual,media,license_name}','null'::jsonb,'media never gains a fabricated license');
select is(search_footbazed_page('Pagedscope','match')#>>'{items,0,home_score}','0','real zero score survives');
select ok(search_footbazed_page('Pagedscope','match')#>>'{items,0,match_date}' is not null,'match date distinguishes repeated fixtures');
select is(jsonb_array_length(search_footbazed_page('pagedscope_private','user')->'items'),0,'anonymous category search cannot reveal a private profile');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"54000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select is(search_footbazed_page('Еж Pagedscope','user')#>>'{items,0,title}','Ёж Pagedscope','owner can find own profile with normalized query and original title');
reset role;
select * from finish();
rollback;
