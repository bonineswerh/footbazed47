begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(25);

insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('58000000-0000-0000-0000-00000000000'||i)::uuid,'authenticated','authenticated',
'audit'||i||'@example.test','{}','{}',now(),now() from generate_series(1,3) i;
insert into public.users(id,username,display_name,is_public)
select ('58000000-0000-0000-0000-00000000000'||i)::uuid,'Audit_'||i,'Audit '||i,i<>3 from generate_series(1,3) i;
insert into public.clubs(id,name,short_name) overriding system value values(958001,'Audit Home Football Club','Audit Home'),(958002,'Audit Away Football Club','Audit Away');
insert into public.competitions(id,name,code) overriding system value values(958001,'Audit League','AUD');
insert into public.matches(id,competition_id,league_name,home_team_name,away_team_name,home_club_id,away_club_id,match_date,status)
overriding system value values(958001,958001,'Audit League','Audit Home Football Club','Audit Away Football Club',958001,958002,now()-interval '1 day','finished'),
(958002,958001,'Audit League','Audit Home Football Club','Audit Away Football Club',958001,958002,now()-interval '2 days','finished');
insert into public.players(id,name,club_id,team) overriding system value values(958001,'Audit Player',958001,'Audit Home Football Club');
insert into public.ratings(user_id,match_id,match_rating,is_public) values
('58000000-0000-0000-0000-000000000001',958001,9,true),
('58000000-0000-0000-0000-000000000002',958001,7,true),
('58000000-0000-0000-0000-000000000003',958001,5,true),
('58000000-0000-0000-0000-000000000001',958002,2,false);
-- Create valid participation first, then remove evidence in this rolled-back
-- fixture to model historical scores whose participants are no longer covered.
insert into public.player_provider_ids(provider,external_id,player_id) values('api-football',958001,958001);
insert into public.match_lineups(match_id,fixture_id,home_club_id,away_club_id)
values(958001,958001,958001,958002),(958002,958002,958001,958002);
insert into public.match_player_appearances(match_id,provider_player_id,player_id,club_id,name,participation)
values(958001,958001,958001,958001,'Audit Player','starter'),(958002,958001,958001,958001,'Audit Player','starter');
insert into public.player_ratings(user_id,match_id,player_id,rating,is_best_player) values
('58000000-0000-0000-0000-000000000001',958001,958001,9,true),
('58000000-0000-0000-0000-000000000002',958001,958001,7,false),
('58000000-0000-0000-0000-000000000001',958002,958001,2,false);
delete from public.match_player_appearances where match_id in (958001,958002) and player_id=958001;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"58000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select throws_ok($$update public.users set username='audit_2' where id=auth.uid()$$,'23505',null,'case-insensitive handle uniqueness is enforced atomically');
select throws_ok($$update public.users set username='bad name' where id=auth.uid()$$,'23514',null,'direct writes cannot bypass handle validation');
select throws_ok($$update public.users set username=null where id=auth.uid()$$,'23514',null,'a handle cannot be null');
select throws_ok($$update public.users set display_name=repeat('a',61) where id=auth.uid()$$,'23514',null,'display names are bounded');
select throws_ok($$update public.users set bio=repeat('a',121) where id=auth.uid()$$,'23514',null,'biography is bounded on the server');
select throws_ok($$update public.users set avatar_url='javascript:alert(1)' where id=auth.uid()$$,'23514',null,'avatar references must be HTTP URLs');
select throws_ok($$update public.users set is_public=null where id=auth.uid()$$,'23514',null,'visibility cannot silently become null');
select lives_ok($$update public.users set display_name='Егор',username='audit_owner',is_public=false where id=auth.uid()$$,'owner can set display name and closure independently');
select is((select display_name from public.get_my_profile()),'Егор','display name survives a handle change');
select is((select is_public from public.get_my_profile()),false,'owner can read the closed profile');
select throws_ok($$update public.users set is_admin=true where id=auth.uid()$$,'42501',null,'profile update cannot elevate role');
select is((public.get_match_insights(958001)->>'others_rating_count')::integer,2,'comparison excludes exactly the caller');
select is((public.get_match_insights(958001)->>'others_average')::numeric,6.0::numeric,'comparison excludes caller score, retains other public votes');
select is((public.get_match_insights(958002)->>'others_rating_count')::integer,0,'private own vote cannot create another viewer');
select ok(public.get_match_insights(958002)->'others_average'='null'::jsonb,'empty comparison stays null');
select is((public.get_match_insights(958001)#>>'{top_players,0,unverified_rating_count}')::integer,2,'match flags legacy player votes');
select is((public.get_club_page(958001)#>>'{stats,rated_player_count}')::integer,1,'club sample is actual rated players, not the roster');
select is((public.get_club_page(958001)#>>'{stats,player_match_count}')::integer,1,'private match does not inflate public performance coverage');
select is((public.get_player_page(958001)#>>'{stats,unverified_rating_count}')::integer,2,'player evidence does not leak private legacy vote');
select is((public.get_player_page(958001)#>>'{performances,0,participation_verified}')::boolean,false,'public performance explicitly reports missing participation');
select is((public.get_social_feed_page()->'items'->0->'player_highlights'->0->>'participation_verified')::boolean,false,'feed reports legacy participation evidence');
-- Only the other open profile remains in overview.
select is((public.get_football_statistics('players','{"competition_id":958001}')#>>'{summary,performance_votes}')::integer,1,'overview summary counts performances in its public-profile scope');
select is((public.get_football_statistics('players','{"competition_id":958001}')#>>'{summary,unverified_performance_votes}')::integer,1,'overview reports legacy sample separately');

set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select is((public.get_match_insights(958001)->>'others_rating_count')::integer,3,'guest sees all public votes as other viewers');
select is(public.get_club_marks(array[958001::bigint])->0->>'short_name','Audit Home','bounded club marks carry compact names');
select * from finish();
rollback;
