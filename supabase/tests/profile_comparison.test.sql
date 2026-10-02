begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(27);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('51000000-0000-0000-0000-00000000000'||i)::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
  'comparison'||i||'@example.test',crypt('comparison-test',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now()
from generate_series(1,3) i;
insert into public.users(id,username,display_name,is_public)
select ('51000000-0000-0000-0000-00000000000'||i)::uuid,'comparison_'||i,'Comparison '||i,i<>3 from generate_series(1,3) i;
insert into public.competitions(id,name,code) overriding system value values(951001,'Comparison League','CMP');
insert into public.clubs(id,name,short_name) overriding system value values(952001,'Comparison Home','Home'),(952002,'Comparison Away','Away');
insert into public.matches(id,competition_id,league_name,home_team_name,away_team_name,home_club_id,away_club_id,match_date,status) overriding system value
select 953000+i,951001,'Comparison League','Comparison Home','Comparison Away',952001,952002,now()-i*interval '1 day',case when i=23 then 'scheduled' else 'finished' end from generate_series(1,23) i;
-- Scheduled ratings emulate preserved legacy data; normal writes enforce finished status.
insert into public.ratings(user_id,match_id,match_rating,is_public)
select '51000000-0000-0000-0000-000000000001',953000+i,9,i<>21 from generate_series(1,22) i;
insert into public.ratings(user_id,match_id,match_rating,is_public)
select '51000000-0000-0000-0000-000000000002',953000+i,case when i<=3 then 9 when i<=6 then 8 else 5 end,i<>22 from generate_series(1,22) i;
insert into public.ratings(user_id,match_id,match_rating,is_public) values('51000000-0000-0000-0000-000000000003',953001,7,true);
insert into public.favorite_clubs(user_id,club_id) values
('51000000-0000-0000-0000-000000000001',952001),('51000000-0000-0000-0000-000000000002',952001),('51000000-0000-0000-0000-000000000002',952002);
insert into public.players(id,name,team,club_id) overriding system value values(954001,'Common Player','Comparison Home',952001);
insert into public.player_provider_ids(provider,external_id,player_id) values('api-football',954001,954001);
insert into public.match_lineups(match_id,fixture_id,home_club_id,away_club_id) values(953001,953001,952001,952002),(953002,953002,952001,952002),(953021,953021,952001,952002);
insert into public.match_player_appearances(match_id,provider_player_id,player_id,club_id,name,participation)
select id,954001,954001,952001,'Common Player','starter' from public.matches where id in(953001,953002,953021);
insert into public.player_ratings(user_id,match_id,player_id,rating)
select ('51000000-0000-0000-0000-00000000000'||u)::uuid,m,954001,9 from generate_series(1,2) u cross join (values(953001),(953002),(953021)) x(m);
-- Simulate an imported status regression without disabling rating write invariants.
update public.matches set status='scheduled' where id=953020;
select ok(not has_function_privilege('anon','public.get_profile_comparison_page(uuid,jsonb,integer,integer)','EXECUTE'),'anonymous callers have no comparison grant');
select ok(has_function_privilege('authenticated','public.get_profile_comparison_page(uuid,jsonb,integer,integer)','EXECUTE'),'signed-in reader is granted');
select ok((select not prosecdef from pg_proc where oid='public.get_profile_comparison_page(uuid,jsonb,integer,integer)'::regprocedure),'comparison respects caller RLS');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"51000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select is((public.get_profile_comparison_page('51000000-0000-0000-0000-000000000002')->>'total')::integer,19,'visible non-friend can be compared; private and non-finished ratings excluded');
select is(jsonb_array_length(public.get_profile_comparison_page('51000000-0000-0000-0000-000000000002')->'items'),12,'page is bounded');
select is((public.get_profile_comparison_page('51000000-0000-0000-0000-000000000002')#>>'{summary,exact_matches}')::integer,3,'exact agreements are counted separately');
select is((public.get_profile_comparison_page('51000000-0000-0000-0000-000000000002')#>>'{summary,similar_matches}')::integer,6,'within-one includes exact agreements');
select is((public.get_profile_comparison_page('51000000-0000-0000-0000-000000000002')#>>'{summary,similar_percent}')::integer,32,'percent uses actual within-one count over full sample');
select is((public.get_profile_comparison_page('51000000-0000-0000-0000-000000000002')#>>'{summary,average_gap}')::numeric,2.9::numeric,'distance is average absolute gap');
select is(jsonb_array_length(public.get_profile_comparison_page('51000000-0000-0000-0000-000000000002','{}',12)->'items'),7,'second page returns remainder');
select is((public.get_profile_comparison_page('51000000-0000-0000-0000-000000000002','{}',12)#>>'{summary,exact_matches}')::integer,3,'summary is independent of current page');
select is(public.get_profile_comparison_page('51000000-0000-0000-0000-000000000002','{}',12)->>'has_more','false','last page ends pagination');
select is((public.get_profile_comparison_page('51000000-0000-0000-0000-000000000002','{"sort":"closest"}')#>>'{items,0,gap}')::integer,0,'closest sort starts at exact agreement');
select is((public.get_profile_comparison_page('51000000-0000-0000-0000-000000000002','{"sort":"different"}')#>>'{items,0,gap}')::integer,4,'different sort starts with biggest gap');
select is((public.get_profile_comparison_page('51000000-0000-0000-0000-000000000002','{"competition_id":"951001"}')->>'total')::integer,19,'competition uses internal identity');
select is((public.get_profile_comparison_page('51000000-0000-0000-0000-000000000002','{"competition_id":"999999"}')->>'total')::integer,0,'unknown competition does not broaden result');
select ok(public.get_profile_comparison_page('51000000-0000-0000-0000-000000000002','{"competition_id":"999999"}')#>'{summary,similar_percent}'='null'::jsonb,'zero sample does not claim zero or complete agreement');
select is(jsonb_array_length(public.get_profile_comparison_page('51000000-0000-0000-0000-000000000002')->'favorites'),2,'authorized favorites include common and different clubs');
select is(public.get_profile_comparison_page('51000000-0000-0000-0000-000000000002')#>>'{favorites,0,side}','both','common favorite is explicit');
select is((public.get_profile_comparison_page('51000000-0000-0000-0000-000000000002')#>>'{players,0,my_votes}')::integer,2,'private parent player rating excluded from interests');
select is((public.get_profile_comparison_page('51000000-0000-0000-0000-000000000002')#>>'{tournaments,0,my_votes}')::integer,20,'tournament interest reflects all permitted ratings, not only common matches');
select ok(not (public.get_profile_comparison_page('51000000-0000-0000-0000-000000000002')->'profile') ?| array['email','is_admin','invite_code'],'profile payload omits sensitive internals');
select ok(public.get_profile_comparison_page('51000000-0000-0000-0000-000000000003') is null,'private stranger is unavailable');
select throws_ok($$select public.get_profile_comparison_page('51000000-0000-0000-0000-000000000001')$$,'22023','comparison_user_invalid','self comparison rejected');
select throws_ok($$select public.get_profile_comparison_page('51000000-0000-0000-0000-000000000002','{"competition_id":"951001 OR true"}')$$,'22023','invalid_comparison_filters','invalid identity rejected');
reset role;
insert into public.friendships(user_id,friend_id,status) values('51000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000003','accepted');
set local role authenticated;
select is((public.get_profile_comparison_page('51000000-0000-0000-0000-000000000003')->>'total')::integer,1,'accepted friend can compare private profile but only public ratings');
select set_config('request.jwt.claims','{"role":"authenticated"}',true);
select throws_ok($$select public.get_profile_comparison_page('51000000-0000-0000-0000-000000000002')$$,'42501','auth_required','missing JWT identity rejected');
select * from finish();
rollback;
