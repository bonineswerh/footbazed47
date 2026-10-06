begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(22);
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('15000000-0000-0000-0000-000000000001','authenticated','authenticated','locale-owner@example.test','{}','{}',now(),now()),
('15000000-0000-0000-0000-000000000002','authenticated','authenticated','locale-private@example.test','{}','{}',now(),now());
insert into public.users(id,username,display_name,is_public) values
('15000000-0000-0000-0000-000000000001','locale_owner','Ёж',true),
('15000000-0000-0000-0000-000000000002','locale_private','Ёж',false);
insert into public.clubs(id,name,short_name) overriding system value values
(980001,'Locale Home FC','Locale Home'),(980002,'Locale Away FC','Locale Away');
insert into public.club_aliases(club_id,alias) values(980001,'Локальный клуб'),(980002,'Шахтёр тест');
insert into public.players(id,name,team,club_id) overriding system value values(980001,'Ёж','Locale Home',980001);
insert into public.competitions(id,name,code) overriding system value
select 980001,'Locale League','PD' where not exists(select 1 from public.competitions where lower(code)='pd');
insert into public.matches(id,home_team_name,away_team_name,league_name,match_date,status,home_score,away_score,home_club_id,away_club_id,competition_id)
overriding system value select 980000+n,'Locale Home FC','Locale Away FC','Locale League','2026-09-01'::timestamptz+n*interval '1 day','finished',2,1,980001,980002,(select id from public.competitions where lower(code)='pd') from generate_series(1,4) n;
insert into public.ratings(user_id,match_id,match_rating,is_public,supporter_side)
select '15000000-0000-0000-0000-000000000001',980000+n,9,n<>4,'neutral' from generate_series(1,4) n;
insert into public.ratings(user_id,match_id,match_rating,is_public,supporter_side) values
('15000000-0000-0000-0000-000000000002',980001,1,true,'neutral');
select ok(not has_function_privilege('anon','private.seed_club_display_aliases()','EXECUTE'),'alias trigger cannot be invoked by an anonymous caller');
select ok(not has_function_privilege('authenticated','private.seed_club_display_aliases()','EXECUTE'),'alias trigger cannot be invoked by a signed-in caller');
select ok(exists(select 1 from pg_trigger where tgname='seed_club_display_aliases' and not tgisinternal),'future imports retain display aliases');
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select is((get_matches_page('all',null,'Локальный клуб',1,0)->>'total')::integer,4,'calendar aliases are applied before limit');
select is(jsonb_array_length(get_matches_page('all',null,'Локальный клуб',1,0)->'items'),1,'calendar keeps requested page size');
select is((get_matches_page('all',null,'Шахтер тест')->>'total')::integer,4,'Russian e and yo find the same club');
select ok(exists(select 1 from search_footbazed('Локальный клуб',24) where entity_type='club' and entity_id='980001'),'global search finds a club by Russian alias');
select ok(exists(select 1 from search_footbazed('Локальный клуб',24) where entity_type='match' and entity_id='980001'),'global search finds its matches');
select ok(exists(select 1 from search_footbazed('Ёж',24) where entity_type='user' and entity_id='15000000-0000-0000-0000-000000000001' and title='Ёж'),'exact public display name with yo remains searchable and unchanged');
select ok(exists(select 1 from search_footbazed('Еж',24) where entity_type='user' and entity_id='15000000-0000-0000-0000-000000000001'),'public display name also matches e');
select ok(not exists(select 1 from search_footbazed('Ёж',24) where entity_type='user' and entity_id='15000000-0000-0000-0000-000000000002'),'normalized name does not reveal a private profile');
select ok(exists(select 1 from search_footbazed('Ёж',24) where entity_type='player' and entity_id='980001' and title='Ёж'),'exact player name with yo retains original title');
select ok(exists(select 1 from search_footbazed('Еж',24) where entity_type='player' and entity_id='980001'),'player name also matches e');
select ok(exists(select 1 from search_footbazed('Шахтёр тест',24) where entity_type='club' and entity_id='980002'),'club alias query containing yo remains searchable');
select is((get_profile_diary('15000000-0000-0000-0000-000000000001','{"query":"Локальный клуб"}',null,1)->>'total')::integer,3,'diary aliases filter all visible ratings before pagination');
select is(get_profile_diary('15000000-0000-0000-0000-000000000002','{"query":"Локальный клуб"}'),null::jsonb,'aliases do not reveal private diaries');
select is((get_football_statistics('matches','{"query":"Локальный клуб"}',0,1)->>'total')::integer,3,'overview aliases exclude private ratings and private authors');
select is((get_football_statistics('clubs','{"query":"Локальный клуб"}')->>'total')::integer,1,'club overview filters the rated entity');
select ok(exists(select 1 from search_footbazed('Ла Лига',24) where entity_type='competition' and entity_id=(select id::text from public.competitions where lower(code)='pd')),'Russian competition names find provider entities');
select is((get_football_statistics('leagues','{"query":"Ла Лига"}')->>'total')::integer,1,'competition aliases also work in overview');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"15000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select is((get_profile_diary('15000000-0000-0000-0000-000000000001','{"query":"Локальный клуб"}')->>'total')::integer,4,'owner can still search own private rating');
select is((get_football_statistics('matches','{"query":"Локальный клуб"}')->>'total')::integer,3,'owner-private rating still stays out of community overview');
reset role;
select * from finish();
rollback;
