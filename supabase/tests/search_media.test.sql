begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(15);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('53000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
  'searchscope@example.test',crypt('search-test',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now());
insert into public.users(id,username,is_public) values('53000000-0000-0000-0000-000000000001','searchscope_private',false);
insert into public.media_assets(id,asset_type,source_provider,source_url,usage_status,verified_at,metadata) overriding system value values
(970001,'club_logo','api-football','https://media.api-sports.io/football/teams/970001.png','identification',null,'{"usage_scope":"club_identification","rights_status":"not_verified","terms_url":"https://www.api-football.com/terms"}'),
(970002,'player_photo','test','https://assets.example.test/verified-player.png','verified',now(),'{}'),
(970003,'player_photo','test','https://assets.example.test/unknown-player.png','unknown',null,'{}'),
(970004,'competition_logo','test','https://assets.example.test/restricted-competition.png','restricted',null,'{}'),
(970005,'club_logo','test','https://assets.example.test/disabled-club.png','disabled',null,'{}');
insert into public.clubs(id,name,tla,logo_asset_id) overriding system value values
(971001,'Searchscope Alpha','SCA',970001),(971002,'Searchscope Disabled','SCD',970005),(971003,'Searchscope Wrongtype','SCW',970002);
insert into public.players(id,name,team,club_id,photo_asset_id) overriding system value values
(972001,'Searchscope Verified Player','Searchscope Alpha',971001,970002),(972002,'Searchscope Unknown Player','Searchscope Alpha',971001,970003);
insert into public.competitions(id,name,code,logo_asset_id) overriding system value values(973001,'Searchscope Restricted Competition','SCM',970004);
select ok(has_function_privilege('anon','public.search_footbazed_v2(text,integer)','EXECUTE'),'anonymous search grant exists');
select ok(has_function_privilege('authenticated','public.search_footbazed_v2(text,integer)','EXECUTE'),'signed-in search grant exists');
select ok((select not prosecdef from pg_proc where oid='public.search_footbazed_v2(text,integer)'::regprocedure),'search enrichment respects caller RLS');
set local role anon;
select is(jsonb_array_length(public.search_footbazed_v2('s')),0,'short search remains empty');
select is(jsonb_array_length(public.search_footbazed_v2('Searchscope',1)),1,'requested search limit is respected');
select is(public.search_footbazed_v2('Searchscope Alpha')->0->>'entity_id','971001','exact entity identity/ranking survives enrichment');
select is(public.search_footbazed_v2('Searchscope Alpha')#>>'{0,visual,media,usage_status}','identification','actual club identification asset is displayable');
select is(public.search_footbazed_v2('Searchscope Alpha')#>>'{0,visual,media,url}','https://media.api-sports.io/football/teams/970001.png','club URL remains the registered exact provider asset');
select ok(public.search_footbazed_v2('Searchscope Alpha')#>'{0,visual,media,license_name}'='null'::jsonb,'identification is never relabeled as a verified license');
select is(public.search_footbazed_v2('Searchscope Verified Player')#>>'{0,visual,media,url}','https://assets.example.test/verified-player.png','verified player photo is returned without provider guessing');
select ok(public.search_footbazed_v2('Searchscope Unknown Player')#>'{0,visual,media}'='null'::jsonb,'unknown player photo is not exposed');
select ok(public.search_footbazed_v2('Searchscope Restricted Competition')#>'{0,visual,media}'='null'::jsonb,'restricted competition logo is not exposed');
select ok(public.search_footbazed_v2('Searchscope Disabled')#>'{0,visual,media}'='null'::jsonb,'disabled club asset is not exposed');
select ok(public.search_footbazed_v2('Searchscope Wrongtype')#>'{0,visual,media}'='null'::jsonb,'wrong asset kind is not attached to a club');
select is((select count(*)::integer from jsonb_array_elements(public.search_footbazed_v2('searchscope_private')) x where x->>'entity_type'='user'),0,'enrichment cannot reveal a private stranger');
select * from finish();
rollback;
